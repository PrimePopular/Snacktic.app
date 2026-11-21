-- Update 031: sign-up bonus, 7-day daily login rewards, and profiles for Google sign-in.
-- Run once in the Supabase SQL Editor. Safe to run again.
--
-- * A new account gets a welcome bonus of Crumb Points (the owner sets the amount; starts at 10). It is paid once, when the
--   email is confirmed (Google sign-ups are confirmed straight away).
-- * Logging in each day pays a reward that grows over a 7-day cycle (starts at 5, 8, 10, 12, 15, 20, 30 = 100 in total).
--   Miss a day and the cycle starts again at day 1. After day 7 it also starts again at day 1.
-- * Google sign-ups arrive without a username, so one is made from their name or email. They can change it in Profile.

create table if not exists public.reward_settings (
  id boolean primary key default true check (id),
  signup_bonus integer not null default 10 check (signup_bonus between 0 and 1000),
  daily_login integer[] not null default array[5, 8, 10, 12, 15, 20, 30]
    check (array_length(daily_login, 1) = 7 and daily_login[1] >= 0 and daily_login[2] >= 0 and daily_login[3] >= 0 and daily_login[4] >= 0
           and daily_login[5] >= 0 and daily_login[6] >= 0 and daily_login[7] >= 0 and daily_login[1] <= 1000 and daily_login[2] <= 1000
           and daily_login[3] <= 1000 and daily_login[4] <= 1000 and daily_login[5] <= 1000 and daily_login[6] <= 1000 and daily_login[7] <= 1000)
);
insert into public.reward_settings (id) values (true) on conflict (id) do nothing;
alter table public.reward_settings enable row level security;
drop policy if exists "reward settings read" on public.reward_settings;
create policy "reward settings read" on public.reward_settings for select to anon, authenticated using (true);
drop policy if exists "reward settings owner" on public.reward_settings;
create policy "reward settings owner" on public.reward_settings for all to authenticated using (public.is_owner()) with check (public.is_owner());

alter table public.points_transactions drop constraint if exists points_transactions_kind_check;
alter table public.points_transactions add constraint points_transactions_kind_check check (kind in
  ('game_award', 'campaign_award', 'gift_sent', 'gift_received', 'redemption', 'admin_adjustment', 'ad_view', 'game_retry', 'game_purchase',
   'game_speed', 'treasure', 'signup_bonus', 'daily_login'));

-- New profiles, including Google sign-ups (no username in their details).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_phone text := coalesce(new.raw_user_meta_data ->> 'phone', '');
  v_name text := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(new.raw_user_meta_data ->> 'name'), ''), ''), 60);
  v_username text := nullif(new.raw_user_meta_data ->> 'username', '');
  v_base text;
  v_try integer := 0;
begin
  if v_username is null then
    v_base := left(regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'), 12);
    if length(v_base) < 3 then v_base := 'user'; end if;
    loop
      v_username := v_base || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4 + v_try);
      exit when not exists (select 1 from public.profiles where lower(username) = lower(v_username)) or v_try >= 4;
      v_try := v_try + 1;
    end loop;
  end if;
  insert into public.profiles (id, username, full_name, marketing_opt_in, phone)
  values (
    new.id, v_username, v_name,
    lower(coalesce(new.raw_user_meta_data ->> 'marketing_opt_in', 'false')) = 'true',
    case when v_phone ~ '^[0-9+()\-\s]{0,25}$' then v_phone else '' end
  );
  return new;
end;
$$;

-- The welcome bonus, paid once when the email is confirmed.
create or replace function public.grant_signup_bonus()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_amount integer;
begin
  if new.email_confirmed_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then return new; end if;
  if not exists (select 1 from public.profiles where id = new.id) then return new; end if;
  if exists (select 1 from public.points_transactions where user_id = new.id and kind = 'signup_bonus') then return new; end if;
  select signup_bonus into v_amount from public.reward_settings limit 1;
  if coalesce(v_amount, 0) > 0 then
    insert into public.points_transactions (user_id, amount, kind, note) values (new.id, v_amount, 'signup_bonus', 'Welcome bonus for joining Snacktic');
  end if;
  return new;
end;
$$;
drop trigger if exists zz_grant_signup_bonus on auth.users;
create trigger zz_grant_signup_bonus after insert or update of email_confirmed_at on auth.users
  for each row execute function public.grant_signup_bonus();

-- Daily login rewards.
create table if not exists public.daily_login (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  streak_day integer not null default 0 check (streak_day between 0 and 7),
  last_claim date,
  total_claims integer not null default 0
);
alter table public.daily_login enable row level security;
drop policy if exists "own daily login" on public.daily_login;
create policy "own daily login" on public.daily_login for select to authenticated using (user_id = auth.uid());

-- Where the student is in the cycle: which day they are on, whether today is already claimed, and the seven amounts.
create or replace function public.daily_login_status()
returns table (next_day integer, claimed_today boolean, amounts integer[], streak_day integer)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_tz text;
  v_today date;
  v_row public.daily_login%rowtype;
  v_amounts integer[];
begin
  if v_user is null then raise exception 'Sign in to claim daily rewards'; end if;
  select coalesce((select value from public.app_settings where key = 'timezone'), 'UTC') into v_tz;
  v_today := (now() at time zone v_tz)::date;
  select daily_login into v_amounts from public.reward_settings limit 1;
  select * into v_row from public.daily_login where user_id = v_user;
  if not found or v_row.last_claim is null or v_row.last_claim < v_today - 1 then
    return query select 1, false, v_amounts, 0;
  elsif v_row.last_claim = v_today then
    return query select v_row.streak_day, true, v_amounts, v_row.streak_day;
  else
    return query select (v_row.streak_day % 7) + 1, false, v_amounts, v_row.streak_day;
  end if;
end;
$$;
revoke all on function public.daily_login_status() from public, anon;
grant execute on function public.daily_login_status() to authenticated;

create or replace function public.claim_daily_login()
returns table (awarded integer, day integer, amounts integer[])
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_tz text;
  v_today date;
  v_row public.daily_login%rowtype;
  v_amounts integer[];
  v_day integer;
  v_pay integer;
begin
  if v_user is null then raise exception 'Sign in to claim daily rewards'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  select coalesce((select value from public.app_settings where key = 'timezone'), 'UTC') into v_tz;
  v_today := (now() at time zone v_tz)::date;
  select daily_login into v_amounts from public.reward_settings limit 1;
  insert into public.daily_login (user_id) values (v_user) on conflict do nothing;
  select * into v_row from public.daily_login where user_id = v_user for update;
  if v_row.last_claim = v_today then
    return query select 0, v_row.streak_day, v_amounts;   -- already claimed today, nothing paid
    return;
  end if;
  v_day := case when v_row.last_claim is not null and v_row.last_claim = v_today - 1 then (v_row.streak_day % 7) + 1 else 1 end;
  v_pay := coalesce(v_amounts[v_day], 0);
  update public.daily_login set streak_day = v_day, last_claim = v_today, total_claims = total_claims + 1 where user_id = v_user;
  if v_pay > 0 then
    insert into public.points_transactions (user_id, amount, kind, note) values (v_user, v_pay, 'daily_login', 'Daily login reward: day ' || v_day);
  end if;
  return query select v_pay, v_day, v_amounts;
end;
$$;
revoke all on function public.claim_daily_login() from public, anon;
grant execute on function public.claim_daily_login() to authenticated;

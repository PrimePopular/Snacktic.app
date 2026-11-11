-- ============================================================================
-- Update 010: WhatsApp number, account suspension, reward pictures, helper-managed orders,
-- and limits on how much a student can receive as gifts per day.
-- Run AFTER 009_maps_and_game_modes.sql. Safe to run more than once.
-- ============================================================================

-- WhatsApp number (optional at sign-up, required to place an order) and suspension flag.
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists suspended boolean not null default false;
alter table public.profiles drop constraint if exists profiles_phone_check;
alter table public.profiles add constraint profiles_phone_check check (phone ~ '^[0-9+()\-\s]{0,25}$');

-- Students may change their nickname, email preference and phone number. Never their role or suspension.
revoke update on public.profiles from authenticated;
grant update (username, marketing_opt_in, phone) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_phone text := coalesce(new.raw_user_meta_data ->> 'phone', '');
begin
  insert into public.profiles (id, username, full_name, marketing_opt_in, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'user_' || substr(replace(new.id::text, '-', ''), 1, 8)),
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''), 60),
    lower(coalesce(new.raw_user_meta_data ->> 'marketing_opt_in', 'false')) = 'true',
    case when v_phone ~ '^[0-9+()\-\s]{0,25}$' then v_phone else '' end
  );
  return new;
end;
$$;

-- Reward items can have a picture, and helper admins (not only the owner) manage them.
alter table public.rewards add column if not exists image_path text;
drop policy if exists "rewards owner all" on public.rewards;
drop policy if exists "rewards admin all" on public.rewards;
create policy "rewards admin all" on public.rewards
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Gift receiving limits (the owner changes them in the admin panel). Starting values are examples.
insert into public.app_settings (key, value) values ('gift_max_received_per_day', '3') on conflict (key) do nothing;
insert into public.app_settings (key, value) values ('gift_max_points_per_day', '50') on conflict (key) do nothing;

create or replace function public.gift_points(p_recipient text, p_amount integer)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_recipient uuid;
  v_recipient_name text;
  v_recipient_suspended boolean;
  v_balance integer;
  v_gift uuid;
  v_tz text;
  v_day_start timestamptz;
  v_max_count integer;
  v_max_points integer;
  v_recv_count integer;
  v_recv_points integer;
begin
  if v_sender is null then raise exception 'Sign in to gift points'; end if;
  if (select suspended from public.profiles where id = v_sender) then raise exception 'Your account is suspended'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'Gift at least 1 point'; end if;

  select id, username, suspended into v_recipient, v_recipient_name, v_recipient_suspended
    from public.profiles where lower(username) = lower(trim(p_recipient));
  if v_recipient is null then raise exception 'No student with that username'; end if;
  if v_recipient = v_sender then raise exception 'You cannot gift points to yourself'; end if;
  if v_recipient_suspended then raise exception 'That student cannot receive points right now'; end if;

  -- Limits on how much one student can receive per day (stops people pooling points to buy things).
  select coalesce((select value from public.app_settings where key = 'timezone'), 'UTC') into v_tz;
  v_day_start := date_trunc('day', now() at time zone v_tz) at time zone v_tz;
  v_max_count := coalesce((select nullif(value, '')::integer from public.app_settings where key = 'gift_max_received_per_day'), 3);
  v_max_points := coalesce((select nullif(value, '')::integer from public.app_settings where key = 'gift_max_points_per_day'), 50);
  select count(*), coalesce(sum(points), 0) into v_recv_count, v_recv_points
    from public.gifts where recipient_id = v_recipient and created_at >= v_day_start;
  if v_recv_count >= v_max_count then raise exception 'That student cannot receive more gifts today'; end if;
  if v_recv_points + p_amount > v_max_points then
    raise exception 'That student can only receive % more points today', greatest(0, v_max_points - v_recv_points);
  end if;

  perform 1 from public.profiles where id = v_sender for update;
  select coalesce(sum(amount), 0) into v_balance from public.points_transactions where user_id = v_sender;
  if v_balance < p_amount then raise exception 'Not enough Crumb Points'; end if;

  insert into public.gifts (sender_id, recipient_id, points) values (v_sender, v_recipient, p_amount)
    returning id into v_gift;
  insert into public.points_transactions (user_id, amount, kind, note)
    values (v_sender, -p_amount, 'gift_sent', 'Gift to ' || v_recipient_name);
  insert into public.points_transactions (user_id, amount, kind, note)
    values (v_recipient, p_amount, 'gift_received', 'Gift from a friend');
  return v_gift;
end;
$$;

-- Placing an order needs a WhatsApp number so the team can arrange delivery.
create or replace function public.redeem_reward(p_reward uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_balance integer;
  v_redemption uuid;
begin
  if v_user is null then raise exception 'Sign in to redeem rewards'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  if coalesce((select phone from public.profiles where id = v_user), '') = '' then
    raise exception 'Add your WhatsApp number first';
  end if;

  select * into v_reward from public.rewards where id = p_reward and active;
  if not found then raise exception 'That reward is not available'; end if;

  perform 1 from public.profiles where id = v_user for update;
  select coalesce(sum(amount), 0) into v_balance from public.points_transactions where user_id = v_user;
  if v_balance < v_reward.cost_points then raise exception 'Not enough Crumb Points'; end if;

  insert into public.redemptions (user_id, reward_id, points_cost)
    values (v_user, v_reward.id, v_reward.cost_points) returning id into v_redemption;
  insert into public.points_transactions (user_id, amount, kind, note)
    values (v_user, -v_reward.cost_points, 'redemption', 'Redeemed: ' || v_reward.name);
  return v_redemption;
end;
$$;

-- Orders list for the owner AND helper admins: who ordered what, with a way to reach them.
drop function if exists public.admin_list_redemptions();
create or replace function public.admin_list_redemptions()
returns table (
  id uuid,
  username text,
  reward_name text,
  points_cost integer,
  status text,
  created_at timestamptz,
  phone text,
  email text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
    select r.id, p.username, w.name, r.points_cost, r.status, r.created_at, p.phone, u.email::text
    from public.redemptions r
    join public.profiles p on p.id = r.user_id
    join public.rewards w on w.id = r.reward_id
    left join auth.users u on u.id = r.user_id
    order by (r.status = 'pending') desc, r.created_at desc;
end;
$$;
revoke all on function public.admin_list_redemptions() from public, anon;
grant execute on function public.admin_list_redemptions() to authenticated;

-- Helpers may mark an order handed over. Only the owner may cancel and refund.
create or replace function public.admin_set_redemption_status(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_row public.redemptions%rowtype;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_status not in ('fulfilled', 'cancelled') then raise exception 'Status must be fulfilled or cancelled'; end if;
  if p_status = 'cancelled' and not public.is_owner() then raise exception 'Owner only'; end if;

  select * into v_row from public.redemptions where id = p_id for update;
  if not found then raise exception 'Redemption not found'; end if;
  if v_row.status <> 'pending' then raise exception 'Only pending redemptions can be changed'; end if;

  update public.redemptions set status = p_status, updated_at = now() where id = p_id;
  if p_status = 'cancelled' then
    insert into public.points_transactions (user_id, amount, kind, note)
      values (v_row.user_id, v_row.points_cost, 'admin_adjustment', 'Refund: redemption cancelled');
  end if;
end;
$$;

-- The Students list now also shows phone numbers and suspension. Owner only.
drop function if exists public.admin_list_students();
create or replace function public.admin_list_students()
returns table (
  id uuid,
  username text,
  full_name text,
  email text,
  phone text,
  suspended boolean,
  joined_at timestamptz,
  last_sign_in_at timestamptz,
  role text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select p.id, p.username, p.full_name, u.email::text, p.phone, p.suspended, u.created_at, u.last_sign_in_at, p.role
    from public.profiles p
    join auth.users u on u.id = p.id
    order by u.created_at desc;
end;
$$;
revoke all on function public.admin_list_students() from public, anon;
grant execute on function public.admin_list_students() to authenticated;

-- Suspend or restore an account. Owner only. A suspended account cannot earn, gift, or order.
create or replace function public.owner_set_suspended(p_user uuid, p_suspended boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_role text;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  select role into v_role from public.profiles where id = p_user;
  if v_role is null then raise exception 'No such account'; end if;
  if v_role = 'owner' then raise exception 'The owner account cannot be suspended'; end if;
  update public.profiles set suspended = p_suspended where id = p_user;
end;
$$;
revoke all on function public.owner_set_suspended(uuid, boolean) from public, anon;
grant execute on function public.owner_set_suspended(uuid, boolean) to authenticated;

-- Game results: a suspended account earns nothing. (Same rules as before, one added check.)
create or replace function public.award_game_points(
  p_game_id text,
  p_client_id uuid,
  p_score integer,
  p_duration_ms integer,
  p_played_at timestamptz,
  p_mode text default 'default'
)
returns table (points integer, reason text)
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_mode text := coalesce(nullif(trim(p_mode), ''), 'default');
  v_rule public.game_rules%rowtype;
  v_existing public.game_plays%rowtype;
  v_tz text;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_plays integer;
  v_earned integer;
  v_base integer;
  v_award integer;
  v_played timestamptz := coalesce(p_played_at, now());
begin
  if v_user is null then raise exception 'Sign in to earn points'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  if p_client_id is null then raise exception 'That result is not valid'; end if;

  select * into v_existing from public.game_plays where user_id = v_user and client_id = p_client_id;
  if found then
    return query select v_existing.points_awarded, 'already_recorded'::text;
    return;
  end if;

  select * into v_rule from public.game_rules where game_id = p_game_id and mode = v_mode and active;
  if not found then raise exception 'That game is not giving points right now'; end if;

  if v_played > now() + interval '5 minutes' then raise exception 'That result is not valid'; end if;
  if v_played < now() - interval '24 hours' then raise exception 'That result is too old to claim'; end if;
  if p_score is null or p_score < 0 or p_score > v_rule.max_score then raise exception 'That score is not possible'; end if;
  if p_duration_ms is null or p_duration_ms < v_rule.min_duration_ms or p_duration_ms > v_rule.max_duration_ms then
    raise exception 'That result is not valid';
  end if;

  if p_score < v_rule.min_score then
    return query select 0, 'score_too_low'::text;
    return;
  end if;

  perform 1 from public.profiles where id = v_user for update;

  select coalesce((select value from public.app_settings where key = 'timezone'), 'UTC') into v_tz;
  v_day_start := date_trunc('day', v_played at time zone v_tz) at time zone v_tz;
  v_day_end := v_day_start + interval '1 day';

  select count(*), coalesce(sum(g.points_awarded), 0) into v_plays, v_earned
    from public.game_plays g
    where g.user_id = v_user and g.game_id = p_game_id and g.mode = v_mode
      and g.played_at >= v_day_start and g.played_at < v_day_end;

  if v_rule.award_type = 'by_score' then
    v_base := least(v_rule.max_round_award, floor(p_score * v_rule.points_per_score)::integer);
    if v_plays > 0 then v_base := floor(v_base * v_rule.replay_percent / 100.0)::integer; end if;
  else
    v_base := case when v_plays = 0 then v_rule.daily_first_award else v_rule.replay_award end;
  end if;
  v_award := greatest(0, least(v_base, v_rule.daily_cap - v_earned));

  insert into public.game_plays (user_id, game_id, mode, client_id, score, duration_ms, played_at, points_awarded)
    values (v_user, p_game_id, v_mode, p_client_id, p_score, p_duration_ms, v_played, v_award);

  if v_award > 0 then
    insert into public.points_transactions (user_id, amount, kind, note)
      values (v_user, v_award, 'game_award',
        v_rule.title || case when v_rule.mode_label <> '' then ' (' || v_rule.mode_label || ')' else '' end);
  end if;

  return query select
    v_award,
    case
      when v_award > 0 and v_plays = 0 then 'daily_first'
      when v_award > 0 then 'replay'
      when v_base = 0 then 'no_points'
      else 'cap_reached'
    end;
end;
$$;
revoke all on function public.award_game_points(text, uuid, integer, integer, timestamptz, text) from public, anon;
grant execute on function public.award_game_points(text, uuid, integer, integer, timestamptz, text) to authenticated;

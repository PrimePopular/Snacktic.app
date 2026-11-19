-- Update 028: Bonus Rewards.
-- Run this once in the Supabase SQL Editor. It is safe to run again.
--
-- A Bonus Reward is an ordinary row in public.rewards with is_bonus = true.
--   cost_points  = the normal ("was") price, shown crossed out
--   bonus_cost   = the special price new members pay
-- The server (not the app) decides who may claim one: the account must be newer than the eligibility days,
-- the offer must not have ended, and nobody can claim more than bonus_limit_per_user.

alter table public.rewards add column if not exists is_bonus boolean not null default false;
alter table public.rewards add column if not exists bonus_cost integer check (bonus_cost is null or bonus_cost >= 0);
alter table public.rewards add column if not exists bonus_ends_at timestamptz;
alter table public.rewards add column if not exists bonus_limit_per_user integer not null default 1 check (bonus_limit_per_user >= 1);

-- One row of rules the admin can change.
create table if not exists public.bonus_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  eligibility_days integer not null default 7 check (eligibility_days between 1 and 365),
  new_user_every integer not null default 4 check (new_user_every between 1 and 50),
  others_every integer not null default 12 check (others_every between 1 and 200),
  sections text[] not null default array['home','discover','games','rewards']
);
insert into public.bonus_settings (id) values (true) on conflict (id) do nothing;
alter table public.bonus_settings enable row level security;
drop policy if exists "bonus settings read" on public.bonus_settings;
create policy "bonus settings read" on public.bonus_settings for select to anon, authenticated using (true);
drop policy if exists "bonus settings admin" on public.bonus_settings;
create policy "bonus settings admin" on public.bonus_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Who has claimed which offer (only the server writes here).
create table if not exists public.bonus_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reward_id uuid not null references public.rewards (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists bonus_claims_user_reward_idx on public.bonus_claims (user_id, reward_id);
alter table public.bonus_claims enable row level security;
drop policy if exists "bonus claims admin read" on public.bonus_claims;
create policy "bonus claims admin read" on public.bonus_claims for select to authenticated using (public.is_admin());

-- Views and clicks, for the admin numbers.
create table if not exists public.bonus_events (
  id bigint generated always as identity primary key,
  reward_id uuid not null references public.rewards (id) on delete cascade,
  user_id uuid,
  kind text not null check (kind in ('view', 'click')),
  created_at timestamptz not null default now()
);
create index if not exists bonus_events_reward_idx on public.bonus_events (reward_id, kind);
alter table public.bonus_events enable row level security;

create or replace function public.track_bonus(p_reward uuid, p_kind text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_kind not in ('view', 'click') then return; end if;
  if not exists (select 1 from public.rewards where id = p_reward and is_bonus) then return; end if;
  insert into public.bonus_events (reward_id, user_id, kind) values (p_reward, auth.uid(), p_kind);
end;
$$;
revoke all on function public.track_bonus(uuid, text) from public;
grant execute on function public.track_bonus(uuid, text) to anon, authenticated;

-- What the app needs to know: the rules, whether this person is eligible, and what they already claimed.
drop function if exists public.bonus_status();
create or replace function public.bonus_status()
returns table (enabled boolean, eligible boolean, eligibility_days integer, new_user_every integer, others_every integer, sections text[], claimed uuid[])
language plpgsql stable security definer set search_path = public
as $$
declare
  v_set public.bonus_settings%rowtype;
  v_user uuid := auth.uid();
  v_created timestamptz;
begin
  select * into v_set from public.bonus_settings limit 1;
  if v_user is not null then select created_at into v_created from public.profiles where id = v_user; end if;
  return query select
    v_set.enabled,
    (v_set.enabled and v_created is not null and v_created > now() - make_interval(days => v_set.eligibility_days)),
    v_set.eligibility_days, v_set.new_user_every, v_set.others_every, v_set.sections,
    coalesce((select array_agg(c.reward_id) from public.bonus_claims c where c.user_id = v_user), '{}'::uuid[]);
end;
$$;
revoke all on function public.bonus_status() from public;
grant execute on function public.bonus_status() to anon, authenticated;

-- Admin numbers: views, clicks and claims for each offer.
create or replace function public.admin_bonus_stats()
returns table (reward_id uuid, reward_name text, views bigint, clicks bigint, claims bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
    select r.id, r.name,
      (select count(*) from public.bonus_events e where e.reward_id = r.id and e.kind = 'view'),
      (select count(*) from public.bonus_events e where e.reward_id = r.id and e.kind = 'click'),
      (select count(*) from public.bonus_claims c where c.reward_id = r.id)
    from public.rewards r where r.is_bonus order by r.name;
end;
$$;
revoke all on function public.admin_bonus_stats() from public, anon;
grant execute on function public.admin_bonus_stats() to authenticated;

-- Shared check used by both redeem functions. Returns the price to charge, or raises a friendly error.
create or replace function public.bonus_price_for(p_user uuid, p_reward public.rewards)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_set public.bonus_settings%rowtype;
  v_created timestamptz;
begin
  if not p_reward.is_bonus then return p_reward.cost_points; end if;
  select * into v_set from public.bonus_settings limit 1;
  if not v_set.enabled then raise exception 'Bonus offers are paused right now'; end if;
  if p_reward.bonus_cost is null then raise exception 'That offer is not ready yet'; end if;
  if p_reward.bonus_ends_at is not null and p_reward.bonus_ends_at < now() then raise exception 'That offer has ended'; end if;
  select created_at into v_created from public.profiles where id = p_user;
  if v_created is null or v_created <= now() - make_interval(days => v_set.eligibility_days) then
    raise exception 'This offer is for new members only';
  end if;
  if (select count(*) from public.bonus_claims where user_id = p_user and reward_id = p_reward.id) >= p_reward.bonus_limit_per_user then
    raise exception 'You have already claimed this offer';
  end if;
  return p_reward.bonus_cost;
end;
$$;
revoke all on function public.bonus_price_for(uuid, public.rewards) from public, anon, authenticated;

-- Physical rewards (same as 019, now bonus-aware).
create or replace function public.redeem_reward(p_reward uuid, p_location uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_loc public.delivery_locations%rowtype;
  v_balance integer;
  v_cost integer;
  v_redemption uuid;
begin
  if v_user is null then raise exception 'Sign in to redeem rewards'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  if coalesce((select phone from public.profiles where id = v_user), '') = '' then
    raise exception 'Add your WhatsApp number first';
  end if;

  select * into v_loc from public.delivery_locations where id = p_location and active;
  if not found then raise exception 'Delivery is not available to that place'; end if;

  select * into v_reward from public.rewards where id = p_reward and active for update;
  if not found then raise exception 'That reward is not available'; end if;
  if v_reward.kind = 'digital' then raise exception 'That reward is digital. Use Get it.'; end if;
  if v_reward.stock is not null and v_reward.stock <= 0 then raise exception 'That reward is sold out'; end if;

  perform 1 from public.profiles where id = v_user for update;
  v_cost := public.bonus_price_for(v_user, v_reward);
  select coalesce(sum(amount), 0) into v_balance from public.points_transactions where user_id = v_user;
  if v_balance < v_cost then raise exception 'Not enough Crumb Points'; end if;

  insert into public.redemptions (user_id, reward_id, points_cost, reward_name, delivery_location_id, delivery_location_name)
    values (v_user, v_reward.id, v_cost, v_reward.name, v_loc.id, v_loc.name) returning id into v_redemption;
  insert into public.points_transactions (user_id, amount, kind, note)
    values (v_user, -v_cost, 'redemption', 'Redeemed: ' || v_reward.name);
  if v_reward.is_bonus then
    insert into public.bonus_claims (user_id, reward_id) values (v_user, v_reward.id);
  end if;
  if v_reward.stock is not null then
    update public.rewards set stock = stock - 1 where id = v_reward.id;
  end if;
  return v_redemption;
end;
$$;
revoke all on function public.redeem_reward(uuid, uuid) from public, anon;
grant execute on function public.redeem_reward(uuid, uuid) to authenticated;

-- Digital rewards (same as 018, now bonus-aware).
create or replace function public.buy_digital_reward(p_reward uuid)
returns table (book_title text, book_url text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_old public.digital_purchases%rowtype;
  v_url text;
  v_balance integer;
  v_cost integer;
begin
  if v_user is null then raise exception 'Sign in to buy this'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;

  -- Getting the same item twice just shows it again; nothing is charged.
  select * into v_old from public.digital_purchases where user_id = v_user and reward_id = p_reward;
  if found then
    return query select v_old.title, v_old.url;
    return;
  end if;

  select * into v_reward from public.rewards where id = p_reward and active and kind = 'digital' for update;
  if not found then raise exception 'That reward is not available'; end if;
  if v_reward.stock is not null and v_reward.stock <= 0 then raise exception 'That reward is sold out'; end if;
  select f.url into v_url from public.reward_files f where f.reward_id = p_reward;
  if v_url is null then raise exception 'This item is not ready yet'; end if;

  perform 1 from public.profiles where id = v_user for update;
  v_cost := public.bonus_price_for(v_user, v_reward);
  select coalesce(sum(t.amount), 0) into v_balance from public.points_transactions t where t.user_id = v_user;
  if v_balance < v_cost then raise exception 'Not enough Crumb Points'; end if;

  insert into public.digital_purchases (user_id, reward_id, title, url, points_cost)
    values (v_user, p_reward, v_reward.name, v_url, v_cost);
  insert into public.points_transactions (user_id, amount, kind, note)
    values (v_user, -v_cost, 'redemption', 'Bought: ' || v_reward.name);
  if v_reward.is_bonus then
    insert into public.bonus_claims (user_id, reward_id) values (v_user, p_reward);
  end if;
  if v_reward.stock is not null then
    update public.rewards set stock = stock - 1 where id = p_reward;
  end if;
  return query select v_reward.name, v_url;
end;
$$;
revoke all on function public.buy_digital_reward(uuid) from public, anon;
grant execute on function public.buy_digital_reward(uuid) to authenticated;

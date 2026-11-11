-- ============================================================================
-- Snacktic database schema (Supabase / PostgreSQL)
--
-- HOW TO RUN: Supabase dashboard > SQL Editor > New query > paste this whole file > Run.
-- It is written to be safe to run again if something fails halfway.
--
-- Design rules:
--  * Content (events, products, announcements, locations, stock, rewards, campaigns) is
--    written ONLY by administrators and read by everyone.
--  * Points are never edited directly. The balance is the sum of transactions, and
--    transactions are only created by the functions at the bottom of this file.
--  * Row Level Security is on for every table.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  role text not null default 'student' check (role in ('student', 'admin')),
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Every new sign-up gets a profile automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, marketing_opt_in)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'user_' || substr(replace(new.id::text, '-', ''), 1, 8)),
    lower(coalesce(new.raw_user_meta_data ->> 'marketing_opt_in', 'false')) = 'true'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Content managed from the admin dashboard
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  body text not null default '',
  published boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  description text not null default '',
  category text not null default 'other'
    check (category in ('party', 'sports', 'academic', 'gathering', 'talent', 'other')),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  location_text text not null default '',
  image_url text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  description text not null default '',
  category text not null default 'cookie'
    check (category in ('cookie', 'drink', 'popcorn', 'package', 'special')),
  price numeric(10, 2) not null check (price >= 0),
  image_url text,
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  description text not null default '',
  address text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.stock (
  location_id uuid not null references public.locations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  status text not null default 'available'
    check (status in ('available', 'almost_sold_out', 'out_of_stock')),
  updated_at timestamptz not null default now(),
  primary key (location_id, product_id)
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  description text not null default '',
  cost_points integer not null check (cost_points > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  description text not null default '',
  kind text not null default 'promotion' check (kind in ('find_a_friend', 'promotion')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Small key/value settings, e.g. the currency symbol shown next to prices.
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);
insert into public.app_settings (key, value) values ('currency_symbol', '') on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Points, gifts and redemptions
-- ---------------------------------------------------------------------------
create table if not exists public.points_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount <> 0),
  kind text not null check (kind in
    ('game_award', 'campaign_award', 'gift_sent', 'gift_received', 'redemption', 'admin_adjustment')),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists points_transactions_user_idx on public.points_transactions (user_id, created_at desc);

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  points integer not null check (points > 0),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reward_id uuid not null references public.rewards (id),
  points_cost integer not null check (points_cost > 0),
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.announcements enable row level security;
alter table public.events enable row level security;
alter table public.products enable row level security;
alter table public.locations enable row level security;
alter table public.stock enable row level security;
alter table public.rewards enable row level security;
alter table public.campaigns enable row level security;
alter table public.app_settings enable row level security;
alter table public.points_transactions enable row level security;
alter table public.gifts enable row level security;
alter table public.redemptions enable row level security;

-- Profiles: you can see and rename yourself. Admins can see everyone. Nobody can change a role.
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (username, marketing_opt_in) on public.profiles to authenticated;

-- Public content: everyone (including guests) reads what is live. Admins manage everything.
drop policy if exists "announcements public read" on public.announcements;
create policy "announcements public read" on public.announcements
  for select to anon, authenticated
  using (published and (expires_at is null or expires_at > now()));
drop policy if exists "announcements admin all" on public.announcements;
create policy "announcements admin all" on public.announcements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "events public read" on public.events;
create policy "events public read" on public.events
  for select to anon, authenticated using (published and expires_at > now());
drop policy if exists "events admin all" on public.events;
create policy "events admin all" on public.events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products
  for select to anon, authenticated using (active);
drop policy if exists "products admin all" on public.products;
create policy "products admin all" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "locations public read" on public.locations;
create policy "locations public read" on public.locations
  for select to anon, authenticated using (active);
drop policy if exists "locations admin all" on public.locations;
create policy "locations admin all" on public.locations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "stock public read" on public.stock;
create policy "stock public read" on public.stock
  for select to anon, authenticated using (true);
drop policy if exists "stock admin all" on public.stock;
create policy "stock admin all" on public.stock
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "rewards public read" on public.rewards;
create policy "rewards public read" on public.rewards
  for select to anon, authenticated using (active);
drop policy if exists "rewards admin all" on public.rewards;
create policy "rewards admin all" on public.rewards
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "campaigns public read" on public.campaigns;
create policy "campaigns public read" on public.campaigns
  for select to anon, authenticated
  using (active and now() >= starts_at and now() < ends_at);
drop policy if exists "campaigns admin all" on public.campaigns;
create policy "campaigns admin all" on public.campaigns
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "settings public read" on public.app_settings;
create policy "settings public read" on public.app_settings
  for select to anon, authenticated using (true);
drop policy if exists "settings admin all" on public.app_settings;
create policy "settings admin all" on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Points, gifts, redemptions: read-only from the app. All changes go through the functions below.
drop policy if exists "transactions read own or admin" on public.points_transactions;
create policy "transactions read own or admin" on public.points_transactions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "gifts read involved or admin" on public.gifts;
create policy "gifts read involved or admin" on public.gifts
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin());

drop policy if exists "redemptions read own or admin" on public.redemptions;
create policy "redemptions read own or admin" on public.redemptions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

revoke all on public.profiles, public.points_transactions, public.gifts, public.redemptions from anon;
revoke insert, update, delete on public.points_transactions, public.gifts, public.redemptions from authenticated;

-- ---------------------------------------------------------------------------
-- Trusted functions: the only way points move.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_balance()
returns integer
language sql stable set search_path = public
as $$
  select coalesce(sum(amount), 0)::integer from public.points_transactions where user_id = auth.uid();
$$;

create or replace function public.gift_points(p_recipient text, p_amount integer)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_recipient uuid;
  v_recipient_name text;
  v_balance integer;
  v_gift uuid;
begin
  if v_sender is null then raise exception 'Sign in to gift points'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'Gift at least 1 point'; end if;

  select id, username into v_recipient, v_recipient_name
    from public.profiles where lower(username) = lower(trim(p_recipient));
  if v_recipient is null then raise exception 'No student with that username'; end if;
  if v_recipient = v_sender then raise exception 'You cannot gift points to yourself'; end if;

  -- Lock the sender so two gifts at once cannot spend the same points twice.
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

create or replace function public.admin_adjust_points(p_username text, p_amount integer, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid;
begin
  if not public.is_admin() then raise exception 'Administrators only'; end if;
  if p_amount is null or p_amount = 0 then raise exception 'Amount cannot be zero'; end if;
  select id into v_user from public.profiles where lower(username) = lower(trim(p_username));
  if v_user is null then raise exception 'No student with that username'; end if;
  insert into public.points_transactions (user_id, amount, kind, note)
    values (v_user, p_amount, 'admin_adjustment', coalesce(nullif(trim(p_note), ''), 'Adjustment by admin'));
end;
$$;

create or replace function public.admin_set_redemption_status(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_row public.redemptions%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrators only'; end if;
  if p_status not in ('fulfilled', 'cancelled') then raise exception 'Status must be fulfilled or cancelled'; end if;

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

-- Lets the sign-up screen say "that username is taken" before creating the account.
create or replace function public.username_available(p_username text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(trim(p_username)));
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- Only signed-in users may call these. Guests (anon) may not.
revoke all on function public.is_admin() from public, anon;
revoke all on function public.get_my_balance() from public, anon;
revoke all on function public.gift_points(text, integer) from public, anon;
revoke all on function public.redeem_reward(uuid) from public, anon;
revoke all on function public.admin_adjust_points(text, integer, text) from public, anon;
revoke all on function public.admin_set_redemption_status(uuid, text) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.get_my_balance() to authenticated;
grant execute on function public.gift_points(text, integer) to authenticated;
grant execute on function public.redeem_reward(uuid) to authenticated;
grant execute on function public.admin_adjust_points(text, integer, text) to authenticated;
grant execute on function public.admin_set_redemption_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- After you create your own account in the app, make yourself an administrator
-- by running this ONCE in the SQL Editor (replace the username):
--
--   update public.profiles set role = 'admin' where lower(username) = lower('YOUR_USERNAME');
-- ---------------------------------------------------------------------------

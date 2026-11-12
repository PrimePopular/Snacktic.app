-- ============================================================================
-- Update 011: Shops (with partner products) and Ads that pay Crumb Points.
-- Run AFTER 010_orders_phone_suspend_limits.sql. Safe to run more than once.
-- Shops are content (owner and helper admins). Ads pay points, so only the owner manages them.
-- ============================================================================

-- A new kind of points transaction: viewing an ad.
alter table public.points_transactions drop constraint if exists points_transactions_kind_check;
alter table public.points_transactions add constraint points_transactions_kind_check check (kind in
  ('game_award', 'campaign_award', 'gift_sent', 'gift_received', 'redemption', 'admin_adjustment', 'ad_view'));

-- ---------------------------------------------------------------------------
-- Shops around campus, and the partner products they carry
-- ---------------------------------------------------------------------------
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  description text not null default '',
  image_path text,
  address text not null default '',
  latitude double precision,
  longitude double precision,
  phone text not null default '' check (phone ~ '^[0-9+()\-\s]{0,25}$'),
  opening_hours text not null default '' check (length(opening_hours) <= 200),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  description text not null default '',
  image_path text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists shop_products_shop_idx on public.shop_products (shop_id);

alter table public.shops enable row level security;
alter table public.shop_products enable row level security;

drop policy if exists "shops public read" on public.shops;
create policy "shops public read" on public.shops for select to anon, authenticated using (published);
drop policy if exists "shops admin all" on public.shops;
create policy "shops admin all" on public.shops for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "shop products public read" on public.shop_products;
create policy "shop products public read" on public.shop_products for select to anon, authenticated
  using (published and exists (select 1 from public.shops s where s.id = shop_id and s.published));
drop policy if exists "shop products admin all" on public.shop_products;
create policy "shop products admin all" on public.shop_products for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Ads. The owner sets how many points each ad pays (0 to 5). One payment per student per ad.
-- ---------------------------------------------------------------------------
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  advertiser text not null default '' check (length(advertiser) <= 80),
  title text not null check (length(title) between 1 and 120),
  body text not null default '' check (length(body) <= 400),
  image_path text,
  link text not null default '' check (link = '' or link ~* '^https?://'),
  points integer not null default 1 check (points between 0 and 5),
  ends_at timestamptz,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ad_views (
  ad_id uuid not null references public.ads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  points_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (ad_id, user_id)
);

alter table public.ads enable row level security;
alter table public.ad_views enable row level security;

drop policy if exists "ads public read" on public.ads;
create policy "ads public read" on public.ads for select to anon, authenticated
  using (published and (ends_at is null or ends_at > now()));
drop policy if exists "ads owner read all" on public.ads;
create policy "ads owner read all" on public.ads for select to authenticated using (public.is_owner());
drop policy if exists "ads owner write" on public.ads;
create policy "ads owner write" on public.ads for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- Students may only see their own ad views. Nobody writes to this table directly.
drop policy if exists "ad views read own" on public.ad_views;
create policy "ad views read own" on public.ad_views for select to authenticated using (user_id = auth.uid());

-- The one function that pays for seeing an ad. Returns the points paid (0 if already paid).
create or replace function public.claim_ad_points(p_ad_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ad public.ads%rowtype;
  v_inserted integer;
begin
  if v_user is null then raise exception 'Sign in to earn points'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;

  select * into v_ad from public.ads
    where id = p_ad_id and published and (ends_at is null or ends_at > now());
  if not found then return 0; end if;

  insert into public.ad_views (ad_id, user_id, points_awarded) values (p_ad_id, v_user, v_ad.points)
    on conflict (ad_id, user_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 0; end if;

  if v_ad.points > 0 then
    insert into public.points_transactions (user_id, amount, kind, note)
      values (v_user, v_ad.points, 'ad_view', 'Ad: ' || left(v_ad.title, 60));
  end if;
  return v_ad.points;
end;
$$;
revoke all on function public.claim_ad_points(uuid) from public, anon;
grant execute on function public.claim_ad_points(uuid) to authenticated;

-- Owner only: how many different students saw each ad (useful when selling ad space).
create or replace function public.owner_ad_viewers()
returns table (ad_id uuid, viewers bigint)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query select v.ad_id, count(*) from public.ad_views v group by v.ad_id;
end;
$$;
revoke all on function public.owner_ad_viewers() from public, anon;
grant execute on function public.owner_ad_viewers() to authenticated;

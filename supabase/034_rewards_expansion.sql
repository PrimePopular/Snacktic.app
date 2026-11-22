-- Update 032 (part 2): a bigger Rewards Store.
-- Run once in the Supabase SQL Editor, after 022. Safe to run again.
--
-- * Product types for digital rewards: ebook, novel, coupon, gift card, voucher, subscription, template, download, other.
-- * Percentage discounts (50, 80, 90 or any whole percent) on a reward's Crumb Point price, with optional start and end dates.
-- * A limit on how many times one person can get the same reward.
-- * Categories the owner makes up (Snacks, Drinks, Merch ...), used to filter the store.
-- Prices are worked out and checked here in the database, so the app cannot be tricked into a cheaper price.

create table if not exists public.reward_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 40),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists reward_categories_name_idx on public.reward_categories (lower(name));
alter table public.reward_categories enable row level security;
drop policy if exists "reward categories read" on public.reward_categories;
create policy "reward categories read" on public.reward_categories for select to anon, authenticated using (true);
drop policy if exists "reward categories admin" on public.reward_categories;
create policy "reward categories admin" on public.reward_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.rewards add column if not exists product_type text not null default 'item'
  check (product_type in ('item', 'ebook', 'novel', 'coupon', 'gift_card', 'voucher', 'subscription', 'template', 'download', 'other'));
alter table public.rewards add column if not exists discount_percent integer check (discount_percent is null or discount_percent between 1 and 99);
alter table public.rewards add column if not exists discount_starts_at timestamptz;
alter table public.rewards add column if not exists discount_ends_at timestamptz;
alter table public.rewards add column if not exists per_user_limit integer check (per_user_limit is null or per_user_limit >= 1);
alter table public.rewards add column if not exists category_id uuid references public.reward_categories (id) on delete set null;
update public.rewards set product_type = 'ebook' where kind = 'digital' and product_type = 'item';
alter table public.rewards drop constraint if exists rewards_discount_window_check;
alter table public.rewards add constraint rewards_discount_window_check check (discount_starts_at is null or discount_ends_at is null or discount_ends_at > discount_starts_at);

-- The one place a price is decided. Used by both redeem functions (physical and digital).
create or replace function public.bonus_price_for(p_user uuid, p_reward public.rewards)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_set public.bonus_settings%rowtype;
  v_created timestamptz;
  v_used integer;
  v_price integer := p_reward.cost_points;
begin
  -- A limit per person applies to every reward.
  if p_reward.per_user_limit is not null then
    select (select count(*) from public.redemptions where user_id = p_user and reward_id = p_reward.id)
         + (select count(*) from public.digital_purchases where user_id = p_user and reward_id = p_reward.id) into v_used;
    if v_used >= p_reward.per_user_limit then raise exception 'You have reached the limit for this reward'; end if;
  end if;

  if p_reward.is_bonus then
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
  end if;

  -- An ordinary percentage discount, only inside its dates.
  if p_reward.discount_percent is not null
     and (p_reward.discount_starts_at is null or p_reward.discount_starts_at <= now())
     and (p_reward.discount_ends_at is null or p_reward.discount_ends_at > now()) then
    v_price := greatest(1, ceil(p_reward.cost_points * (100 - p_reward.discount_percent) / 100.0)::integer);
  end if;
  return v_price;
end;
$$;
revoke all on function public.bonus_price_for(uuid, public.rewards) from public, anon, authenticated;

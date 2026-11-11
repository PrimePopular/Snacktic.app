-- ============================================================================
-- Update 007: Places (things to try: food spots, hangouts, trips) with their own numbered categories.
-- Run AFTER 006_contacts_pictures_rewards.sql. Safe to run more than once.
-- ============================================================================

-- The category table now serves both events and places. Numbers stay unique across both.
alter table public.event_categories
  add column if not exists kind text not null default 'event' check (kind in ('event', 'place'));

drop index if exists public.event_categories_name_idx;
create unique index if not exists event_categories_kind_name_idx on public.event_categories (kind, lower(name));

-- Starting place categories (only when there are none yet).
insert into public.event_categories (name, kind)
select v.name, 'place'
from (values ('Food'), ('Hangout'), ('Trip'), ('Other')) as v(name)
where not exists (select 1 from public.event_categories where kind = 'place');

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  description text not null default '',
  category_id integer references public.event_categories (id),
  address text not null default '',
  image_path text,
  link text not null default '' check (link = '' or link ~* '^https?://'),
  phone text not null default '' check (phone ~ '^[0-9+()\-\s]{0,25}$'),
  published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.places enable row level security;

drop policy if exists "places public read" on public.places;
create policy "places public read" on public.places
  for select to anon, authenticated using (published);

drop policy if exists "places admin all" on public.places;
create policy "places admin all" on public.places
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

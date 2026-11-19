-- Update 029: News is separate from Announcements.
-- Run once in the Supabase SQL Editor. Safe to run again.
--
-- Announcements stay written by the team and normally last 24 hours (they can also be scheduled to start later).
-- News is an automatic feed: the fetch-news Edge Function (docs/NEWS_SOURCES.md) saves trending stories here, and students see
-- headline, picture, source and a link out. Nobody types news by hand.

alter table public.announcements add column if not exists starts_at timestamptz;

create table if not exists public.news_items (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('youtube', 'reddit', 'x', 'rss')),
  source_name text not null default '',
  title text not null check (length(title) between 1 and 240),
  summary text not null default '' check (length(summary) <= 600),
  image_url text,
  url text not null unique check (url ~* '^https?://'),
  score numeric not null default 0,
  published_at timestamptz not null default now(),
  fetched_at timestamptz not null default now(),
  hidden boolean not null default false
);
create index if not exists news_items_rank_idx on public.news_items (hidden, score desc, published_at desc);

alter table public.news_items enable row level security;
drop policy if exists "news public read" on public.news_items;
create policy "news public read" on public.news_items for select to anon, authenticated using (not hidden and published_at > now() - interval '7 days');
drop policy if exists "news admin all" on public.news_items;
create policy "news admin all" on public.news_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Update 029: Billboards, a free discovery feed (music, creators, stories, recommendations and more).
-- Run once in the Supabase SQL Editor. Safe to run again.
--
-- Billboards are not ads and not events. Only admins (the owner and helper admins, including an automated helper that signs in
-- as a helper admin) can publish. Every post stays visible for at least 30 days: if an end date is set, the database requires
-- it to be 30 days or more after the post goes live.

create table if not exists public.billboard_posts (
  id uuid primary key default gen_random_uuid(),
  layout text not null default 'text' check (layout in ('text', 'image', 'gallery', 'video', 'link', 'quote')),
  title text not null default '' check (length(title) <= 140),
  body text not null default '' check (length(body) <= 2000),
  images text[] not null default '{}' check (coalesce(array_length(images, 1), 0) <= 10),
  video_url text check (video_url is null or video_url ~* '^https?://'),
  link_url text check (link_url is null or link_url ~* '^https?://'),
  link_label text not null default '' check (length(link_label) <= 60),
  featured boolean not null default false,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  publish_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (title <> '' or body <> '' or coalesce(array_length(images, 1), 0) > 0 or video_url is not null or link_url is not null),
  check (expires_at is null or expires_at >= publish_at + interval '30 days')
);
create index if not exists billboard_posts_feed_idx on public.billboard_posts (status, featured desc, publish_at desc);

alter table public.billboard_posts enable row level security;
drop policy if exists "billboards public read" on public.billboard_posts;
create policy "billboards public read" on public.billboard_posts for select to anon, authenticated
  using (status = 'published' and publish_at <= now() and (expires_at is null or expires_at > now()));
drop policy if exists "billboards admin all" on public.billboard_posts;
create policy "billboards admin all" on public.billboard_posts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.billboard_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' and new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;
drop trigger if exists billboard_touch on public.billboard_posts;
create trigger billboard_touch before insert or update on public.billboard_posts for each row execute function public.billboard_touch();

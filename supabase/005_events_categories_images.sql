-- ============================================================================
-- Update 005: numbered event categories and event pictures.
-- Run AFTER 004_team_and_announcements.sql. Safe to run more than once.
-- ============================================================================

-- Categories. The id is the category's number, used later to learn what each student likes.
create table if not exists public.event_categories (
  id integer generated always as identity primary key,
  name text not null check (length(name) between 1 and 40),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists event_categories_name_idx on public.event_categories (lower(name));

-- Starting categories (only inserted when the table is empty, so numbers never skip on re-runs).
insert into public.event_categories (name)
select v.name
from (values ('Party'), ('Sports'), ('Academic'), ('Gathering'), ('Talent'), ('Other')) as v(name)
where not exists (select 1 from public.event_categories);

alter table public.event_categories enable row level security;

drop policy if exists "categories public read" on public.event_categories;
create policy "categories public read" on public.event_categories
  for select to anon, authenticated using (true);
drop policy if exists "categories admin all" on public.event_categories;
create policy "categories admin all" on public.event_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Events now point at a category number and keep a picture path instead of a link.
alter table public.events add column if not exists category_id integer references public.event_categories (id);
alter table public.events add column if not exists image_path text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'category'
  ) then
    update public.events e set category_id = c.id
      from public.event_categories c
      where e.category_id is null and lower(c.name) = e.category;
    alter table public.events drop column category;
  end if;
end $$;

alter table public.events drop column if exists image_url;

-- Pictures: a public bucket (anyone can view), small files only, only admins can add or remove.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', true, 512000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "event images admin select" on storage.objects;
create policy "event images admin select" on storage.objects
  for select to authenticated using (bucket_id = 'event-images' and public.is_admin());

drop policy if exists "event images admin insert" on storage.objects;
create policy "event images admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'event-images' and public.is_admin());

drop policy if exists "event images admin update" on storage.objects;
create policy "event images admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'event-images' and public.is_admin())
  with check (bucket_id = 'event-images' and public.is_admin());

drop policy if exists "event images admin delete" on storage.objects;
create policy "event images admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'event-images' and public.is_admin());

-- Update 030: a permanent trail of who posted or changed what, and a "content editor" role.
-- Run once in the Supabase SQL Editor, after 026 and 029. Safe to run again.
--
-- 1. admin_activity records every create, edit and delete that an owner, admin or editor makes on content (Billboards,
--    announcements, events, places, shops, ads, rewards and news). Nobody can edit or delete these records from the app.
-- 2. The new role "editor" can manage only Billboards and Events. The owner assigns it in Admin, Team.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student', 'admin', 'owner', 'editor'));

create or replace function public.is_editor()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'editor'); $$;
revoke all on function public.is_editor() from public, anon;
grant execute on function public.is_editor() to authenticated;

create or replace function public.owner_set_role(p_email text, p_role text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_current text;
  v_username text;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  if p_role not in ('admin', 'editor', 'student') then raise exception 'Role must be admin, editor or student'; end if;
  select u.id into v_id from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_id is null then raise exception 'No account with that email. They need to sign up first.'; end if;
  select role, username into v_current, v_username from public.profiles where id = v_id;
  if v_current is null then raise exception 'No account with that email. They need to sign up first.'; end if;
  if v_current = 'owner' then raise exception 'The owner role cannot be changed here'; end if;
  update public.profiles set role = p_role where id = v_id;
  return v_username;
end;
$$;
revoke all on function public.owner_set_role(text, text) from public, anon;
grant execute on function public.owner_set_role(text, text) to authenticated;

-- Editors may manage Billboards and Events (and the pictures they use).
drop policy if exists "billboards admin all" on public.billboard_posts;
create policy "billboards admin all" on public.billboard_posts for all to authenticated
  using (public.is_admin() or public.is_editor()) with check (public.is_admin() or public.is_editor());
drop policy if exists "events admin all" on public.events;
create policy "events admin all" on public.events for all to authenticated
  using (public.is_admin() or public.is_editor()) with check (public.is_admin() or public.is_editor());
drop policy if exists "event images admin select" on storage.objects;
create policy "event images admin select" on storage.objects for select to authenticated using (bucket_id = 'event-images' and (public.is_admin() or public.is_editor()));
drop policy if exists "event images admin insert" on storage.objects;
create policy "event images admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'event-images' and (public.is_admin() or public.is_editor()));
drop policy if exists "event images admin update" on storage.objects;
create policy "event images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'event-images' and (public.is_admin() or public.is_editor())) with check (bucket_id = 'event-images' and (public.is_admin() or public.is_editor()));
drop policy if exists "event images admin delete" on storage.objects;
create policy "event images admin delete" on storage.objects for delete to authenticated using (bucket_id = 'event-images' and (public.is_admin() or public.is_editor()));

-- The trail.
create table if not exists public.admin_activity (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text not null default '',
  action text not null check (action in ('created', 'edited', 'deleted')),
  area text not null,
  item_id text not null default '',
  item_title text not null default '',
  at timestamptz not null default now()
);
create index if not exists admin_activity_at_idx on public.admin_activity (at desc);
create index if not exists admin_activity_actor_idx on public.admin_activity (actor_id, at desc);
alter table public.admin_activity enable row level security;   -- no policies: written by the trigger, read by the owner functions below

create or replace function public.log_content_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
begin
  -- In a trigger, "old" does not exist for an insert and "new" does not exist for a delete, so pick by operation.
  if tg_op = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  if v_uid is not null and (public.is_admin() or public.is_editor()) then
    insert into public.admin_activity (actor_id, actor_name, action, area, item_id, item_title)
    values (v_uid, coalesce((select username from public.profiles where id = v_uid), ''),
      case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'edited' else 'deleted' end,
      tg_table_name, coalesce(v_row ->> 'id', ''), left(coalesce(nullif(v_row ->> 'title', ''), v_row ->> 'name', v_row ->> 'body', ''), 140));
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['billboard_posts', 'announcements', 'events', 'places', 'shops', 'ads', 'rewards', 'news_items'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists log_content_change on public.%I', t);
      execute format('create trigger log_content_change after insert or update or delete on public.%I for each row execute function public.log_content_change()', t);
    end if;
  end loop;
end $$;

-- Owner views: a summary per person, and the full list.
create or replace function public.owner_activity_summary(p_days integer default 30)
returns table (actor_id uuid, actor_name text, role text, created bigint, edited bigint, deleted bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select a.actor_id, max(a.actor_name)::text, max(p.role)::text,
      count(*) filter (where a.action = 'created')::bigint, count(*) filter (where a.action = 'edited')::bigint,
      count(*) filter (where a.action = 'deleted')::bigint, max(a.at)
    from public.admin_activity a left join public.profiles p on p.id = a.actor_id
    where a.at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
    group by a.actor_id order by max(a.at) desc;
end;
$$;
revoke all on function public.owner_activity_summary(integer) from public, anon;
grant execute on function public.owner_activity_summary(integer) to authenticated;

create or replace function public.owner_activity_list(p_actor uuid default null, p_limit integer default 60, p_offset integer default 0)
returns table (at timestamptz, actor_name text, action text, area text, item_title text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select a.at, a.actor_name::text, a.action::text, a.area::text, a.item_title::text
    from public.admin_activity a where p_actor is null or a.actor_id = p_actor
    order by a.at desc limit greatest(1, least(coalesce(p_limit, 60), 200)) offset greatest(0, coalesce(p_offset, 0));
end;
$$;
revoke all on function public.owner_activity_list(uuid, integer, integer) from public, anon;
grant execute on function public.owner_activity_list(uuid, integer, integer) to authenticated;

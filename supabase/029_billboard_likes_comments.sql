-- Update 030: likes and comments on Billboard posts.
-- Run once in the Supabase SQL Editor. Safe to run again.
-- Anyone can see like and comment counts and read comments. Signing in is needed to like or comment. A student can delete their
-- own comment; the owner, admins and Billboard editors can delete any comment.

create table if not exists public.billboard_likes (
  post_id uuid not null references public.billboard_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.billboard_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.billboard_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists billboard_comments_post_idx on public.billboard_comments (post_id, created_at desc);
create index if not exists billboard_comments_user_idx on public.billboard_comments (user_id, created_at desc);
alter table public.billboard_likes enable row level security;     -- all access goes through the functions below
alter table public.billboard_comments enable row level security;

-- Counts for a set of posts, and whether this person has liked each one.
create or replace function public.billboard_social(p_posts uuid[])
returns table (post_id uuid, likes bigint, comments bigint, liked boolean)
language sql stable security definer set search_path = public
as $$
  select p.id,
    (select count(*) from public.billboard_likes l where l.post_id = p.id),
    (select count(*) from public.billboard_comments c where c.post_id = p.id),
    coalesce(exists (select 1 from public.billboard_likes l where l.post_id = p.id and l.user_id = auth.uid()), false)
  from public.billboard_posts p where p.id = any (p_posts);
$$;
revoke all on function public.billboard_social(uuid[]) from public;
grant execute on function public.billboard_social(uuid[]) to anon, authenticated;

create or replace function public.toggle_billboard_like(p_post uuid)
returns table (liked boolean, likes bigint)
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sign in to like posts'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  if not exists (select 1 from public.billboard_posts where id = p_post and status = 'published') then raise exception 'That post is not available'; end if;
  if exists (select 1 from public.billboard_likes where post_id = p_post and user_id = v_user) then
    delete from public.billboard_likes where post_id = p_post and user_id = v_user;
    return query select false, (select count(*) from public.billboard_likes where post_id = p_post);
  else
    insert into public.billboard_likes (post_id, user_id) values (p_post, v_user) on conflict do nothing;
    return query select true, (select count(*) from public.billboard_likes where post_id = p_post);
  end if;
end;
$$;
revoke all on function public.toggle_billboard_like(uuid) from public, anon;
grant execute on function public.toggle_billboard_like(uuid) to authenticated;

create or replace function public.add_billboard_comment(p_post uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_id uuid;
begin
  if v_user is null then raise exception 'Sign in to comment'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  if length(v_body) < 1 or length(v_body) > 500 then raise exception 'Write a comment of 1 to 500 characters'; end if;
  if not exists (select 1 from public.billboard_posts where id = p_post and status = 'published') then raise exception 'That post is not available'; end if;
  if (select count(*) from public.billboard_comments where user_id = v_user and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'You are commenting too fast. Wait a moment';
  end if;
  insert into public.billboard_comments (post_id, user_id, body) values (p_post, v_user, v_body) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.add_billboard_comment(uuid, text) from public, anon;
grant execute on function public.add_billboard_comment(uuid, text) to authenticated;

create or replace function public.billboard_comments_for(p_post uuid, p_limit integer default 30)
returns table (id uuid, username text, body text, created_at timestamptz, mine boolean)
language sql stable security definer set search_path = public
as $$
  select c.id, p.username::text, c.body::text, c.created_at, (c.user_id = auth.uid())
  from public.billboard_comments c join public.profiles p on p.id = c.user_id
  where c.post_id = p_post order by c.created_at desc limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;
revoke all on function public.billboard_comments_for(uuid, integer) from public;
grant execute on function public.billboard_comments_for(uuid, integer) to anon, authenticated;

-- Staff are the owner, admins and (after 030) Billboard editors. Written without is_editor() so this file runs on its own.
create or replace function public.delete_billboard_comment(p_comment uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sign in first'; end if;
  delete from public.billboard_comments c
   where c.id = p_comment
     and (c.user_id = v_user or exists (select 1 from public.profiles where id = v_user and role in ('admin', 'owner', 'editor')));
end;
$$;
revoke all on function public.delete_billboard_comment(uuid) from public, anon;
grant execute on function public.delete_billboard_comment(uuid) to authenticated;

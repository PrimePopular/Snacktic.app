-- ============================================================================
-- Update 003: real names, the Owner role, and the Students list for the admin panel.
-- Run AFTER schema.sql and 002_auth_extras.sql. Safe to run more than once.
-- ============================================================================

-- Real name (only visible to the owner through the Students page).
alter table public.profiles add column if not exists full_name text not null default '';

-- Three roles: student, admin (helper: manages content) and owner (you: also sees students).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.profiles add constraint profiles_role_check check (role in ('student', 'admin', 'owner'));

-- Admins and the owner can manage content. Only the owner can see student details.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'owner'));
$$;

create or replace function public.is_owner()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

-- New accounts also record the real name from the sign-up form.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, marketing_opt_in)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'user_' || substr(replace(new.id::text, '-', ''), 1, 8)),
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''), 60),
    lower(coalesce(new.raw_user_meta_data ->> 'marketing_opt_in', 'false')) = 'true'
  );
  return new;
end;
$$;

-- The Students page. Reads emails from the secure accounts table. Owner only.
create or replace function public.admin_list_students()
returns table (
  id uuid,
  username text,
  full_name text,
  email text,
  joined_at timestamptz,
  last_sign_in_at timestamptz,
  role text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'Owner only';
  end if;
  return query
    select p.id, p.username, p.full_name, u.email::text, u.created_at, u.last_sign_in_at, p.role
    from public.profiles p
    join auth.users u on u.id = p.id
    order by u.created_at desc;
end;
$$;
revoke all on function public.admin_list_students() from public, anon;
grant execute on function public.admin_list_students() to authenticated;

-- ----------------------------------------------------------------------------
-- Make yourself the owner. Run this ONCE, with the email you signed up with:
--
--   update public.profiles set role = 'owner'
--   where id = (select id from auth.users where lower(email) = lower('YOUR_EMAIL'));
--
-- Then check it worked:
--
--   select username, role from public.profiles;
-- ----------------------------------------------------------------------------

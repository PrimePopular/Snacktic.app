-- ============================================================================
-- Update 002: sign-up extras. RUN THIS if you already ran schema.sql before.
-- (Fresh installs of the current schema.sql already include everything here.)
-- Safe to run more than once.
-- ============================================================================

-- Students can choose to receive news and offers by email. Off unless they tick it.
alter table public.profiles add column if not exists marketing_opt_in boolean not null default false;

-- Students may change their own username and their email preference, nothing else (never role).
revoke update on public.profiles from authenticated;
grant update (username, marketing_opt_in) on public.profiles to authenticated;

-- New accounts record the choice made on the sign-up form.
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

-- Lets the sign-up screen say "that username is taken" before creating the account.
create or replace function public.username_available(p_username text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(trim(p_username)));
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

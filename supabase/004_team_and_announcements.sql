-- ============================================================================
-- Update 004: Team management, announcement levels, and tighter helper-admin permissions.
-- Run AFTER 003_owner_and_students.sql. Safe to run more than once.
-- ============================================================================

-- Announcements have a level: major (pinned at the top of Home), medium (in the feed), minor (lower priority).
alter table public.announcements
  add column if not exists level text not null default 'medium'
  check (level in ('major', 'medium', 'minor'));

-- Helper admins manage CONTENT only (announcements, events, products, locations, stock).
-- Rewards, campaigns, settings and anything that moves points are owner-only.
drop policy if exists "rewards admin all" on public.rewards;
drop policy if exists "rewards owner all" on public.rewards;
create policy "rewards owner all" on public.rewards
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists "campaigns admin all" on public.campaigns;
drop policy if exists "campaigns owner all" on public.campaigns;
create policy "campaigns owner all" on public.campaigns
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists "settings admin all" on public.app_settings;
drop policy if exists "settings owner all" on public.app_settings;
create policy "settings owner all" on public.app_settings
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- Redeemed rewards and points adjustments: owner only (a helper must never be able to give points).
create or replace function public.admin_adjust_points(p_username text, p_amount integer, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  if p_amount is null or p_amount = 0 then raise exception 'Amount cannot be zero'; end if;
  select id into v_user from public.profiles where lower(username) = lower(trim(p_username));
  if v_user is null then raise exception 'No student with that username'; end if;
  insert into public.points_transactions (user_id, amount, kind, note)
    values (v_user, p_amount, 'admin_adjustment', coalesce(nullif(trim(p_note), ''), 'Adjustment by owner'));
end;
$$;

create or replace function public.admin_set_redemption_status(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_row public.redemptions%rowtype;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  if p_status not in ('fulfilled', 'cancelled') then raise exception 'Status must be fulfilled or cancelled'; end if;

  select * into v_row from public.redemptions where id = p_id for update;
  if not found then raise exception 'Redemption not found'; end if;
  if v_row.status <> 'pending' then raise exception 'Only pending redemptions can be changed'; end if;

  update public.redemptions set status = p_status, updated_at = now() where id = p_id;
  if p_status = 'cancelled' then
    insert into public.points_transactions (user_id, amount, kind, note)
      values (v_row.user_id, v_row.points_cost, 'admin_adjustment', 'Refund: redemption cancelled');
  end if;
end;
$$;

-- Give or take away helper-admin access by email. Owner only. The person must already have an account.
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
  if p_role not in ('admin', 'student') then raise exception 'Role must be admin or student'; end if;

  select u.id into v_id from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'No account with that email. They need to sign up first.';
  end if;

  select role, username into v_current, v_username from public.profiles where id = v_id;
  if v_current is null then
    raise exception 'No account with that email. They need to sign up first.';
  end if;
  if v_current = 'owner' then raise exception 'The owner role cannot be changed here'; end if;

  update public.profiles set role = p_role where id = v_id;
  return v_username;
end;
$$;
revoke all on function public.owner_set_role(text, text) from public, anon;
grant execute on function public.owner_set_role(text, text) to authenticated;

-- ============================================================================
-- Update 006: event contact details, announcement pictures, redemption list for the owner.
-- Run AFTER 005_events_categories_images.sql. Safe to run more than once.
-- ============================================================================

-- Events: who to contact. A link (for example WhatsApp) and/or a phone number.
alter table public.events add column if not exists contact_name text not null default '';
alter table public.events add column if not exists contact_phone text not null default '';
alter table public.events add column if not exists contact_link text not null default '';

alter table public.events drop constraint if exists events_contact_link_check;
alter table public.events add constraint events_contact_link_check
  check (contact_link = '' or contact_link ~* '^https?://');
alter table public.events drop constraint if exists events_contact_phone_check;
alter table public.events add constraint events_contact_phone_check
  check (contact_phone ~ '^[0-9+()\-\s]{0,25}$');

-- Announcements can have a picture (same picture storage as events).
alter table public.announcements add column if not exists image_path text;

-- The owner's list of reward redemptions, pending first.
create or replace function public.admin_list_redemptions()
returns table (
  id uuid,
  username text,
  reward_name text,
  points_cost integer,
  status text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'Owner only';
  end if;
  return query
    select r.id, p.username, w.name, r.points_cost, r.status, r.created_at
    from public.redemptions r
    join public.profiles p on p.id = r.user_id
    join public.rewards w on w.id = r.reward_id
    order by (r.status = 'pending') desc, r.created_at desc;
end;
$$;
revoke all on function public.admin_list_redemptions() from public, anon;
grant execute on function public.admin_list_redemptions() to authenticated;

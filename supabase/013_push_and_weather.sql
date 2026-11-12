-- ============================================================================
-- Update 013: phone push notifications and campus weather.
-- Run AFTER 012_find_a_friend_and_notifications.sql. Safe to run more than once.
-- Pushes are sent by two small Supabase Edge Functions (see docs/PUSH_SETUP.md). This file only
-- creates the table that remembers which phones to notify.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  weather boolean not null default true, -- this phone also gets the daily weather
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Only the student can see their own phones. The Edge Functions use the service role, which bypasses this.
alter table public.push_subscriptions enable row level security;
drop policy if exists "push subscriptions read own" on public.push_subscriptions;
create policy "push subscriptions read own" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if length(p_endpoint) > 1000 or p_endpoint !~ '^https://' then raise exception 'Invalid subscription'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values (auth.uid(), p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;
revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

create or replace function public.remove_push_subscription(p_endpoint text)
returns void
language sql security definer set search_path = public
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke all on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.remove_push_subscription(text) to authenticated;

create or replace function public.set_push_weather(p_endpoint text, p_on boolean)
returns void
language sql security definer set search_path = public
as $$
  update public.push_subscriptions set weather = p_on where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke all on function public.set_push_weather(text, boolean) from public, anon;
grant execute on function public.set_push_weather(text, boolean) to authenticated;

-- Campus location for the weather (set by the owner in the admin). Settings are readable by everyone.
insert into public.app_settings (key, value) values ('campus_name', '') on conflict (key) do nothing;
insert into public.app_settings (key, value) values ('campus_latitude', '') on conflict (key) do nothing;
insert into public.app_settings (key, value) values ('campus_longitude', '') on conflict (key) do nothing;

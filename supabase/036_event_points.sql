-- Update 033: Crumb Points for looking at an event.
-- Run once in the Supabase SQL Editor. Safe to run again.
--
-- The owner sets points on an event (0 means none). A signed-in student who opens the event and keeps it open for the set number of
-- seconds earns those points, once per event. The amount is not shown to students beforehand. The server runs the clock, so the app
-- cannot hurry it, and there is a daily limit so nobody can farm events.

alter table public.events add column if not exists points integer not null default 0 check (points between 0 and 50);
alter table public.reward_settings add column if not exists event_view_seconds integer not null default 3 check (event_view_seconds between 1 and 60);

alter table public.points_transactions drop constraint if exists points_transactions_kind_check;
alter table public.points_transactions add constraint points_transactions_kind_check check (kind in
  ('game_award', 'campaign_award', 'gift_sent', 'gift_received', 'redemption', 'admin_adjustment', 'ad_view', 'game_retry', 'game_purchase',
   'game_speed', 'treasure', 'signup_bonus', 'daily_login', 'event_view'));

create table if not exists public.event_opens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table public.event_opens enable row level security;

create table if not exists public.event_views (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  points_awarded integer not null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists event_views_user_idx on public.event_views (user_id, created_at desc);
alter table public.event_views enable row level security;

create or replace function public.begin_event_open(p_event uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  if not exists (select 1 from public.events where id = p_event) then return; end if;
  insert into public.event_opens (user_id, event_id, started_at) values (auth.uid(), p_event, now())
    on conflict (user_id, event_id) do update set started_at = now();
end;
$$;
revoke all on function public.begin_event_open(uuid) from public, anon;
grant execute on function public.begin_event_open(uuid) to authenticated;

create or replace function public.claim_event_points(p_event uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_event public.events%rowtype;
  v_seconds integer;
  v_inserted integer;
begin
  if v_user is null then raise exception 'Sign in to earn points'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  select * into v_event from public.events where id = p_event and published and expires_at > now();
  if not found or v_event.points <= 0 then return 0; end if;
  select coalesce((select event_view_seconds from public.reward_settings limit 1), 3) into v_seconds;

  -- The event must have been opened, and long enough ago (half a second of slack for a slow connection).
  if not exists (
    select 1 from public.event_opens o
    where o.user_id = v_user and o.event_id = p_event
      and o.started_at <= now() - make_interval(secs => greatest(0.5, v_seconds - 0.5))
      and o.started_at > now() - interval '30 minutes'
  ) then
    return 0;
  end if;

  -- A daily limit so nobody can farm events.
  if (select count(*) from public.event_views where user_id = v_user and created_at > now() - interval '24 hours') >= 20 then return 0; end if;

  insert into public.event_views (event_id, user_id, points_awarded) values (p_event, v_user, v_event.points)
    on conflict (event_id, user_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 0; end if;

  insert into public.points_transactions (user_id, amount, kind, note) values (v_user, v_event.points, 'event_view', 'Event: ' || left(v_event.name, 60));
  return v_event.points;
end;
$$;
revoke all on function public.claim_event_points(uuid) from public, anon;
grant execute on function public.claim_event_points(uuid) to authenticated;

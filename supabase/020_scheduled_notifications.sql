-- ============================================================================
-- Update 020: scheduled notifications with times set in the admin, weather for each student's own place, and an
-- announcements switch for students. Run AFTER 019_delivery_referrals_orders.sql. Safe to run more than once.
-- (Run 013 first if you have not: it creates the table of phones that receive notifications.)
-- ============================================================================

-- Each phone can also say where it is (rounded to about 10 km), so the morning weather is for that place.
alter table public.push_subscriptions add column if not exists latitude double precision;
alter table public.push_subscriptions add column if not exists longitude double precision;
alter table public.push_subscriptions add column if not exists place_name text not null default '';
alter table public.push_subscriptions add column if not exists general boolean not null default true; -- announcements from Snacktic

create or replace function public.set_push_location(p_endpoint text, p_lat double precision, p_lon double precision, p_name text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then raise exception 'Invalid location'; end if;
  update public.push_subscriptions
    set latitude = round(p_lat::numeric, 1)::double precision, longitude = round(p_lon::numeric, 1)::double precision, place_name = left(coalesce(p_name, ''), 80)
    where endpoint = p_endpoint and user_id = auth.uid();
end;
$$;
revoke all on function public.set_push_location(text, double precision, double precision, text) from public, anon;
grant execute on function public.set_push_location(text, double precision, double precision, text) to authenticated;

create or replace function public.set_push_pref(p_endpoint text, p_kind text, p_on boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_kind not in ('weather', 'prayer', 'games', 'products', 'general') then raise exception 'Unknown setting'; end if;
  execute format('update public.push_subscriptions set %I = $1 where endpoint = $2 and user_id = auth.uid()', p_kind)
    using p_on, p_endpoint;
end;
$$;
revoke all on function public.set_push_pref(text, text, boolean) from public, anon;
grant execute on function public.set_push_pref(text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- The schedule. The owner edits these rows in Admin, Daily notifications.
-- kind: weather (the message is written automatically for each student's place), prayer (opens the link), games, custom.
-- ---------------------------------------------------------------------------
create table if not exists public.scheduled_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('weather', 'prayer', 'games', 'custom')),
  title text not null check (length(title) between 1 and 80),
  body text not null default '' check (length(body) <= 300),
  link text not null default '' check (link = '' or link ~ '^/[a-z0-9/_-]*$' or link ~* '^https://'),
  send_time time not null,
  repeat text not null default 'daily' check (repeat in ('daily', 'weekdays', 'weekends')),
  start_date date,
  end_date date,
  valid_minutes integer not null default 30 check (valid_minutes between 5 and 720),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.scheduled_notifications enable row level security;
drop policy if exists "scheduled notifications owner all" on public.scheduled_notifications;
create policy "scheduled notifications owner all" on public.scheduled_notifications for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Which phone already received which notification today, so nobody gets it twice and big audiences are sent in small batches.
create table if not exists public.push_sent (
  schedule_id uuid not null references public.scheduled_notifications (id) on delete cascade,
  sub_id uuid not null references public.push_subscriptions (id) on delete cascade,
  day date not null,
  primary key (schedule_id, sub_id, day)
);
alter table public.push_sent enable row level security;

insert into public.app_settings (key, value) values ('notify_timezone', 'Africa/Lagos') on conflict (key) do nothing;

insert into public.scheduled_notifications (kind, title, body, link, send_time, repeat, enabled, valid_minutes)
  select 'weather', 'Good morning! Today''s weather', '', '/', '06:30', 'daily', true, 120
  where not exists (select 1 from public.scheduled_notifications where kind = 'weather');
insert into public.scheduled_notifications (kind, title, body, link, send_time, repeat, enabled, valid_minutes)
  select 'prayer', 'Time for prayers', 'Tap to open the school prayer link.', '', '12:00', 'daily', false, 30
  where not exists (select 1 from public.scheduled_notifications where kind = 'prayer');
insert into public.scheduled_notifications (kind, title, body, link, send_time, repeat, enabled, valid_minutes)
  select 'games', 'Time to play!', 'Today''s challenges are waiting. Play to win points and earn prizes!', '/games', '17:00', 'daily', true, 120
  where not exists (select 1 from public.scheduled_notifications where kind = 'games');

-- Cleanup also forgets old "already sent" records (and keeps everything else as before).
create or replace function public.run_cleanup()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_orders_days integer := coalesce(nullif((select value from public.app_settings where key = 'cleanup_orders_days'), '')::integer, 7);
  v_notes_days integer := coalesce(nullif((select value from public.app_settings where key = 'cleanup_notifications_days'), '')::integer, 30);
  v_plays_days integer := coalesce(nullif((select value from public.app_settings where key = 'cleanup_plays_days'), '')::integer, 30);
  v_orders integer;
  v_notes integer;
  v_plays integer;
  v_attempts integer;
begin
  delete from public.redemptions
    where status in ('fulfilled', 'cancelled') and updated_at < now() - make_interval(days => greatest(v_orders_days, 1));
  get diagnostics v_orders = row_count;

  delete from public.notifications where created_at < now() - make_interval(days => greatest(v_notes_days, 1));
  get diagnostics v_notes = row_count;

  delete from public.game_plays where played_at < now() - make_interval(days => greatest(v_plays_days, 2));
  get diagnostics v_plays = row_count;

  delete from public.game_attempts where started_at < now() - interval '7 days';
  get diagnostics v_attempts = row_count;

  delete from public.push_sent where day < current_date - 3;
  delete from public.ad_gates where started_at < now() - interval '2 days';

  return jsonb_build_object('orders', v_orders, 'notifications', v_notes, 'game_plays', v_plays, 'game_attempts', v_attempts);
end;
$$;
revoke all on function public.run_cleanup() from public, anon, authenticated;

-- ============================================================================
-- Ad metrics: how often each ad was seen and tapped (one small row per ad per day, so it uses almost no storage).
-- ============================================================================
create table if not exists public.ad_stats (
  ad_id uuid not null references public.ads (id) on delete cascade,
  day date not null default current_date,
  views integer not null default 0,
  clicks integer not null default 0,
  primary key (ad_id, day)
);
alter table public.ad_stats enable row level security;
drop policy if exists "ad stats owner read" on public.ad_stats;
create policy "ad stats owner read" on public.ad_stats for select to authenticated using (public.is_owner());

-- Anyone (even before signing up) can add a view or a tap. Only counters change, so there is nothing to abuse except the count.
create or replace function public.track_ad_event(p_ad uuid, p_kind text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_kind not in ('view', 'click') then return; end if;
  if not exists (select 1 from public.ads where id = p_ad) then return; end if;
  insert into public.ad_stats (ad_id, day, views, clicks)
    values (p_ad, current_date, case when p_kind = 'view' then 1 else 0 end, case when p_kind = 'click' then 1 else 0 end)
    on conflict (ad_id, day) do update
      set views = public.ad_stats.views + case when p_kind = 'view' then 1 else 0 end,
          clicks = public.ad_stats.clicks + case when p_kind = 'click' then 1 else 0 end;
end;
$$;
revoke all on function public.track_ad_event(uuid, text) from public;
grant execute on function public.track_ad_event(uuid, text) to anon, authenticated;

-- The owner's report: total and last-7-days views and taps, plus how many signed-in students were paid for seeing it.
create or replace function public.owner_ad_report()
returns table (ad_id uuid, views bigint, clicks bigint, views_7d bigint, clicks_7d bigint, signed_in_viewers bigint)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select a.id,
           coalesce(sum(s.views), 0)::bigint,
           coalesce(sum(s.clicks), 0)::bigint,
           coalesce(sum(s.views) filter (where s.day >= current_date - 6), 0)::bigint,
           coalesce(sum(s.clicks) filter (where s.day >= current_date - 6), 0)::bigint,
           (select count(*) from public.ad_views v where v.ad_id = a.id)
    from public.ads a
    left join public.ad_stats s on s.ad_id = a.id
    group by a.id;
end;
$$;
revoke all on function public.owner_ad_report() from public, anon;
grant execute on function public.owner_ad_report() to authenticated;

-- ============================================================================
-- Retrying a daily challenge: by watching an ad. Owner accounts can retry freely (so you can test the games).
-- ============================================================================
drop function if exists public.preview_game_attempt(text, text);
create or replace function public.preview_game_attempt(p_game_id text, p_mode text)
returns table (is_daily boolean, cost integer, tries_today integer, retries_left integer, ads_available boolean, owner_free boolean)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_rule public.game_rules%rowtype;
  v_tz text;
  v_start timestamptz;
  v_count integer;
begin
  if v_user is null then raise exception 'Sign in to earn points'; end if;
  select * into v_rule from public.game_rules where game_id = p_game_id and mode = p_mode and active;
  if not found or not v_rule.is_daily_challenge then
    return query select false, 0, 0, 0, false, false;
    return;
  end if;
  select coalesce((select value from public.app_settings where key = 'timezone'), 'UTC') into v_tz;
  v_start := date_trunc('day', now() at time zone v_tz) at time zone v_tz;
  select count(*) into v_count from public.game_attempts a
    where a.user_id = v_user and a.game_id = p_game_id and a.mode = p_mode and a.started_at >= v_start;
  return query select
    true,
    case when v_count = 0 then 0 else v_rule.retry_cost end,
    v_count,
    greatest(0, v_rule.max_retries - greatest(v_count - 1, 0)),
    exists (select 1 from public.ads ad where ad.published and (ad.ends_at is null or ad.ends_at > now())),
    public.is_owner();
end;
$$;
revoke all on function public.preview_game_attempt(text, text) from public, anon;
grant execute on function public.preview_game_attempt(text, text) to authenticated;

create or replace function public.start_game_attempt(p_game_id text, p_mode text, p_gate uuid default null)
returns table (attempt_id uuid, cost integer)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_rule public.game_rules%rowtype;
  v_tz text;
  v_start timestamptz;
  v_count integer;
  v_cost integer;
  v_balance integer;
  v_open uuid;
  v_id uuid;
  v_owner boolean := public.is_owner();
begin
  if v_user is null then raise exception 'Sign in to earn points'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  select * into v_rule from public.game_rules where game_id = p_game_id and mode = p_mode and active and is_daily_challenge;
  if not found then raise exception 'That game has no daily challenge right now'; end if;

  perform 1 from public.profiles where id = v_user for update;

  select a.id into v_open from public.game_attempts a
    where a.user_id = v_user and a.game_id = p_game_id and a.mode = p_mode and not a.used and a.started_at > now() - interval '10 minutes'
    order by a.started_at desc limit 1;
  if v_open is not null then
    return query select v_open, 0;
    return;
  end if;

  select coalesce((select value from public.app_settings where key = 'timezone'), 'UTC') into v_tz;
  v_start := date_trunc('day', now() at time zone v_tz) at time zone v_tz;
  select count(*) into v_count from public.game_attempts a
    where a.user_id = v_user and a.game_id = p_game_id and a.mode = p_mode and a.started_at >= v_start;
  if not v_owner and v_count >= 1 + v_rule.max_retries then raise exception 'No retries left today'; end if;

  if v_count = 0 or v_owner then
    v_cost := 0; -- the first try of the day is free, and the owner can always retry free
  elsif p_gate is not null then
    update public.ad_gates g set used = true
      where g.id = p_gate and g.user_id = v_user and g.game_id = p_game_id and g.mode = p_mode and not g.used
        and g.started_at <= now() - interval '14 seconds' and g.started_at > now() - interval '15 minutes';
    if not found then raise exception 'Watch the whole ad first'; end if;
    v_cost := 0;
  else
    v_cost := v_rule.retry_cost;
  end if;

  if v_cost > 0 then
    select coalesce(sum(t.amount), 0) into v_balance from public.points_transactions t where t.user_id = v_user;
    if v_balance < v_cost then raise exception 'Not enough Crumb Points to try again'; end if;
  end if;

  insert into public.game_attempts (user_id, game_id, mode, cost) values (v_user, p_game_id, p_mode, v_cost) returning id into v_id;
  if v_cost > 0 then
    insert into public.points_transactions (user_id, amount, kind, note)
      values (v_user, -v_cost, 'game_retry', 'Retry: ' || v_rule.title);
  end if;
  return query select v_id, v_cost;
end;
$$;
revoke all on function public.start_game_attempt(text, text, uuid) from public, anon;
grant execute on function public.start_game_attempt(text, text, uuid) to authenticated;

-- ============================================================================
-- Update 012: Find a Friend (QR event) and in-app notifications.
-- Run AFTER 011_shops_and_ads.sql. Safe to run more than once.
-- The owner starts and stops the event and sets the points. Every rule below is enforced here in the
-- database, so a changed app cannot cheat: each code can be scanned once, nobody scans their own code,
-- and if A found B then B cannot scan A back.
-- ============================================================================

-- Settings for the event live on the campaigns table (kind = 'find_a_friend').
alter table public.campaigns add column if not exists points_per_scan integer not null default 5;
alter table public.campaigns add column if not exists prize_first integer not null default 0;
alter table public.campaigns add column if not exists prize_second integer not null default 0;
alter table public.campaigns add column if not exists prize_third integer not null default 0;
alter table public.campaigns add column if not exists prizes_paid boolean not null default false;
alter table public.campaigns drop constraint if exists campaigns_find_friend_numbers;
alter table public.campaigns add constraint campaigns_find_friend_numbers check (
  points_per_scan between 0 and 100
  and prize_first between 0 and 1000 and prize_second between 0 and 1000 and prize_third between 0 and 1000
);

-- ---------------------------------------------------------------------------
-- In-app notifications (a message waiting for one student)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  body text not null default '' check (length(body) <= 400),
  link text not null default '' check (link = '' or link ~ '^/[a-z0-9/_-]*$'),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications read own" on public.notifications;
create policy "notifications read own" on public.notifications for select to authenticated using (user_id = auth.uid());

create or replace function public.mark_notifications_read()
returns void
language sql security definer set search_path = public
as $$
  update public.notifications set is_read = true where user_id = auth.uid() and not is_read;
$$;
revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- ---------------------------------------------------------------------------
-- Find a Friend tables
-- ---------------------------------------------------------------------------
create table if not exists public.find_friend_players (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique,
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create table if not exists public.find_friend_scans (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  scanner_id uuid not null references public.profiles (id) on delete cascade,
  found_id uuid not null references public.profiles (id) on delete cascade,
  points_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  check (scanner_id <> found_id),
  unique (campaign_id, found_id) -- each code can be scanned only once
);
create index if not exists find_friend_scans_scanner_idx on public.find_friend_scans (campaign_id, scanner_id);

alter table public.find_friend_players enable row level security;
alter table public.find_friend_scans enable row level security;
drop policy if exists "find friend players read own" on public.find_friend_players;
create policy "find friend players read own" on public.find_friend_players for select to authenticated using (user_id = auth.uid());
drop policy if exists "find friend scans read own" on public.find_friend_scans;
create policy "find friend scans read own" on public.find_friend_scans for select to authenticated
  using (scanner_id = auth.uid() or found_id = auth.uid());

-- The event that is on right now (switched on and between its start and end). Null when there is none.
create or replace function public.live_find_friend_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.campaigns
  where kind = 'find_a_friend' and active and now() >= starts_at and now() < ends_at
  order by starts_at desc limit 1;
$$;
revoke all on function public.live_find_friend_id() from public, anon;
grant execute on function public.live_find_friend_id() to authenticated;

-- Join: returns the student's personal code (the same one every time).
create or replace function public.join_find_a_friend()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_campaign uuid;
  v_code text;
begin
  if v_user is null then raise exception 'Sign in to join'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  v_campaign := public.live_find_friend_id();
  if v_campaign is null then raise exception 'There is no Find a Friend event right now'; end if;

  insert into public.find_friend_players (campaign_id, user_id, code)
    values (v_campaign, v_user, left(replace(gen_random_uuid()::text, '-', ''), 16))
    on conflict (campaign_id, user_id) do nothing;
  select code into v_code from public.find_friend_players where campaign_id = v_campaign and user_id = v_user;
  return v_code;
end;
$$;
revoke all on function public.join_find_a_friend() from public, anon;
grant execute on function public.join_find_a_friend() to authenticated;

-- Scan someone's code: pays the scanner and leaves the scanned student a message.
create or replace function public.scan_friend_code(p_code text)
returns table (awarded_points integer, found_nickname text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_campaign uuid;
  v_found uuid;
  v_points integer;
  v_name text;
begin
  if v_user is null then raise exception 'Sign in to join'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  v_campaign := public.live_find_friend_id();
  if v_campaign is null then raise exception 'There is no Find a Friend event right now'; end if;

  perform 1 from public.find_friend_players where campaign_id = v_campaign and user_id = v_user;
  if not found then raise exception 'Tap Join first to start finding friends'; end if;

  select user_id into v_found from public.find_friend_players
    where campaign_id = v_campaign and code = lower(trim(coalesce(p_code, '')));
  if v_found is null then raise exception 'That code is not part of this event'; end if;
  if v_found = v_user then raise exception 'That is your own code'; end if;
  if exists (select 1 from public.find_friend_scans where campaign_id = v_campaign and found_id = v_found) then
    raise exception 'That code has already been scanned';
  end if;
  if exists (select 1 from public.find_friend_scans where campaign_id = v_campaign and scanner_id = v_found and found_id = v_user) then
    raise exception 'That student already found you. Go find someone else!';
  end if;
  if (select suspended from public.profiles where id = v_found) then raise exception 'That student cannot be found right now'; end if;

  select points_per_scan into v_points from public.campaigns where id = v_campaign;
  begin
    insert into public.find_friend_scans (campaign_id, scanner_id, found_id, points_awarded)
      values (v_campaign, v_user, v_found, v_points);
  exception when unique_violation then
    raise exception 'That code has already been scanned';
  end;

  if v_points > 0 then
    insert into public.points_transactions (user_id, amount, kind, note)
      values (v_user, v_points, 'campaign_award', 'Find a Friend');
  end if;
  insert into public.notifications (user_id, title, body, link)
    values (v_found, 'You''ve been found!', 'Someone found you. Now go find a friend of your own.', '/find-a-friend');

  select username into v_name from public.profiles where id = v_found;
  return query select v_points, v_name;
end;
$$;
revoke all on function public.scan_friend_code(text) from public, anon;
grant execute on function public.scan_friend_code(text) to authenticated;

-- The friends this student has found in the live event.
create or replace function public.my_found_friends()
returns table (friend_name text, found_at timestamptz)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_campaign uuid := public.live_find_friend_id();
begin
  if auth.uid() is null or v_campaign is null then return; end if;
  return query
    select p.username, s.created_at
    from public.find_friend_scans s
    join public.profiles p on p.id = s.found_id
    where s.campaign_id = v_campaign and s.scanner_id = auth.uid()
    order by s.created_at desc;
end;
$$;
revoke all on function public.my_found_friends() from public, anon;
grant execute on function public.my_found_friends() to authenticated;

-- Who found the most friends. Students see the live event; the owner can see any event.
create or replace function public.find_friend_leaderboard(p_campaign uuid)
returns table (place bigint, player_name text, found_count bigint)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'Sign in to see the leaderboard'; end if;
  if p_campaign is distinct from public.live_find_friend_id() and not public.is_owner() then
    raise exception 'That event is over';
  end if;
  return query
    select row_number() over (order by count(*) desc, min(s.created_at) asc), p.username, count(*)
    from public.find_friend_scans s
    join public.profiles p on p.id = s.scanner_id
    where s.campaign_id = p_campaign
    group by p.id, p.username
    order by 1
    limit 20;
end;
$$;
revoke all on function public.find_friend_leaderboard(uuid) from public, anon;
grant execute on function public.find_friend_leaderboard(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Owner tools
-- ---------------------------------------------------------------------------
create or replace function public.owner_start_find_a_friend(
  p_name text, p_points integer, p_first integer, p_second integer, p_third integer, p_ends_at timestamptz
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  if p_ends_at is null or p_ends_at <= now() then raise exception 'Choose an end time in the future'; end if;
  update public.campaigns set active = false where kind = 'find_a_friend' and active;
  insert into public.campaigns (name, description, kind, starts_at, ends_at, active, points_per_scan, prize_first, prize_second, prize_third)
    values (left(coalesce(nullif(trim(p_name), ''), 'Find a Friend'), 120), '', 'find_a_friend', now(), p_ends_at, true,
            p_points, p_first, p_second, p_third)
    returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.owner_start_find_a_friend(text, integer, integer, integer, integer, timestamptz) from public, anon;
grant execute on function public.owner_start_find_a_friend(text, integer, integer, integer, integer, timestamptz) to authenticated;

create or replace function public.owner_set_find_friend_active(p_campaign uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  if p_active then
    if not exists (select 1 from public.campaigns where id = p_campaign and kind = 'find_a_friend' and ends_at > now()) then
      raise exception 'This event has already ended. Start a new one.';
    end if;
    update public.campaigns set active = false where kind = 'find_a_friend' and active and id <> p_campaign;
  end if;
  update public.campaigns set active = p_active where id = p_campaign and kind = 'find_a_friend';
end;
$$;
revoke all on function public.owner_set_find_friend_active(uuid, boolean) from public, anon;
grant execute on function public.owner_set_find_friend_active(uuid, boolean) to authenticated;

-- Pays the leaderboard prizes (first, second, third) once. Returns how many students were paid.
create or replace function public.owner_pay_find_friend_prizes(p_campaign uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_c public.campaigns%rowtype;
  r record;
  v_amount integer;
  v_paid integer := 0;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  select * into v_c from public.campaigns where id = p_campaign and kind = 'find_a_friend' for update;
  if not found then raise exception 'Event not found'; end if;
  if v_c.prizes_paid then raise exception 'Prizes were already paid'; end if;

  for r in
    select row_number() over (order by count(*) desc, min(s.created_at) asc) as place, s.scanner_id as uid
    from public.find_friend_scans s
    where s.campaign_id = p_campaign
    group by s.scanner_id
    order by 1
    limit 3
  loop
    v_amount := case r.place when 1 then v_c.prize_first when 2 then v_c.prize_second else v_c.prize_third end;
    if v_amount > 0 then
      insert into public.points_transactions (user_id, amount, kind, note)
        values (r.uid, v_amount, 'campaign_award', 'Find a Friend prize');
      insert into public.notifications (user_id, title, body, link)
        values (r.uid, 'You won a Find a Friend prize!', 'You finished in place ' || r.place || ' and earned ' || v_amount || ' Crumb Points.', '/rewards');
      v_paid := v_paid + 1;
    end if;
  end loop;

  update public.campaigns set prizes_paid = true where id = p_campaign;
  return v_paid;
end;
$$;
revoke all on function public.owner_pay_find_friend_prizes(uuid) from public, anon;
grant execute on function public.owner_pay_find_friend_prizes(uuid) to authenticated;

create or replace function public.owner_find_friend_overview()
returns table (
  campaign_id uuid, campaign_name text, is_active boolean, is_live boolean, starts_at timestamptz, ends_at timestamptz,
  points_per_scan integer, prize_first integer, prize_second integer, prize_third integer, prizes_paid boolean,
  players bigint, scans bigint
)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select c.id, c.name, c.active, (c.active and now() >= c.starts_at and now() < c.ends_at), c.starts_at, c.ends_at,
           c.points_per_scan, c.prize_first, c.prize_second, c.prize_third, c.prizes_paid,
           (select count(*) from public.find_friend_players pl where pl.campaign_id = c.id),
           (select count(*) from public.find_friend_scans sc where sc.campaign_id = c.id)
    from public.campaigns c
    where c.kind = 'find_a_friend'
    order by c.starts_at desc
    limit 10;
end;
$$;
revoke all on function public.owner_find_friend_overview() from public, anon;
grant execute on function public.owner_find_friend_overview() to authenticated;

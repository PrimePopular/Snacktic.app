-- ============================================================================
-- Update 014: daily challenges with paid retries, score milestones, and rules for Crumbly and Crumb Quest.
-- Run AFTER 013_push_and_weather.sql. Safe to run more than once.
--
--  * Daily challenge modes (is_daily_challenge = true): the first try each day is free, every extra try
--    costs "retry_cost" Crumb Points (the owner sets it). A try must be started on the server first, and the
--    result can only be paid for that try, once.
--  * Milestone modes: each score threshold pays its points ONCE per student, ever (for example 5,000 pays 10).
-- All amounts are editable by the owner in the admin (Game points, Game challenges).
-- ============================================================================

alter table public.game_rules add column if not exists retry_cost integer not null default 30 check (retry_cost >= 0);
alter table public.game_rules drop constraint if exists game_rules_award_type_check;
alter table public.game_rules add constraint game_rules_award_type_check check (award_type in ('fixed', 'by_score', 'milestones'));

alter table public.points_transactions drop constraint if exists points_transactions_kind_check;
alter table public.points_transactions add constraint points_transactions_kind_check check (kind in
  ('game_award', 'campaign_award', 'gift_sent', 'gift_received', 'redemption', 'admin_adjustment', 'ad_view', 'game_retry'));

-- Every daily try a student has started.
create table if not exists public.game_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null,
  mode text not null,
  cost integer not null default 0,
  used boolean not null default false,
  started_at timestamptz not null default now()
);
create index if not exists game_attempts_user_idx on public.game_attempts (user_id, game_id, mode, started_at);
alter table public.game_attempts enable row level security;
drop policy if exists "game attempts read own" on public.game_attempts;
create policy "game attempts read own" on public.game_attempts for select to authenticated using (user_id = auth.uid());

-- Score thresholds and what each pays (once per student).
create table if not exists public.game_milestones (
  game_id text not null,
  mode text not null,
  score integer not null check (score > 0),
  points integer not null check (points >= 0),
  primary key (game_id, mode, score)
);
create table if not exists public.game_milestone_claims (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null,
  mode text not null,
  score integer not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, game_id, mode, score)
);
alter table public.game_milestones enable row level security;
alter table public.game_milestone_claims enable row level security;
drop policy if exists "game milestones public read" on public.game_milestones;
create policy "game milestones public read" on public.game_milestones for select to anon, authenticated using (true);
drop policy if exists "game milestones owner all" on public.game_milestones;
create policy "game milestones owner all" on public.game_milestones for all to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists "game milestone claims read own" on public.game_milestone_claims;
create policy "game milestone claims read own" on public.game_milestone_claims for select to authenticated using (user_id = auth.uid());

-- What would a try cost right now? (Changes nothing.)
create or replace function public.preview_game_attempt(p_game_id text, p_mode text)
returns table (is_daily boolean, cost integer, tries_today integer)
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
    return query select false, 0, 0;
    return;
  end if;
  select coalesce((select value from public.app_settings where key = 'timezone'), 'UTC') into v_tz;
  v_start := date_trunc('day', now() at time zone v_tz) at time zone v_tz;
  select count(*) into v_count from public.game_attempts a
    where a.user_id = v_user and a.game_id = p_game_id and a.mode = p_mode and a.started_at >= v_start and a.cost >= 0;
  return query select true, case when v_count = 0 then 0 else v_rule.retry_cost end, v_count;
end;
$$;
revoke all on function public.preview_game_attempt(text, text) from public, anon;
grant execute on function public.preview_game_attempt(text, text) to authenticated;

-- Start a daily try. The first try each day is free, later ones cost retry_cost points.
-- If the last try was started in the last 10 minutes and never finished (for example the page reloaded), it is reused for free.
create or replace function public.start_game_attempt(p_game_id text, p_mode text)
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
  v_cost := case when v_count = 0 then 0 else v_rule.retry_cost end;

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
revoke all on function public.start_game_attempt(text, text) from public, anon;
grant execute on function public.start_game_attempt(text, text) to authenticated;

-- The one function that pays for a game result (same as before, plus daily tries and milestones).
create or replace function public.award_game_points(
  p_game_id text,
  p_client_id uuid,
  p_score integer,
  p_duration_ms integer,
  p_played_at timestamptz,
  p_mode text default 'default'
)
returns table (points integer, reason text)
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_mode text := coalesce(nullif(trim(p_mode), ''), 'default');
  v_rule public.game_rules%rowtype;
  v_existing public.game_plays%rowtype;
  v_attempt public.game_attempts%rowtype;
  v_tz text;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_plays integer;
  v_earned integer;
  v_base integer;
  v_award integer;
  v_played timestamptz := coalesce(p_played_at, now());
begin
  if v_user is null then raise exception 'Sign in to earn points'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  if p_client_id is null then raise exception 'That result is not valid'; end if;

  select * into v_existing from public.game_plays where user_id = v_user and client_id = p_client_id;
  if found then
    return query select v_existing.points_awarded, 'already_recorded'::text;
    return;
  end if;

  select * into v_rule from public.game_rules where game_id = p_game_id and mode = v_mode and active;
  if not found then raise exception 'That game is not giving points right now'; end if;

  if v_played > now() + interval '5 minutes' then raise exception 'That result is not valid'; end if;
  if v_played < now() - interval '24 hours' then raise exception 'That result is too old to claim'; end if;
  if p_score is null or p_score < 0 or p_score > v_rule.max_score then raise exception 'That score is not possible'; end if;
  if p_duration_ms is null or p_duration_ms < v_rule.min_duration_ms or p_duration_ms > v_rule.max_duration_ms then
    raise exception 'That result is not valid';
  end if;

  -- A daily challenge can only be paid for a try that was started on the server, once, and not faster than it could have been played.
  if v_rule.is_daily_challenge then
    select * into v_attempt from public.game_attempts
      where id = p_client_id and user_id = v_user and game_id = p_game_id and mode = v_mode for update;
    if not found then raise exception 'Start the challenge first'; end if;
    if v_attempt.used then
      return query select 0, 'already_recorded'::text;
      return;
    end if;
    if v_attempt.started_at < now() - interval '30 minutes' then raise exception 'That result is too old to claim'; end if;
    if p_duration_ms > (extract(epoch from (now() - v_attempt.started_at)) * 1000)::integer + 5000 then
      raise exception 'That result is not valid';
    end if;
  end if;

  if p_score < v_rule.min_score then
    return query select 0, 'score_too_low'::text;
    return;
  end if;

  perform 1 from public.profiles where id = v_user for update;

  select coalesce((select value from public.app_settings where key = 'timezone'), 'UTC') into v_tz;
  v_day_start := date_trunc('day', v_played at time zone v_tz) at time zone v_tz;
  v_day_end := v_day_start + interval '1 day';

  select count(*), coalesce(sum(g.points_awarded), 0) into v_plays, v_earned
    from public.game_plays g
    where g.user_id = v_user and g.game_id = p_game_id and g.mode = v_mode
      and g.played_at >= v_day_start and g.played_at < v_day_end;

  if v_rule.award_type = 'milestones' then
    select coalesce(sum(m.points), 0) into v_base
      from public.game_milestones m
      where m.game_id = p_game_id and m.mode = v_mode and m.score <= p_score
        and not exists (select 1 from public.game_milestone_claims c
                        where c.user_id = v_user and c.game_id = m.game_id and c.mode = m.mode and c.score = m.score);
    insert into public.game_milestone_claims (user_id, game_id, mode, score)
      select v_user, m.game_id, m.mode, m.score
      from public.game_milestones m
      where m.game_id = p_game_id and m.mode = v_mode and m.score <= p_score
      on conflict do nothing;
  elsif v_rule.award_type = 'by_score' then
    v_base := least(v_rule.max_round_award, floor(p_score * v_rule.points_per_score)::integer);
    if v_plays > 0 and not v_rule.is_daily_challenge then v_base := floor(v_base * v_rule.replay_percent / 100.0)::integer; end if;
  else
    v_base := case when v_plays = 0 then v_rule.daily_first_award else v_rule.replay_award end;
  end if;
  v_award := greatest(0, least(v_base, v_rule.daily_cap - v_earned));

  insert into public.game_plays (user_id, game_id, mode, client_id, score, duration_ms, played_at, points_awarded)
    values (v_user, p_game_id, v_mode, p_client_id, p_score, p_duration_ms, v_played, v_award);
  if v_rule.is_daily_challenge then
    update public.game_attempts set used = true where id = p_client_id;
  end if;

  if v_award > 0 then
    insert into public.points_transactions (user_id, amount, kind, note)
      values (v_user, v_award, 'game_award',
        v_rule.title || case when v_rule.mode_label <> '' then ' (' || v_rule.mode_label || ')' else '' end);
  end if;

  return query select
    v_award,
    case
      when v_award > 0 and v_rule.award_type = 'milestones' then 'milestone'
      when v_award > 0 and v_rule.is_daily_challenge then 'challenge'
      when v_award > 0 and v_plays = 0 then 'daily_first'
      when v_award > 0 then 'replay'
      when v_base = 0 then 'no_points'
      else 'cap_reached'
    end;
end;
$$;
revoke all on function public.award_game_points(text, uuid, integer, integer, timestamptz, text) from public, anon;
grant execute on function public.award_game_points(text, uuid, integer, integer, timestamptz, text) to authenticated;

-- Owner: replace the milestone list for one game mode. p_rows looks like [{"score":5000,"points":10}, ...]
create or replace function public.owner_set_game_milestones(p_game_id text, p_mode text, p_rows jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 20 then raise exception 'Use at most 20 milestones'; end if;
  delete from public.game_milestones where game_id = p_game_id and mode = p_mode;
  insert into public.game_milestones (game_id, mode, score, points)
    select p_game_id, p_mode, x.score, x.points from jsonb_to_recordset(p_rows) as x(score integer, points integer);
end;
$$;
revoke all on function public.owner_set_game_milestones(text, text, jsonb) from public, anon;
grant execute on function public.owner_set_game_milestones(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Starting rules for the two games. Safe defaults: change any of them in the admin.
-- ---------------------------------------------------------------------------
insert into public.game_rules (game_id, mode, mode_label, is_daily_challenge, title, active, award_type, daily_first_award, replay_award,
  points_per_score, max_round_award, replay_percent, min_score, daily_cap, max_score, min_duration_ms, max_duration_ms, retry_cost)
values
  ('crumbly', 'classic', 'Classic', false, 'Crumbly', true, 'milestones', 0, 0, 0, 0, 100, 0, 1000, 500000, 0, 400000, 30),
  ('crumbly', 'daily', 'Daily Challenge', true, 'Crumbly', true, 'by_score', 0, 0, 0.015, 150, 100, 100, 150, 500000, 0, 400000, 30),
  ('crumb-quest', 'classic-bake', 'Classic Bake', false, 'Crumb Quest', true, 'fixed', 2, 1, 0, 0, 100, 1, 6, 200, 0, 3600000, 30),
  ('crumb-quest', 'daily-quest', 'Daily Quest', true, 'Crumb Quest', true, 'by_score', 0, 0, 1, 150, 100, 1, 150, 150, 0, 1200000, 30)
on conflict (game_id, mode) do nothing;

insert into public.game_milestones (game_id, mode, score, points) values
  ('crumbly', 'classic', 5000, 10),
  ('crumbly', 'classic', 10000, 20),
  ('crumbly', 'classic', 20000, 30)
on conflict do nothing;

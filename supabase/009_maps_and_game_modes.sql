-- ============================================================================
-- Update 009: map coordinates for places, and game modes with score-based points.
-- Run AFTER 008_game_points.sql. Safe to run more than once.
-- ============================================================================

-- Places: optional map position. Both numbers or neither.
alter table public.places add column if not exists latitude double precision;
alter table public.places add column if not exists longitude double precision;
alter table public.places drop constraint if exists places_coords_valid;
alter table public.places add constraint places_coords_valid check (
  (latitude is null and longitude is null)
  or (latitude between -90 and 90 and longitude between -180 and 180)
);

-- Game rules are now per game AND mode (for example "practice" and "daily"), and points can depend on score.
alter table public.game_rules add column if not exists mode text not null default 'default';
alter table public.game_rules add column if not exists mode_label text not null default '';
alter table public.game_rules add column if not exists is_daily_challenge boolean not null default false;
alter table public.game_rules add column if not exists award_type text not null default 'fixed';
alter table public.game_rules add column if not exists points_per_score numeric(8, 3) not null default 0;
alter table public.game_rules add column if not exists max_round_award integer not null default 0;
alter table public.game_rules add column if not exists replay_percent integer not null default 100;
alter table public.game_rules add column if not exists min_score integer not null default 0;

alter table public.game_rules drop constraint if exists game_rules_award_type_check;
alter table public.game_rules add constraint game_rules_award_type_check check (award_type in ('fixed', 'by_score'));
alter table public.game_rules drop constraint if exists game_rules_mode_check;
alter table public.game_rules add constraint game_rules_mode_check check (mode ~ '^[a-z0-9-]{1,30}$');
alter table public.game_rules drop constraint if exists game_rules_numbers_check;
alter table public.game_rules add constraint game_rules_numbers_check check (
  points_per_score >= 0 and max_round_award >= 0 and replay_percent between 0 and 100 and min_score >= 0
);

-- The key becomes (game, mode). Existing rules keep working as mode "default".
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.game_rules'::regclass and conname = 'game_rules_pkey'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (game_id)'
  ) then
    alter table public.game_rules drop constraint game_rules_pkey;
    alter table public.game_rules add primary key (game_id, mode);
  end if;
end $$;

alter table public.game_plays add column if not exists mode text not null default 'default';
drop index if exists public.game_plays_user_game_idx;
create index if not exists game_plays_user_game_mode_idx on public.game_plays (user_id, game_id, mode, played_at);

-- The one function that pays for a game result, now mode-aware.
--  fixed:     first round of the day pays daily_first_award, replays pay replay_award
--  by_score:  a round pays floor(score x points_per_score), at most max_round_award; replays pay replay_percent of that
--  both:      scores below min_score pay nothing and do not count as a play; the day's total for the
--             game and mode never passes daily_cap; a result can be up to 24 hours old; the same result pays once
drop function if exists public.award_game_points(text, uuid, integer, integer, timestamptz);
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

  -- A loss (score under the minimum) pays nothing and must not use up the daily bonus.
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

  if v_rule.award_type = 'by_score' then
    v_base := least(v_rule.max_round_award, floor(p_score * v_rule.points_per_score)::integer);
    if v_plays > 0 then v_base := floor(v_base * v_rule.replay_percent / 100.0)::integer; end if;
  else
    v_base := case when v_plays = 0 then v_rule.daily_first_award else v_rule.replay_award end;
  end if;
  v_award := greatest(0, least(v_base, v_rule.daily_cap - v_earned));

  insert into public.game_plays (user_id, game_id, mode, client_id, score, duration_ms, played_at, points_awarded)
    values (v_user, p_game_id, v_mode, p_client_id, p_score, p_duration_ms, v_played, v_award);

  if v_award > 0 then
    insert into public.points_transactions (user_id, amount, kind, note)
      values (v_user, v_award, 'game_award',
        v_rule.title || case when v_rule.mode_label <> '' then ' (' || v_rule.mode_label || ')' else '' end);
  end if;

  return query select
    v_award,
    case
      when v_award > 0 and v_plays = 0 then 'daily_first'
      when v_award > 0 then 'replay'
      when v_base = 0 then 'no_points'
      else 'cap_reached'
    end;
end;
$$;
revoke all on function public.award_game_points(text, uuid, integer, integer, timestamptz, text) from public, anon;
grant execute on function public.award_game_points(text, uuid, integer, integer, timestamptz, text) to authenticated;

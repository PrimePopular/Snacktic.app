-- ============================================================================
-- Update 008: game points. Per-game reward rules (set by the owner), recorded plays, and the one
-- trusted function that awards points for a finished game.
-- Run AFTER 007_places.sql. Safe to run more than once.
-- ============================================================================

-- The time zone used to decide when a "day" ends for daily rewards. The owner sets it in the admin panel.
insert into public.app_settings (key, value) values ('timezone', 'UTC') on conflict (key) do nothing;

-- One row per game. Amounts start at 0 so NOTHING is awarded until the owner sets them.
create table if not exists public.game_rules (
  game_id text primary key check (game_id ~ '^[a-z0-9-]{2,40}$'),
  title text not null check (length(title) between 1 and 80),
  active boolean not null default true,
  daily_first_award integer not null default 0 check (daily_first_award >= 0),
  replay_award integer not null default 0 check (replay_award >= 0),
  daily_cap integer not null default 0 check (daily_cap >= 0),
  max_score integer not null check (max_score > 0),
  min_duration_ms integer not null default 0 check (min_duration_ms >= 0),
  max_duration_ms integer not null default 600000 check (max_duration_ms > 0),
  created_at timestamptz not null default now()
);

-- Every result the server has seen. client_id makes retries safe: the same result is never paid twice.
create table if not exists public.game_plays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null,
  client_id uuid not null,
  score integer not null,
  duration_ms integer not null,
  played_at timestamptz not null,
  points_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index if not exists game_plays_user_game_idx on public.game_plays (user_id, game_id, played_at);

alter table public.game_rules enable row level security;
alter table public.game_plays enable row level security;

drop policy if exists "game rules public read" on public.game_rules;
create policy "game rules public read" on public.game_rules
  for select to anon, authenticated using (active);
drop policy if exists "game rules owner all" on public.game_rules;
create policy "game rules owner all" on public.game_rules
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists "game plays read own or owner" on public.game_plays;
create policy "game plays read own or owner" on public.game_plays
  for select to authenticated using (user_id = auth.uid() or public.is_owner());
revoke all on public.game_plays from anon;
revoke insert, update, delete on public.game_plays from authenticated;

-- The ONLY way a game pays points. The phone reports a result; the server checks it and decides.
--  * the game must have an active rule
--  * the score must be possible and the time plausible
--  * a result can be up to 24 hours old (guests claim after signing up) but never from the future
--  * first completion of the day pays the daily amount, replays pay the smaller replay amount,
--    and the day's total for that game never passes the daily cap
--  * sending the same result twice pays once
create or replace function public.award_game_points(
  p_game_id text,
  p_client_id uuid,
  p_score integer,
  p_duration_ms integer,
  p_played_at timestamptz
)
returns table (points integer, reason text)
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
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

  -- Same result sent again (a retry): report what happened the first time.
  select * into v_existing from public.game_plays where user_id = v_user and client_id = p_client_id;
  if found then
    return query select v_existing.points_awarded, 'already_recorded'::text;
    return;
  end if;

  select * into v_rule from public.game_rules where game_id = p_game_id and active;
  if not found then raise exception 'That game is not giving points right now'; end if;

  if v_played > now() + interval '5 minutes' then raise exception 'That result is not valid'; end if;
  if v_played < now() - interval '24 hours' then raise exception 'That result is too old to claim'; end if;
  if p_score is null or p_score < 0 or p_score > v_rule.max_score then raise exception 'That score is not possible'; end if;
  if p_duration_ms is null or p_duration_ms < v_rule.min_duration_ms or p_duration_ms > v_rule.max_duration_ms then
    raise exception 'That result is not valid';
  end if;

  -- Lock this student so two results sent together cannot both count as "the first of the day".
  perform 1 from public.profiles where id = v_user for update;

  select coalesce((select value from public.app_settings where key = 'timezone'), 'UTC') into v_tz;
  v_day_start := date_trunc('day', v_played at time zone v_tz) at time zone v_tz;
  v_day_end := v_day_start + interval '1 day';

  select count(*), coalesce(sum(g.points_awarded), 0) into v_plays, v_earned
    from public.game_plays g
    where g.user_id = v_user and g.game_id = p_game_id and g.played_at >= v_day_start and g.played_at < v_day_end;

  v_base := case when v_plays = 0 then v_rule.daily_first_award else v_rule.replay_award end;
  v_award := greatest(0, least(v_base, v_rule.daily_cap - v_earned));

  insert into public.game_plays (user_id, game_id, client_id, score, duration_ms, played_at, points_awarded)
    values (v_user, p_game_id, p_client_id, p_score, p_duration_ms, v_played, v_award);

  if v_award > 0 then
    insert into public.points_transactions (user_id, amount, kind, note)
      values (v_user, v_award, 'game_award', v_rule.title);
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
revoke all on function public.award_game_points(text, uuid, integer, integer, timestamptz) from public, anon;
grant execute on function public.award_game_points(text, uuid, integer, integer, timestamptz) to authenticated;

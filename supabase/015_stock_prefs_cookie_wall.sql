-- ============================================================================
-- Update 015: reward stock (sold-out items), more notification choices, the Cookie Wall Race rules.
-- Run AFTER 014_game_challenges.sql. Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Rewards can now have a stock count. Empty = unlimited. 0 = sold out.
-- ---------------------------------------------------------------------------
alter table public.rewards add column if not exists stock integer check (stock is null or stock >= 0);

create or replace function public.redeem_reward(p_reward uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_balance integer;
  v_redemption uuid;
begin
  if v_user is null then raise exception 'Sign in to redeem rewards'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  if coalesce((select phone from public.profiles where id = v_user), '') = '' then
    raise exception 'Add your WhatsApp number first';
  end if;

  -- Locking the reward row means two students cannot both take the last one.
  select * into v_reward from public.rewards where id = p_reward and active for update;
  if not found then raise exception 'That reward is not available'; end if;
  if v_reward.stock is not null and v_reward.stock <= 0 then raise exception 'That reward is sold out'; end if;

  perform 1 from public.profiles where id = v_user for update;
  select coalesce(sum(amount), 0) into v_balance from public.points_transactions where user_id = v_user;
  if v_balance < v_reward.cost_points then raise exception 'Not enough Crumb Points'; end if;

  insert into public.redemptions (user_id, reward_id, points_cost)
    values (v_user, v_reward.id, v_reward.cost_points) returning id into v_redemption;
  insert into public.points_transactions (user_id, amount, kind, note)
    values (v_user, -v_reward.cost_points, 'redemption', 'Redeemed: ' || v_reward.name);
  if v_reward.stock is not null then
    update public.rewards set stock = stock - 1 where id = v_reward.id;
  end if;
  return v_redemption;
end;
$$;

-- Cancelling an order (owner only) refunds the points and puts the item back in stock.
create or replace function public.admin_set_redemption_status(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_row public.redemptions%rowtype;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_status not in ('fulfilled', 'cancelled') then raise exception 'Status must be fulfilled or cancelled'; end if;
  if p_status = 'cancelled' and not public.is_owner() then raise exception 'Owner only'; end if;

  select * into v_row from public.redemptions where id = p_id for update;
  if not found then raise exception 'Redemption not found'; end if;
  if v_row.status <> 'pending' then raise exception 'Only pending redemptions can be changed'; end if;

  update public.redemptions set status = p_status, updated_at = now() where id = p_id;
  if p_status = 'cancelled' then
    insert into public.points_transactions (user_id, amount, kind, note)
      values (v_row.user_id, v_row.points_cost, 'admin_adjustment', 'Refund: redemption cancelled');
    update public.rewards set stock = stock + 1 where id = v_row.reward_id and stock is not null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- A lost daily try now always uses up the try (fix to award_game_points from update 014).
-- ---------------------------------------------------------------------------
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
    -- A lost or empty daily try still uses up that try.
    if v_rule.is_daily_challenge then
      update public.game_attempts set used = true where id = p_client_id;
    end if;
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

-- ---------------------------------------------------------------------------
-- Notification choices: each phone can switch weather, prayer, games and new rewards on or off.
-- ---------------------------------------------------------------------------
alter table public.push_subscriptions add column if not exists prayer boolean not null default true;
alter table public.push_subscriptions add column if not exists games boolean not null default true;
alter table public.push_subscriptions add column if not exists products boolean not null default true;

create or replace function public.set_push_pref(p_endpoint text, p_kind text, p_on boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_kind not in ('weather', 'prayer', 'games', 'products') then raise exception 'Unknown setting'; end if;
  execute format('update public.push_subscriptions set %I = $1 where endpoint = $2 and user_id = auth.uid()', p_kind)
    using p_on, p_endpoint;
end;
$$;
revoke all on function public.set_push_pref(text, text, boolean) from public, anon;
grant execute on function public.set_push_pref(text, text, boolean) to authenticated;

-- Owner switches (Admin, Daily notifications). Settings are readable by everyone, so keep secrets out of them.
insert into public.app_settings (key, value) values ('prayer_enabled', 'false') on conflict (key) do nothing;
insert into public.app_settings (key, value) values ('prayer_link', '') on conflict (key) do nothing;
insert into public.app_settings (key, value) values ('games_enabled', 'true') on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Cookie Wall Race rules (a win is score 1, a loss is score 0). Levels 1 to 3 are casual, 4 and 5 are daily
-- challenges with a paid retry. Every amount can be changed in the admin.
-- ---------------------------------------------------------------------------
insert into public.game_rules (game_id, mode, mode_label, is_daily_challenge, title, active, award_type, daily_first_award, replay_award,
  points_per_score, max_round_award, replay_percent, min_score, daily_cap, max_score, min_duration_ms, max_duration_ms, retry_cost)
values
  ('cookie-wall', 'level-1', 'Level 1: Crumb', false, 'Cookie Wall Race', true, 'fixed', 1, 0, 0, 0, 100, 1, 1, 1, 0, 1800000, 30),
  ('cookie-wall', 'level-2', 'Level 2: Nibbler', false, 'Cookie Wall Race', true, 'fixed', 2, 0, 0, 0, 100, 1, 2, 1, 0, 1800000, 30),
  ('cookie-wall', 'level-3', 'Level 3: Snacker', false, 'Cookie Wall Race', true, 'fixed', 3, 0, 0, 0, 100, 1, 3, 1, 0, 1800000, 30),
  ('cookie-wall', 'level-4', 'Level 4: Gourmet (daily)', true, 'Cookie Wall Race', true, 'fixed', 40, 40, 0, 0, 100, 1, 40, 1, 0, 1800000, 30),
  ('cookie-wall', 'level-5', 'Level 5: Cookie Monster (daily)', true, 'Cookie Wall Race', true, 'fixed', 100, 100, 0, 0, 100, 1, 100, 1, 0, 1800000, 30)
on conflict (game_id, mode) do nothing;

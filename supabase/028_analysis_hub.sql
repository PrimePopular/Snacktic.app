-- Update 029 (part 2): the Analysis hub for the owner (overview, games, rewards, Find a Friend) and a better points flag.
-- Run once in the Supabase SQL Editor, after 024 and 027. Safe to run again. Owner only: every function checks is_owner().

-- Points per student, with a flag window you choose (hours) instead of a fixed 24. Replaces the 024 version.
drop function if exists public.admin_points_overview(text, text, integer, integer);
create or replace function public.admin_points_overview(
  p_search text default '', p_sort text default 'balance', p_limit integer default 50, p_offset integer default 0, p_window_hours integer default 4)
returns table (user_id uuid, username text, balance bigint, earned bigint, spent bigint, earned_window bigint, entries bigint, last_activity timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_search text := replace(replace(coalesce(trim(p_search), ''), '%', ''), '_', '');
  v_since timestamptz := now() - make_interval(hours => greatest(1, least(coalesce(p_window_hours, 4), 168)));
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select p.id, p.username::text,
      coalesce(sum(t.amount), 0)::bigint,
      coalesce(sum(t.amount) filter (where t.amount > 0), 0)::bigint,
      coalesce(-sum(t.amount) filter (where t.amount < 0), 0)::bigint,
      coalesce(sum(t.amount) filter (where t.amount > 0 and t.created_at > v_since), 0)::bigint,
      count(t.id)::bigint,
      max(t.created_at)
    from public.profiles p
    left join public.points_transactions t on t.user_id = p.id
    where v_search = '' or p.username ilike '%' || v_search || '%'
    group by p.id, p.username
    order by
      case when p_sort = 'earned_window' then coalesce(sum(t.amount) filter (where t.amount > 0 and t.created_at > v_since), 0) end desc nulls last,
      case when p_sort = 'earned' then coalesce(sum(t.amount) filter (where t.amount > 0), 0) end desc nulls last,
      case when p_sort = 'recent' then max(t.created_at) end desc nulls last,
      coalesce(sum(t.amount), 0) desc, p.username
    limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0));
end;
$$;
revoke all on function public.admin_points_overview(text, text, integer, integer, integer) from public, anon;
grant execute on function public.admin_points_overview(text, text, integer, integer, integer) to authenticated;

-- The headline numbers.
create or replace function public.admin_overview()
returns table (students bigint, new_7d bigint, active_24h bigint, active_15m bigint, plays_24h bigint, points_earned_24h bigint,
               points_spent_24h bigint, orders_7d bigint, friends_7d bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    (select count(distinct x.user_id) from (
        select user_id from public.points_transactions where created_at > now() - interval '24 hours'
        union select user_id from public.game_plays where created_at > now() - interval '24 hours') x),
    (select count(distinct x.user_id) from (
        select user_id from public.points_transactions where created_at > now() - interval '15 minutes'
        union select user_id from public.game_plays where created_at > now() - interval '15 minutes') x),
    (select count(*) from public.game_plays where created_at > now() - interval '24 hours'),
    (select coalesce(sum(amount), 0) from public.points_transactions where amount > 0 and created_at > now() - interval '24 hours')::bigint,
    (select coalesce(-sum(amount), 0) from public.points_transactions where amount < 0 and created_at > now() - interval '24 hours')::bigint,
    ((select count(*) from public.redemptions where created_at > now() - interval '7 days')
      + (select count(*) from public.digital_purchases where created_at > now() - interval '7 days')),
    (select count(*) from public.find_friend_referrals where created_at > now() - interval '7 days');
end;
$$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- Who plays what: per game and mode, how many plays, how many different players, today, right now (last 15 minutes), scores.
create or replace function public.admin_game_analytics(p_days integer default 30)
returns table (game_id text, mode text, plays bigint, players bigint, plays_today bigint, players_now bigint, avg_score numeric, best_score integer, points_paid bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select g.game_id::text, g.mode::text, count(*)::bigint, count(distinct g.user_id)::bigint,
      count(*) filter (where g.created_at >= date_trunc('day', now()))::bigint,
      count(distinct g.user_id) filter (where g.created_at > now() - interval '15 minutes')::bigint,
      round(avg(g.score), 1), max(g.score), coalesce(sum(g.points_awarded), 0)::bigint
    from public.game_plays g
    where g.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
    group by g.game_id, g.mode order by count(*) desc;
end;
$$;
revoke all on function public.admin_game_analytics(integer) from public, anon;
grant execute on function public.admin_game_analytics(integer) to authenticated;

-- The five most active players of each game (nickname only).
create or replace function public.admin_game_top_players(p_days integer default 30)
returns table (game_id text, username text, plays bigint, points bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select r.game_id, r.username, r.plays, r.points from (
      select g.game_id::text as game_id, p.username::text as username, count(*)::bigint as plays, coalesce(sum(g.points_awarded), 0)::bigint as points,
             row_number() over (partition by g.game_id order by count(*) desc, p.username) as rn
      from public.game_plays g join public.profiles p on p.id = g.user_id
      where g.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
      group by g.game_id, p.username) r
    where r.rn <= 5 order by r.game_id, r.rn;
end;
$$;
revoke all on function public.admin_game_top_players(integer) from public, anon;
grant execute on function public.admin_game_top_players(integer) to authenticated;

-- Rewards store: what is being redeemed.
create or replace function public.admin_reward_analytics(p_days integer default 30)
returns table (reward_name text, kind text, redemptions bigint, points_spent bigint, students bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select x.name, x.kind, count(*)::bigint, coalesce(sum(x.cost), 0)::bigint, count(distinct x.user_id)::bigint from (
      select r.reward_name::text as name, 'physical'::text as kind, r.points_cost as cost, r.user_id, r.created_at from public.redemptions r
      union all
      select d.title::text, 'digital'::text, d.points_cost, d.user_id, d.created_at from public.digital_purchases d) x
    where x.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
    group by x.name, x.kind order by count(*) desc;
end;
$$;
revoke all on function public.admin_reward_analytics(integer) from public, anon;
grant execute on function public.admin_reward_analytics(integer) to authenticated;

-- Find a Friend: results of each campaign.
create or replace function public.admin_friend_analytics()
returns table (campaign text, invites bigint, inviters bigint, points_paid bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select c.name::text, count(f.id)::bigint, count(distinct f.referrer_id)::bigint, coalesce(sum(f.points_awarded), 0)::bigint
    from public.campaigns c left join public.find_friend_referrals f on f.campaign_id = c.id
    group by c.id, c.name order by max(f.created_at) desc nulls last, c.name;
end;
$$;
revoke all on function public.admin_friend_analytics() from public, anon;
grant execute on function public.admin_friend_analytics() to authenticated;

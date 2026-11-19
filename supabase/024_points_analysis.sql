-- Update 029: Crumb Points analysis for the owner.
-- Run once in the Supabase SQL Editor. Safe to run again. Owner only: every function checks is_owner().
-- Everything is worked out from the transaction records (public.points_transactions), never from a stored balance alone,
-- so a suspicious balance can always be traced back to where each point came from.

create index if not exists points_transactions_created_idx on public.points_transactions (created_at desc);
create index if not exists points_transactions_kind_idx on public.points_transactions (kind, created_at desc);

-- One row per student: balance, how much earned and spent, the last 24 hours, and the last activity.
create or replace function public.admin_points_overview(
  p_search text default '', p_sort text default 'balance', p_limit integer default 50, p_offset integer default 0)
returns table (user_id uuid, username text, balance bigint, earned bigint, spent bigint, earned_24h bigint, entries bigint, last_activity timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_search text := replace(replace(coalesce(trim(p_search), ''), '%', ''), '_', '');
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select p.id, p.username::text,
      coalesce(sum(t.amount), 0)::bigint,
      coalesce(sum(t.amount) filter (where t.amount > 0), 0)::bigint,
      coalesce(-sum(t.amount) filter (where t.amount < 0), 0)::bigint,
      coalesce(sum(t.amount) filter (where t.amount > 0 and t.created_at > now() - interval '24 hours'), 0)::bigint,
      count(t.id)::bigint,
      max(t.created_at)
    from public.profiles p
    left join public.points_transactions t on t.user_id = p.id
    where v_search = '' or p.username ilike '%' || v_search || '%'
    group by p.id, p.username
    order by
      case when p_sort = 'earned_24h' then coalesce(sum(t.amount) filter (where t.amount > 0 and t.created_at > now() - interval '24 hours'), 0) end desc nulls last,
      case when p_sort = 'earned' then coalesce(sum(t.amount) filter (where t.amount > 0), 0) end desc nulls last,
      case when p_sort = 'recent' then max(t.created_at) end desc nulls last,
      coalesce(sum(t.amount), 0) desc, p.username
    limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0));
end;
$$;
revoke all on function public.admin_points_overview(text, text, integer, integer) from public, anon;
grant execute on function public.admin_points_overview(text, text, integer, integer) to authenticated;

-- Where points come from and go to, across everyone, for the last N days.
create or replace function public.admin_points_sources(p_days integer default 30)
returns table (kind text, earned bigint, spent bigint, entries bigint, students bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select t.kind::text,
      coalesce(sum(t.amount) filter (where t.amount > 0), 0)::bigint,
      coalesce(-sum(t.amount) filter (where t.amount < 0), 0)::bigint,
      count(*)::bigint, count(distinct t.user_id)::bigint
    from public.points_transactions t
    where t.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
    group by t.kind order by 2 desc;
end;
$$;
revoke all on function public.admin_points_sources(integer) from public, anon;
grant execute on function public.admin_points_sources(integer) to authenticated;

-- The full trail for one student, newest first.
create or replace function public.admin_user_points(p_user uuid, p_limit integer default 100)
returns table (created_at timestamptz, amount integer, kind text, note text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select t.created_at, t.amount, t.kind::text, t.note::text
    from public.points_transactions t where t.user_id = p_user
    order by t.created_at desc limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;
revoke all on function public.admin_user_points(uuid, integer) from public, anon;
grant execute on function public.admin_user_points(uuid, integer) to authenticated;

-- Update 029: advertiser-grade ad analytics.
-- Run once in the Supabase SQL Editor. Safe to run again. Owner only to read.
--
-- Adds what the plain counters could not tell: how many DIFFERENT people saw an ad (unique reach) and tapped it (unique clicks),
-- click-through rate, activity over time, and the Crumb Points paid for an ad. Example: one student sees an ad 5 times ->
-- 5 impressions, 1 unique reach. Tapping it twice -> 2 clicks, 1 unique click.
-- Privacy: the "who" is only a private key (the account id, or a random device id for visitors). It is never shown to anyone;
-- reports are totals only, so they are safe to send to an advertiser.

create table if not exists public.ad_reach (
  ad_id uuid not null references public.ads (id) on delete cascade,
  viewer_key text not null check (length(viewer_key) between 8 and 64),
  first_seen date not null default current_date,
  clicked boolean not null default false,
  primary key (ad_id, viewer_key)
);
alter table public.ad_reach enable row level security;   -- no policies: only the functions below can read or write it

-- Same as track_ad_event(uuid, text), plus a private viewer key for unique counts. Visitors pass a random device id.
create or replace function public.track_ad_event(p_ad uuid, p_kind text, p_viewer text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_key text := coalesce(auth.uid()::text, nullif(left(coalesce(p_viewer, ''), 64), ''));
begin
  perform public.track_ad_event(p_ad, p_kind);
  if v_key is null or length(v_key) < 8 or p_kind not in ('view', 'click') then return; end if;
  if not exists (select 1 from public.ads where id = p_ad) then return; end if;
  insert into public.ad_reach (ad_id, viewer_key, clicked) values (p_ad, v_key, p_kind = 'click')
    on conflict (ad_id, viewer_key) do update set clicked = public.ad_reach.clicked or (p_kind = 'click');
end;
$$;
revoke all on function public.track_ad_event(uuid, text, text) from public;
grant execute on function public.track_ad_event(uuid, text, text) to anon, authenticated;

-- One row per ad: impressions, unique reach, clicks, unique clicks, CTR, points paid, how many students were paid.
create or replace function public.owner_ad_analytics(p_days integer default 3650)
returns table (ad_id uuid, impressions bigint, reach bigint, clicks bigint, unique_clicks bigint, ctr numeric, points_paid bigint, students_paid bigint)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_from date := current_date - greatest(1, least(coalesce(p_days, 3650), 3650)) + 1;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select a.id,
      coalesce((select sum(s.views) from public.ad_stats s where s.ad_id = a.id and s.day >= v_from), 0)::bigint,
      (select count(*) from public.ad_reach r where r.ad_id = a.id and r.first_seen >= v_from),
      coalesce((select sum(s.clicks) from public.ad_stats s where s.ad_id = a.id and s.day >= v_from), 0)::bigint,
      (select count(*) from public.ad_reach r where r.ad_id = a.id and r.clicked and r.first_seen >= v_from),
      case when coalesce((select sum(s.views) from public.ad_stats s where s.ad_id = a.id and s.day >= v_from), 0) = 0 then 0
           else round(100.0 * coalesce((select sum(s.clicks) from public.ad_stats s where s.ad_id = a.id and s.day >= v_from), 0)
                      / (select sum(s.views) from public.ad_stats s where s.ad_id = a.id and s.day >= v_from), 1) end,
      coalesce((select sum(v.points_awarded) from public.ad_views v where v.ad_id = a.id), 0)::bigint,
      (select count(*) from public.ad_views v where v.ad_id = a.id and v.points_awarded > 0)
    from public.ads a;
end;
$$;
revoke all on function public.owner_ad_analytics(integer) from public, anon;
grant execute on function public.owner_ad_analytics(integer) to authenticated;

-- Activity over time for one ad.
create or replace function public.owner_ad_daily(p_ad uuid, p_days integer default 30)
returns table (day date, views bigint, clicks bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select s.day, s.views::bigint, s.clicks::bigint from public.ad_stats s
    where s.ad_id = p_ad and s.day >= current_date - greatest(1, least(coalesce(p_days, 30), 365)) + 1
    order by s.day;
end;
$$;
revoke all on function public.owner_ad_daily(uuid, integer) from public, anon;
grant execute on function public.owner_ad_daily(uuid, integer) to authenticated;

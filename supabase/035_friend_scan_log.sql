-- Update 032 (part 3): a permanent record of every Find a Friend scan, including the ones that did not earn a reward.
-- Run once in the Supabase SQL Editor, after 021. Safe to run again.
-- Each time someone opens an invite link while signed in, the outcome is recorded: rewarded, already invited, a person
-- scanning themselves, a daily or lifetime limit, no event running, or a code that does not exist.

create table if not exists public.find_friend_scan_log (
  id bigint generated always as identity primary key,
  campaign_id uuid,
  referrer_id uuid references public.profiles (id) on delete set null,
  scanner_id uuid references public.profiles (id) on delete set null,
  outcome text not null,
  created_at timestamptz not null default now()
);
create index if not exists find_friend_scan_log_at_idx on public.find_friend_scan_log (created_at desc);
create index if not exists find_friend_scan_log_pair_idx on public.find_friend_scan_log (referrer_id, scanner_id);
alter table public.find_friend_scan_log enable row level security;   -- written by claim_referral, read by the owner function below

create or replace function public.log_friend_scan(p_campaign uuid, p_referrer uuid, p_scanner uuid, p_outcome text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.find_friend_scan_log (campaign_id, referrer_id, scanner_id, outcome) values (p_campaign, p_referrer, p_scanner, left(p_outcome, 30));
end;
$$;
revoke all on function public.log_friend_scan(uuid, uuid, uuid, text) from public, anon, authenticated;

create or replace function public.claim_referral(p_code text)
returns table (awarded_points integer, referrer_nickname text, result text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_campaign uuid;
  v_referrer uuid;
  v_points integer;
  v_cap integer;
  v_daily integer;
  v_lifetime integer;
  v_tz text;
  v_day_start timestamptz;
  v_name text;
begin
  if v_user is null then raise exception 'Sign in first'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;

  v_campaign := public.live_find_friend_id();
  if v_campaign is null then
    perform public.log_friend_scan(v_campaign, v_referrer, v_user, 'no_event');
    return query select 0, null::text, 'no_event'::text;
    return;
  end if;

  select pl.user_id into v_referrer from public.find_friend_players pl
    where pl.campaign_id = v_campaign and pl.code = lower(trim(coalesce(p_code, '')));
  if v_referrer is null or (select suspended from public.profiles where id = v_referrer) then
    perform public.log_friend_scan(v_campaign, v_referrer, v_user, 'invalid');
    return query select 0, null::text, 'invalid'::text;
    return;
  end if;
  select username into v_name from public.profiles where id = v_referrer;
  if v_referrer = v_user then
    perform public.log_friend_scan(v_campaign, v_referrer, v_user, 'self');
    return query select 0, v_name, 'self'::text;
    return;
  end if;
  -- Permanent record: this person has been invited before (in this event or an earlier one).
  if exists (select 1 from public.find_friend_referrals where referred_id = v_user) then
    perform public.log_friend_scan(v_campaign, v_referrer, v_user, 'already_referred');
    return query select 0, v_name, 'already_referred'::text;
    return;
  end if;

  select points_per_scan, referral_cap, daily_limit, lifetime_limit into v_points, v_cap, v_daily, v_lifetime
    from public.campaigns where id = v_campaign;
  select coalesce((select value from public.app_settings where key = 'timezone'), 'UTC') into v_tz;
  v_day_start := date_trunc('day', now() at time zone v_tz) at time zone v_tz;

  if (select count(*) from public.find_friend_referrals where campaign_id = v_campaign and referrer_id = v_referrer) >= v_cap
     or (select count(*) from public.find_friend_referrals where referrer_id = v_referrer and created_at >= v_day_start) >= v_daily
     or (select count(*) from public.find_friend_referrals where referrer_id = v_referrer) >= v_lifetime then
    perform public.log_friend_scan(v_campaign, v_referrer, v_user, 'limit');
    return query select 0, v_name, 'limit'::text;
    return;
  end if;

  begin
    insert into public.find_friend_referrals (campaign_id, referrer_id, referred_id, points_awarded) values (v_campaign, v_referrer, v_user, v_points);
  exception when unique_violation then
    perform public.log_friend_scan(v_campaign, v_referrer, v_user, 'already_referred');
    return query select 0, v_name, 'already_referred'::text;
    return;
  end;

  if v_points > 0 then
    insert into public.points_transactions (user_id, amount, kind, note) values (v_referrer, v_points, 'campaign_award', 'Find a Friend');
  end if;
  insert into public.notifications (user_id, title, body, link)
    values (v_referrer, 'Someone joined through your code!', (select username from public.profiles where id = v_user) || ' joined Snacktic. Keep inviting friends.', '/find-a-friend');
  perform public.log_friend_scan(v_campaign, v_referrer, v_user, 'rewarded');
  return query select v_points, v_name, 'rewarded'::text;
end;
$$;
revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

create or replace function public.owner_friend_scan_log(p_limit integer default 60, p_offset integer default 0)
returns table (at timestamptz, referrer text, scanner text, outcome text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return query
    select l.created_at, coalesce(r.username, '')::text, coalesce(s.username, '')::text, l.outcome::text
    from public.find_friend_scan_log l
    left join public.profiles r on r.id = l.referrer_id
    left join public.profiles s on s.id = l.scanner_id
    order by l.created_at desc limit greatest(1, least(coalesce(p_limit, 60), 200)) offset greatest(0, coalesce(p_offset, 0));
end;
$$;
revoke all on function public.owner_friend_scan_log(integer, integer) from public, anon;
grant execute on function public.owner_friend_scan_log(integer, integer) to authenticated;

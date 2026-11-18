-- ============================================================================
-- Update 021: ads pay only after the ad has been opened and looked at for about 3 seconds (checked here, on the server),
-- and Find a Friend invites are remembered for good with daily and lifetime limits.
-- Run AFTER 020_scheduled_notifications.sql. Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Ad engagement. Opening an ad starts a clock on the server. The reward is only paid if the claim comes at least about
-- 3 seconds later (2.5 allows for a slow connection), and still only once per student per ad.
-- ---------------------------------------------------------------------------
create table if not exists public.ad_opens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  ad_id uuid not null references public.ads (id) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (user_id, ad_id)
);
alter table public.ad_opens enable row level security;

create or replace function public.begin_ad_open(p_ad uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  if not exists (select 1 from public.ads where id = p_ad) then return; end if;
  insert into public.ad_opens (user_id, ad_id, started_at) values (auth.uid(), p_ad, now())
    on conflict (user_id, ad_id) do update set started_at = now();
end;
$$;
revoke all on function public.begin_ad_open(uuid) from public, anon;
grant execute on function public.begin_ad_open(uuid) to authenticated;

create or replace function public.claim_ad_points(p_ad_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ad public.ads%rowtype;
  v_inserted integer;
begin
  if v_user is null then raise exception 'Sign in to earn points'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;

  select * into v_ad from public.ads
    where id = p_ad_id and published and (ends_at is null or ends_at > now());
  if not found then return 0; end if;

  -- The ad must have been opened, and long enough ago.
  if not exists (
    select 1 from public.ad_opens o
    where o.user_id = v_user and o.ad_id = p_ad_id
      and o.started_at <= now() - interval '2500 milliseconds'
      and o.started_at > now() - interval '30 minutes'
  ) then
    return 0;
  end if;

  insert into public.ad_views (ad_id, user_id, points_awarded) values (p_ad_id, v_user, v_ad.points)
    on conflict (ad_id, user_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 0; end if;

  if v_ad.points > 0 then
    insert into public.points_transactions (user_id, amount, kind, note)
      values (v_user, v_ad.points, 'ad_view', 'Ad: ' || left(v_ad.title, 60));
  end if;
  return v_ad.points;
end;
$$;
revoke all on function public.claim_ad_points(uuid) from public, anon;
grant execute on function public.claim_ad_points(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Find a Friend: a person can only ever be invited once (across every event, even after the event restarts), and each
-- inviter has a daily limit and a lifetime limit the owner sets when starting an event.
-- ---------------------------------------------------------------------------
alter table public.campaigns add column if not exists daily_limit integer not null default 20 check (daily_limit between 1 and 1000);
alter table public.campaigns add column if not exists lifetime_limit integer not null default 100 check (lifetime_limit between 1 and 100000);

-- If anyone was invited in two events, keep the first.
delete from public.find_friend_referrals a using public.find_friend_referrals b
  where a.referred_id = b.referred_id and (a.created_at > b.created_at or (a.created_at = b.created_at and a.id > b.id));
create unique index if not exists find_friend_referrals_once_ever on public.find_friend_referrals (referred_id);

drop function if exists public.owner_start_find_a_friend(text, integer, integer, integer, integer, timestamptz);
create or replace function public.owner_start_find_a_friend(
  p_name text, p_points integer, p_first integer, p_second integer, p_third integer, p_ends_at timestamptz,
  p_daily integer default 20, p_lifetime integer default 100
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  if p_ends_at is null or p_ends_at <= now() then raise exception 'Choose an end time in the future'; end if;
  update public.campaigns set active = false where kind = 'find_a_friend' and active;
  insert into public.campaigns (name, description, kind, starts_at, ends_at, active, points_per_scan, prize_first, prize_second, prize_third, daily_limit, lifetime_limit)
    values (left(coalesce(nullif(trim(p_name), ''), 'Find a Friend'), 120), '', 'find_a_friend', now(), p_ends_at, true,
            p_points, p_first, p_second, p_third, greatest(1, least(coalesce(p_daily, 20), 1000)), greatest(1, least(coalesce(p_lifetime, 100), 100000)))
    returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.owner_start_find_a_friend(text, integer, integer, integer, integer, timestamptz, integer, integer) from public, anon;
grant execute on function public.owner_start_find_a_friend(text, integer, integer, integer, integer, timestamptz, integer, integer) to authenticated;

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
    return query select 0, null::text, 'no_event'::text;
    return;
  end if;

  select pl.user_id into v_referrer from public.find_friend_players pl
    where pl.campaign_id = v_campaign and pl.code = lower(trim(coalesce(p_code, '')));
  if v_referrer is null or (select suspended from public.profiles where id = v_referrer) then
    return query select 0, null::text, 'invalid'::text;
    return;
  end if;
  select username into v_name from public.profiles where id = v_referrer;
  if v_referrer = v_user then
    return query select 0, v_name, 'self'::text;
    return;
  end if;
  -- Permanent record: this person has been invited before (in this event or an earlier one).
  if exists (select 1 from public.find_friend_referrals where referred_id = v_user) then
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
    return query select 0, v_name, 'limit'::text;
    return;
  end if;

  begin
    insert into public.find_friend_referrals (campaign_id, referrer_id, referred_id, points_awarded) values (v_campaign, v_referrer, v_user, v_points);
  exception when unique_violation then
    return query select 0, v_name, 'already_referred'::text;
    return;
  end;

  if v_points > 0 then
    insert into public.points_transactions (user_id, amount, kind, note) values (v_referrer, v_points, 'campaign_award', 'Find a Friend');
  end if;
  insert into public.notifications (user_id, title, body, link)
    values (v_referrer, 'Someone joined through your code!', (select username from public.profiles where id = v_user) || ' joined Snacktic. Keep inviting friends.', '/find-a-friend');
  return query select v_points, v_name, 'rewarded'::text;
end;
$$;
revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

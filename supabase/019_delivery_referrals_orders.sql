-- ============================================================================
-- Update 019: deleting rewards that have handed-over orders, delivery only to approved places, Find a Friend as an
-- invite link, and a message whenever someone receives points.
-- Run AFTER 018_ebooks_ad_retries_feedback.sql. Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Orders keep their own copy of the reward name, so a reward can be deleted even after it has been ordered.
-- ---------------------------------------------------------------------------
alter table public.redemptions add column if not exists reward_name text;
update public.redemptions r set reward_name = w.name from public.rewards w where w.id = r.reward_id and r.reward_name is null;
alter table public.redemptions alter column reward_id drop not null;
do $$
declare c text;
begin
  -- Drop whatever the old link to rewards was called, then make a new one that lets a reward be deleted.
  for c in select conname from pg_constraint
           where conrelid = 'public.redemptions'::regclass and contype = 'f' and confrelid = 'public.rewards'::regclass
  loop
    execute format('alter table public.redemptions drop constraint %I', c);
  end loop;
end $$;
alter table public.redemptions add constraint redemptions_reward_id_fkey foreign key (reward_id) references public.rewards (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Delivery locations. Right now only Godfrey Okoye University. The owner adds, switches off or removes places in the admin.
-- ---------------------------------------------------------------------------
create table if not exists public.delivery_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 2 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.delivery_locations enable row level security;
drop policy if exists "delivery locations public read" on public.delivery_locations;
create policy "delivery locations public read" on public.delivery_locations for select to anon, authenticated using (active);
drop policy if exists "delivery locations owner all" on public.delivery_locations;
create policy "delivery locations owner all" on public.delivery_locations for all to authenticated using (public.is_owner()) with check (public.is_owner());

insert into public.delivery_locations (name, active)
  select 'Godfrey Okoye University (GOUNI)', true
  where not exists (select 1 from public.delivery_locations);

create table if not exists public.delivery_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  place text not null check (length(place) between 2 and 120),
  note text not null default '' check (length(note) <= 300),
  status text not null default 'new' check (status in ('new', 'added', 'declined')),
  created_at timestamptz not null default now()
);
alter table public.delivery_requests enable row level security;
drop policy if exists "delivery requests owner all" on public.delivery_requests;
create policy "delivery requests owner all" on public.delivery_requests for all to authenticated using (public.is_owner()) with check (public.is_owner());

create or replace function public.request_delivery_location(p_place text, p_note text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sign in to ask for a new delivery place'; end if;
  if length(trim(coalesce(p_place, ''))) < 2 then raise exception 'Please type the place'; end if;
  if (select count(*) from public.delivery_requests where user_id = v_user and created_at > now() - interval '1 day') >= 3 then
    raise exception 'You have asked a few times today. Please try again tomorrow';
  end if;
  insert into public.delivery_requests (user_id, place, note) values (v_user, left(trim(p_place), 120), left(coalesce(p_note, ''), 300));
  insert into public.notifications (user_id, title, body, link)
    select p.id, 'New delivery request', left(trim(p_place), 120), '' from public.profiles p where p.role = 'owner';
end;
$$;
revoke all on function public.request_delivery_location(text, text) from public, anon;
grant execute on function public.request_delivery_location(text, text) to authenticated;

alter table public.redemptions add column if not exists delivery_location_id uuid references public.delivery_locations (id) on delete set null;
alter table public.redemptions add column if not exists delivery_location_name text;

-- A physical reward can only be ordered for an approved delivery place. The server checks it, not just the app.
drop function if exists public.redeem_reward(uuid);
create or replace function public.redeem_reward(p_reward uuid, p_location uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_loc public.delivery_locations%rowtype;
  v_balance integer;
  v_redemption uuid;
begin
  if v_user is null then raise exception 'Sign in to redeem rewards'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  if coalesce((select phone from public.profiles where id = v_user), '') = '' then
    raise exception 'Add your WhatsApp number first';
  end if;

  select * into v_loc from public.delivery_locations where id = p_location and active;
  if not found then raise exception 'Delivery is not available to that place'; end if;

  select * into v_reward from public.rewards where id = p_reward and active for update;
  if not found then raise exception 'That reward is not available'; end if;
  if v_reward.kind = 'digital' then raise exception 'That reward is an ebook. Use Get ebook.'; end if;
  if v_reward.stock is not null and v_reward.stock <= 0 then raise exception 'That reward is sold out'; end if;

  perform 1 from public.profiles where id = v_user for update;
  select coalesce(sum(amount), 0) into v_balance from public.points_transactions where user_id = v_user;
  if v_balance < v_reward.cost_points then raise exception 'Not enough Crumb Points'; end if;

  insert into public.redemptions (user_id, reward_id, points_cost, reward_name, delivery_location_id, delivery_location_name)
    values (v_user, v_reward.id, v_reward.cost_points, v_reward.name, v_loc.id, v_loc.name) returning id into v_redemption;
  insert into public.points_transactions (user_id, amount, kind, note)
    values (v_user, -v_reward.cost_points, 'redemption', 'Redeemed: ' || v_reward.name);
  if v_reward.stock is not null then
    update public.rewards set stock = stock - 1 where id = v_reward.id;
  end if;
  return v_redemption;
end;
$$;
revoke all on function public.redeem_reward(uuid, uuid) from public, anon;
grant execute on function public.redeem_reward(uuid, uuid) to authenticated;

-- The owner's order list: shows the saved reward name even if the reward was deleted, and where to deliver.
drop function if exists public.admin_list_redemptions();
create or replace function public.admin_list_redemptions()
returns table (
  id uuid, username text, reward_name text, points_cost integer, status text, created_at timestamptz,
  phone text, email text, delivery_place text
)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
    select r.id, p.username, coalesce(w.name, r.reward_name, 'Deleted reward'), r.points_cost, r.status, r.created_at, p.phone, u.email::text,
           coalesce(r.delivery_location_name, '')
    from public.redemptions r
    join public.profiles p on p.id = r.user_id
    left join public.rewards w on w.id = r.reward_id
    left join auth.users u on u.id = r.user_id
    order by (r.status = 'pending') desc, r.created_at desc;
end;
$$;
revoke all on function public.admin_list_redemptions() from public, anon;
grant execute on function public.admin_list_redemptions() to authenticated;

-- Remove a handed-over (or cancelled) order straight away. Pending orders cannot be removed.
create or replace function public.owner_delete_redemption(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  delete from public.redemptions where id = p_id and status in ('fulfilled', 'cancelled');
  if not found then raise exception 'Only handed-over or cancelled orders can be removed'; end if;
end;
$$;
revoke all on function public.owner_delete_redemption(uuid) from public, anon;
grant execute on function public.owner_delete_redemption(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- A message whenever someone receives points (a gift, or points from the team), so their balance and the bell refresh.
-- ---------------------------------------------------------------------------
create or replace function public.notify_points_received()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.amount > 0 and new.kind in ('gift_received', 'admin_adjustment') then
    insert into public.notifications (user_id, title, body, link)
      values (new.user_id, 'You received Crumb Points',
              '+' || new.amount || ' points' || case when coalesce(new.note, '') <> '' then ' · ' || left(new.note, 100) else '' end, '/rewards');
  end if;
  return new;
end;
$$;
drop trigger if exists points_received_notify on public.points_transactions;
create trigger points_received_notify after insert on public.points_transactions for each row execute function public.notify_points_received();

-- ---------------------------------------------------------------------------
-- Find a Friend as an invite link. Every player has a code. Their QR code opens Snacktic with that code. When someone
-- signs up or signs in after opening it, the player who invited them earns the points. Each person counts for one
-- inviter only (the first one wins), nobody can invite themselves, and there is a limit per inviter.
-- ---------------------------------------------------------------------------
alter table public.campaigns add column if not exists referral_cap integer not null default 50 check (referral_cap between 1 and 1000);

create table if not exists public.find_friend_referrals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_id uuid not null references public.profiles (id) on delete cascade,
  points_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_id),
  unique (campaign_id, referred_id)
);
create index if not exists find_friend_referrals_referrer_idx on public.find_friend_referrals (campaign_id, referrer_id);
alter table public.find_friend_referrals enable row level security;
drop policy if exists "find friend referrals read own" on public.find_friend_referrals;
create policy "find friend referrals read own" on public.find_friend_referrals for select to authenticated
  using (referrer_id = auth.uid() or referred_id = auth.uid());

-- The old way (scanning inside the app) is replaced by the invite link.
drop function if exists public.scan_friend_code(text);

-- Who is inviting? Used on the welcome screen, before anyone has signed in.
create or replace function public.referral_info(p_code text)
returns table (referrer_name text, event_live boolean)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_campaign uuid := public.live_find_friend_id();
begin
  return query
    select p.username, (v_campaign is not null)
    from public.find_friend_players pl
    join public.profiles p on p.id = pl.user_id
    where pl.code = lower(trim(coalesce(p_code, ''))) and pl.campaign_id = v_campaign;
end;
$$;
revoke all on function public.referral_info(text) from public;
grant execute on function public.referral_info(text) to anon, authenticated;

-- After signing up or signing in: credit the inviter. Result is one of rewarded, no_event, invalid, self, already_referred, limit.
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
  if exists (select 1 from public.find_friend_referrals where campaign_id = v_campaign and referred_id = v_user) then
    return query select 0, v_name, 'already_referred'::text;
    return;
  end if;

  select points_per_scan, referral_cap into v_points, v_cap from public.campaigns where id = v_campaign;
  if (select count(*) from public.find_friend_referrals where campaign_id = v_campaign and referrer_id = v_referrer) >= v_cap then
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

-- The people you invited in the live event.
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
    select p.username, r.created_at
    from public.find_friend_referrals r
    join public.profiles p on p.id = r.referred_id
    where r.campaign_id = v_campaign and r.referrer_id = auth.uid()
    order by r.created_at desc;
end;
$$;
revoke all on function public.my_found_friends() from public, anon;
grant execute on function public.my_found_friends() to authenticated;

-- Who invited the most people.
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
    select row_number() over (order by count(*) desc, min(r.created_at) asc), p.username, count(*)
    from public.find_friend_referrals r
    join public.profiles p on p.id = r.referrer_id
    where r.campaign_id = p_campaign
    group by p.id, p.username
    order by 1
    limit 20;
end;
$$;
revoke all on function public.find_friend_leaderboard(uuid) from public, anon;
grant execute on function public.find_friend_leaderboard(uuid) to authenticated;

-- Prizes for the top three inviters (once).
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
    select row_number() over (order by count(*) desc, min(f.created_at) asc) as place, f.referrer_id as uid
    from public.find_friend_referrals f
    where f.campaign_id = p_campaign
    group by f.referrer_id
    order by 1
    limit 3
  loop
    v_amount := case r.place when 1 then v_c.prize_first when 2 then v_c.prize_second else v_c.prize_third end;
    if v_amount > 0 then
      insert into public.points_transactions (user_id, amount, kind, note) values (r.uid, v_amount, 'campaign_award', 'Find a Friend prize');
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

-- The owner's overview now counts people invited.
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
           (select count(*) from public.find_friend_referrals rf where rf.campaign_id = c.id)
    from public.campaigns c
    where c.kind = 'find_a_friend'
    order by c.starts_at desc
    limit 10;
end;
$$;
revoke all on function public.owner_find_friend_overview() from public, anon;
grant execute on function public.owner_find_friend_overview() to authenticated;

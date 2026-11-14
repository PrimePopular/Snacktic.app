-- ============================================================================
-- Update 018: ebooks (digital products), retrying a daily challenge by watching an ad, Support and Feedback.
-- Run AFTER 017_cleanup_and_classic_rules.sql. Safe to run more than once.
-- ============================================================================

-- A helper: the owner or a helper admin.
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'owner'));
$$;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- ---------------------------------------------------------------------------
-- Ebooks and other digital products. They live beside the physical rewards, bought with Crumb Points.
-- The book itself is a link the owner adds (for example a PDF in Google Drive). The link is kept in its own table that
-- students cannot read, and is only handed over when a purchase succeeds. Owned books stay in the student's Profile.
-- ---------------------------------------------------------------------------
alter table public.rewards add column if not exists kind text not null default 'physical' check (kind in ('physical', 'digital'));

create table if not exists public.reward_files (
  reward_id uuid primary key references public.rewards (id) on delete cascade,
  url text not null check (url ~* '^https?://')
);
alter table public.reward_files enable row level security;
drop policy if exists "reward files owner all" on public.reward_files;
create policy "reward files owner all" on public.reward_files for all to authenticated using (public.is_owner()) with check (public.is_owner());

create table if not exists public.digital_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reward_id uuid references public.rewards (id) on delete set null,
  title text not null,
  url text not null,
  points_cost integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, reward_id)
);
create index if not exists digital_purchases_user_idx on public.digital_purchases (user_id, created_at desc);
alter table public.digital_purchases enable row level security;
drop policy if exists "digital purchases read own" on public.digital_purchases;
create policy "digital purchases read own" on public.digital_purchases for select to authenticated using (user_id = auth.uid());

-- Physical rewards cannot be bought through the ebook route and the other way round.
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
  if v_reward.kind = 'digital' then raise exception 'That reward is an ebook. Use Get ebook.'; end if;
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

create or replace function public.buy_digital_reward(p_reward uuid)
returns table (book_title text, book_url text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_old public.digital_purchases%rowtype;
  v_url text;
  v_balance integer;
begin
  if v_user is null then raise exception 'Sign in to buy this'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;

  -- Buying the same book twice just shows it again; nothing is charged.
  select * into v_old from public.digital_purchases where user_id = v_user and reward_id = p_reward;
  if found then
    return query select v_old.title, v_old.url;
    return;
  end if;

  select * into v_reward from public.rewards where id = p_reward and active and kind = 'digital' for update;
  if not found then raise exception 'That reward is not available'; end if;
  if v_reward.stock is not null and v_reward.stock <= 0 then raise exception 'That reward is sold out'; end if;
  select f.url into v_url from public.reward_files f where f.reward_id = p_reward;
  if v_url is null then raise exception 'This ebook is not ready yet'; end if;

  perform 1 from public.profiles where id = v_user for update;
  select coalesce(sum(t.amount), 0) into v_balance from public.points_transactions t where t.user_id = v_user;
  if v_balance < v_reward.cost_points then raise exception 'Not enough Crumb Points'; end if;

  insert into public.digital_purchases (user_id, reward_id, title, url, points_cost)
    values (v_user, p_reward, v_reward.name, v_url, v_reward.cost_points);
  insert into public.points_transactions (user_id, amount, kind, note)
    values (v_user, -v_reward.cost_points, 'redemption', 'Bought: ' || v_reward.name);
  if v_reward.stock is not null then
    update public.rewards set stock = stock - 1 where id = p_reward;
  end if;
  return query select v_reward.name, v_url;
end;
$$;
revoke all on function public.buy_digital_reward(uuid) from public, anon;
grant execute on function public.buy_digital_reward(uuid) to authenticated;

-- Owner: set or clear the link of an ebook. An empty link removes it.
create or replace function public.owner_set_reward_file(p_reward uuid, p_url text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  if coalesce(trim(p_url), '') = '' then
    delete from public.reward_files where reward_id = p_reward;
  else
    insert into public.reward_files (reward_id, url) values (p_reward, trim(p_url))
      on conflict (reward_id) do update set url = excluded.url;
  end if;
end;
$$;
revoke all on function public.owner_set_reward_file(uuid, text) from public, anon;
grant execute on function public.owner_set_reward_file(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Daily challenge retries: at most max_retries a day (default 5), by watching an ad or by paying Crumb Points.
-- ---------------------------------------------------------------------------
alter table public.game_rules add column if not exists max_retries integer not null default 5 check (max_retries >= 0);

create table if not exists public.ad_gates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  ad_id uuid references public.ads (id) on delete set null,
  game_id text not null,
  mode text not null,
  used boolean not null default false,
  started_at timestamptz not null default now()
);
create index if not exists ad_gates_user_idx on public.ad_gates (user_id, started_at desc);
alter table public.ad_gates enable row level security;

drop function if exists public.preview_game_attempt(text, text);
create or replace function public.preview_game_attempt(p_game_id text, p_mode text)
returns table (is_daily boolean, cost integer, tries_today integer, retries_left integer, ads_available boolean)
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
    return query select false, 0, 0, 0, false;
    return;
  end if;
  select coalesce((select value from public.app_settings where key = 'timezone'), 'UTC') into v_tz;
  v_start := date_trunc('day', now() at time zone v_tz) at time zone v_tz;
  select count(*) into v_count from public.game_attempts a
    where a.user_id = v_user and a.game_id = p_game_id and a.mode = p_mode and a.started_at >= v_start;
  return query select
    true,
    case when v_count = 0 then 0 else v_rule.retry_cost end,
    v_count,
    greatest(0, v_rule.max_retries - greatest(v_count - 1, 0)),
    exists (select 1 from public.ads ad where ad.published and (ad.ends_at is null or ad.ends_at > now()));
end;
$$;
revoke all on function public.preview_game_attempt(text, text) from public, anon;
grant execute on function public.preview_game_attempt(text, text) to authenticated;

-- Step 1 of an ad retry: the server picks an ad and notes the time. The app shows it for 15 seconds.
create or replace function public.begin_ad_retry(p_game_id text, p_mode text)
returns table (gate_id uuid, ad_id uuid)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_rule public.game_rules%rowtype;
  v_tz text;
  v_start timestamptz;
  v_count integer;
  v_ad uuid;
  v_gate uuid;
begin
  if v_user is null then raise exception 'Sign in to earn points'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  select * into v_rule from public.game_rules where game_id = p_game_id and mode = p_mode and active and is_daily_challenge;
  if not found then raise exception 'That game has no daily challenge right now'; end if;

  select coalesce((select value from public.app_settings where key = 'timezone'), 'UTC') into v_tz;
  v_start := date_trunc('day', now() at time zone v_tz) at time zone v_tz;
  select count(*) into v_count from public.game_attempts a
    where a.user_id = v_user and a.game_id = p_game_id and a.mode = p_mode and a.started_at >= v_start;
  if v_count >= 1 + v_rule.max_retries then raise exception 'No retries left today'; end if;

  select ad.id into v_ad from public.ads ad
    where ad.published and (ad.ends_at is null or ad.ends_at > now()) order by random() limit 1;
  if v_ad is null then raise exception 'No ads are available right now'; end if;

  insert into public.ad_gates (user_id, ad_id, game_id, mode) values (v_user, v_ad, p_game_id, p_mode) returning id into v_gate;
  return query select v_gate, v_ad;
end;
$$;
revoke all on function public.begin_ad_retry(text, text) from public, anon;
grant execute on function public.begin_ad_retry(text, text) to authenticated;

-- Step 2: start the try. With a gate that is old enough (the ad was on screen for 15 seconds) it costs nothing.
drop function if exists public.start_game_attempt(text, text);
create or replace function public.start_game_attempt(p_game_id text, p_mode text, p_gate uuid default null)
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

  -- A try that was started a moment ago and never finished (for example the page reloaded) is reused for free.
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
  if v_count >= 1 + v_rule.max_retries then raise exception 'No retries left today'; end if;

  if v_count = 0 then
    v_cost := 0;
  elsif p_gate is not null then
    -- Retrying by watching an ad: the ad must have been shown at least 15 seconds ago (14 allows for a slow connection).
    update public.ad_gates g set used = true
      where g.id = p_gate and g.user_id = v_user and g.game_id = p_game_id and g.mode = p_mode and not g.used
        and g.started_at <= now() - interval '14 seconds' and g.started_at > now() - interval '15 minutes';
    if not found then raise exception 'Watch the whole ad first'; end if;
    v_cost := 0;
  else
    v_cost := v_rule.retry_cost;
  end if;

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
revoke all on function public.start_game_attempt(text, text, uuid) from public, anon;
grant execute on function public.start_game_attempt(text, text, uuid) to authenticated;

delete from public.ad_gates where started_at < now() - interval '2 days';

-- ---------------------------------------------------------------------------
-- Support and Feedback. Anyone can send a report (even before signing up). The owner and helper admins manage them.
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  category text not null check (category in ('bug', 'feature', 'update', 'other')),
  title text not null check (length(title) between 1 and 150),
  description text not null check (length(description) between 1 and 3000),
  expected text not null default '' check (length(expected) <= 1000),
  actual text not null default '' check (length(actual) <= 1000),
  device text not null default '' check (length(device) <= 300),
  browser text not null default '' check (length(browser) <= 300),
  app_version text not null default '' check (length(app_version) <= 60),
  contact text not null default '' check (length(contact) <= 120),
  screenshot_path text check (screenshot_path is null or screenshot_path ~ '^feedback/[A-Za-z0-9._-]+$'),
  status text not null default 'new' check (status in ('new', 'investigating', 'in_progress', 'fixed', 'declined')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_status_idx on public.feedback (status, created_at desc);
alter table public.feedback enable row level security;
drop policy if exists "feedback staff read" on public.feedback;
create policy "feedback staff read" on public.feedback for select to authenticated using (public.is_staff());
drop policy if exists "feedback read own" on public.feedback;
create policy "feedback read own" on public.feedback for select to authenticated using (user_id = auth.uid());
drop policy if exists "feedback staff update" on public.feedback;
create policy "feedback staff update" on public.feedback for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "feedback owner delete" on public.feedback;
create policy "feedback owner delete" on public.feedback for delete to authenticated using (public.is_owner());

create or replace function public.submit_feedback(
  p_category text, p_title text, p_description text, p_expected text, p_actual text,
  p_device text, p_browser text, p_version text, p_screenshot text, p_contact text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if p_category not in ('bug', 'feature', 'update', 'other') then raise exception 'Choose what this is about'; end if;
  if length(trim(coalesce(p_title, ''))) < 1 or length(trim(coalesce(p_description, ''))) < 1 then raise exception 'Please fill in the title and the details'; end if;

  -- Simple limits so nobody can flood the inbox: 10 a day per account, 100 an hour for people not signed in.
  if v_user is not null then
    if (select count(*) from public.feedback where user_id = v_user and created_at > now() - interval '1 day') >= 10 then
      raise exception 'You have sent a lot today. Please try again tomorrow';
    end if;
  elsif (select count(*) from public.feedback where user_id is null and created_at > now() - interval '1 hour') >= 100 then
    raise exception 'Too many reports right now. Please try again later';
  end if;

  insert into public.feedback (user_id, category, title, description, expected, actual, device, browser, app_version, contact, screenshot_path)
    values (v_user, p_category, left(trim(p_title), 150), left(trim(p_description), 3000), left(coalesce(p_expected, ''), 1000), left(coalesce(p_actual, ''), 1000),
            left(coalesce(p_device, ''), 300), left(coalesce(p_browser, ''), 300), left(coalesce(p_version, ''), 60), left(coalesce(p_contact, ''), 120),
            nullif(p_screenshot, ''))
    returning id into v_id;

  -- Tell the owner in the app (the bell, and the phone once notifications are set up).
  insert into public.notifications (user_id, title, body, link)
    select p.id, 'New ' || case p_category when 'bug' then 'bug report' when 'feature' then 'feature request' when 'update' then 'update request' else 'message' end,
           left(trim(p_title), 120), ''
    from public.profiles p where p.role = 'owner';
  return v_id;
end;
$$;
revoke all on function public.submit_feedback(text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_feedback(text, text, text, text, text, text, text, text, text, text) to anon, authenticated;

-- Screenshots go in the same picture storage, under feedback/. Anyone may add one; admins can see and remove them.
drop policy if exists "feedback screenshots insert" on storage.objects;
create policy "feedback screenshots insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'event-images' and name like 'feedback/%');

-- Contact details shown on the Support page (editable in Admin, Support).
insert into public.app_settings (key, value) values ('support_email', 'snacktic.service@gmail.com') on conflict (key) do nothing;
insert into public.app_settings (key, value) values ('support_whatsapp', '2349033000131') on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Find a Friend: the owner can delete an event (its players and scans go with it).
-- ---------------------------------------------------------------------------
create or replace function public.owner_delete_find_friend(p_campaign uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  delete from public.campaigns where id = p_campaign and kind = 'find_a_friend';
end;
$$;
revoke all on function public.owner_delete_find_friend(uuid) from public, anon;
grant execute on function public.owner_delete_find_friend(uuid) to authenticated;

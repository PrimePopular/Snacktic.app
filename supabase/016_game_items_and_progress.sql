-- ============================================================================
-- Update 016: hints bought with real Crumb Points, and game progress saved in the database.
-- Run AFTER 015_stock_prefs_cookie_wall.sql. Safe to run more than once.
-- ============================================================================

alter table public.points_transactions drop constraint if exists points_transactions_kind_check;
alter table public.points_transactions add constraint points_transactions_kind_check check (kind in
  ('game_award', 'campaign_award', 'gift_sent', 'gift_received', 'redemption', 'admin_adjustment', 'ad_view', 'game_retry', 'game_purchase'));

-- Things a game sells for Crumb Points (for example hint packs). The owner sets the prices in Admin, Game challenges.
create table if not exists public.game_items (
  game_id text not null,
  item text not null,
  label text not null default '',
  qty integer not null default 1 check (qty > 0),
  price integer not null check (price >= 0),
  primary key (game_id, item)
);
alter table public.game_items enable row level security;
drop policy if exists "game items public read" on public.game_items;
create policy "game items public read" on public.game_items for select to anon, authenticated using (true);
drop policy if exists "game items owner all" on public.game_items;
create policy "game items owner all" on public.game_items for all to authenticated using (public.is_owner()) with check (public.is_owner());

insert into public.game_items (game_id, item, label, qty, price) values
  ('crumb-quest', 'hint-1', '1 hint', 1, 5),
  ('crumb-quest', 'hint-2', '3 hints', 3, 12),
  ('crumb-quest', 'hint-3', '5 hints', 5, 18),
  ('crumb-quest', 'hint-4', '10 hints', 10, 35)
on conflict (game_id, item) do nothing;

-- One row per purchase. The request id comes from the app, so a repeated request is never charged twice.
create table if not exists public.game_purchases (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null,
  item text not null,
  qty integer not null,
  price integer not null,
  created_at timestamptz not null default now()
);
alter table public.game_purchases enable row level security;
drop policy if exists "game purchases read own" on public.game_purchases;
create policy "game purchases read own" on public.game_purchases for select to authenticated using (user_id = auth.uid());

-- Buy an item with Crumb Points. Charges the price once, or nothing at all if it cannot be done.
create or replace function public.spend_game_item(p_request uuid, p_game_id text, p_item text)
returns table (new_balance integer, bought_qty integer, charged integer)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_item public.game_items%rowtype;
  v_balance integer;
  v_old public.game_purchases%rowtype;
begin
  if v_user is null then raise exception 'Sign in to buy this'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  if p_request is null then raise exception 'That purchase is not valid'; end if;

  perform 1 from public.profiles where id = v_user for update;

  select * into v_old from public.game_purchases where id = p_request and user_id = v_user;
  if found then
    select coalesce(sum(t.amount), 0) into v_balance from public.points_transactions t where t.user_id = v_user;
    return query select v_balance, v_old.qty, 0;
    return;
  end if;

  select * into v_item from public.game_items where game_id = p_game_id and item = p_item;
  if not found then raise exception 'That item is not for sale'; end if;

  select coalesce(sum(t.amount), 0) into v_balance from public.points_transactions t where t.user_id = v_user;
  if v_balance < v_item.price then raise exception 'Not enough Crumb Points'; end if;

  insert into public.game_purchases (id, user_id, game_id, item, qty, price) values (p_request, v_user, p_game_id, p_item, v_item.qty, v_item.price);
  if v_item.price > 0 then
    insert into public.points_transactions (user_id, amount, kind, note)
      values (v_user, -v_item.price, 'game_purchase', 'Bought: ' || v_item.label);
  end if;
  return query select v_balance - v_item.price, v_item.qty, v_item.price;
end;
$$;
revoke all on function public.spend_game_item(uuid, text, text) from public, anon;
grant execute on function public.spend_game_item(uuid, text, text) to authenticated;

-- Saved game progress (levels reached, best scores, hint bank, settings), one row per student per game.
create table if not exists public.game_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);
alter table public.game_progress enable row level security;
drop policy if exists "game progress read own" on public.game_progress;
create policy "game progress read own" on public.game_progress for select to authenticated using (user_id = auth.uid());

create or replace function public.save_game_progress(p_game_id text, p_data jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 30000 then raise exception 'That progress is not valid'; end if;
  insert into public.game_progress (user_id, game_id, data, updated_at) values (auth.uid(), p_game_id, p_data, now())
    on conflict (user_id, game_id) do update set data = excluded.data, updated_at = now();
end;
$$;
revoke all on function public.save_game_progress(text, jsonb) from public, anon;
grant execute on function public.save_game_progress(text, jsonb) to authenticated;

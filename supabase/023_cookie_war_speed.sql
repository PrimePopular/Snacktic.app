-- Update 029: Cookie War speed rewards (hidden timer, personal bests).
-- Run once in the Supabase SQL Editor. Safe to run again.
--
-- The game times each win privately from the player's first move. The first winning time on a level is a personal best
-- worth 1 point; each later time that is clearly faster is worth one more point than the last (2, 3, 4 ...). A normal win
-- that does not beat the best earns nothing extra. Times are never shown to the player.

alter table public.points_transactions drop constraint if exists points_transactions_kind_check;
alter table public.points_transactions add constraint points_transactions_kind_check check (kind in
  ('game_award', 'campaign_award', 'gift_sent', 'gift_received', 'redemption', 'admin_adjustment', 'ad_view', 'game_retry', 'game_purchase', 'game_speed'));

create table if not exists public.game_personal_bests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null check (game_id ~ '^[a-z0-9-]+$'),
  level integer not null check (level between 1 and 5),
  best_ms integer not null check (best_ms > 0),
  improvements integer not null default 0,
  wins integer not null default 0,
  last_award_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id, level)
);
alter table public.game_personal_bests enable row level security;
drop policy if exists "own personal bests" on public.game_personal_bests;
create policy "own personal bests" on public.game_personal_bests for select to authenticated using (user_id = auth.uid());
drop policy if exists "admin personal bests" on public.game_personal_bests;
create policy "admin personal bests" on public.game_personal_bests for select to authenticated using (public.is_admin());

-- Called by the app after a win. Returns how many points were paid (0 for an ordinary win).
create or replace function public.record_speed_win(p_game text, p_level integer, p_ms integer)
returns table (awarded integer, improved boolean, total_improvements integer)
language plpgsql security definer set search_path = public
as $$
declare
  c_floor constant integer := 3000;            -- no real game is won faster than this
  c_ceiling constant integer := 3600000;       -- one hour
  c_faster constant numeric := 0.95;           -- must beat the old best by at least 5% to be paid
  c_max_paid constant integer := 8;            -- the 8th improvement is the last that pays
  c_gap constant interval := interval '20 seconds';
  v_user uuid := auth.uid();
  v_row public.game_personal_bests%rowtype;
  v_pay integer := 0;
begin
  if v_user is null then raise exception 'Sign in to save your best time'; end if;
  if (select suspended from public.profiles where id = v_user) then raise exception 'Your account is suspended'; end if;
  if p_game is null or p_game !~ '^[a-z0-9-]+$' or p_level is null or p_level not between 1 and 5 then
    return query select 0, false, 0; return;
  end if;
  if p_ms is null or p_ms < c_floor or p_ms > c_ceiling then
    return query select 0, false, 0; return;   -- an impossible time is ignored, never paid
  end if;

  insert into public.game_personal_bests (user_id, game_id, level, best_ms, improvements, wins)
    values (v_user, p_game, p_level, p_ms, 0, 0) on conflict do nothing;
  select * into v_row from public.game_personal_bests where user_id = v_user and game_id = p_game and level = p_level for update;

  v_row.wins := v_row.wins + 1;
  if v_row.improvements = 0 then
    -- the very first winning time
    v_row.improvements := 1; v_row.best_ms := p_ms; v_pay := 1;
  elsif p_ms < v_row.best_ms then
    if p_ms <= v_row.best_ms * c_faster and v_row.improvements < c_max_paid
       and (v_row.last_award_at is null or v_row.last_award_at < now() - c_gap) then
      v_row.improvements := v_row.improvements + 1; v_pay := v_row.improvements;
    end if;
    v_row.best_ms := p_ms;
  end if;

  update public.game_personal_bests
     set best_ms = v_row.best_ms, improvements = v_row.improvements, wins = v_row.wins, updated_at = now(),
         last_award_at = case when v_pay > 0 then now() else last_award_at end
   where user_id = v_user and game_id = p_game and level = p_level;

  if v_pay > 0 then
    insert into public.points_transactions (user_id, amount, kind, note)
      values (v_user, v_pay, 'game_speed', 'Cookie War level ' || p_level || ': new personal best');
  end if;
  return query select v_pay, v_pay > 0, v_row.improvements;
end;
$$;
revoke all on function public.record_speed_win(text, integer, integer) from public, anon;
grant execute on function public.record_speed_win(text, integer, integer) to authenticated;

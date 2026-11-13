-- ============================================================================
-- Update 017: automatic storage cleanup, and classic games that can be replayed without limits.
-- Run AFTER 016_game_items_and_progress.sql. Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Storage cleanup. Old finished data is removed by itself so the free database lasts a long time.
-- Points are never touched: every balance is the sum of the points history, which is always kept.
-- Pictures (the real storage user) are removed when you delete the item in the admin.
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value) values ('cleanup_orders_days', '7') on conflict (key) do nothing;
insert into public.app_settings (key, value) values ('cleanup_notifications_days', '30') on conflict (key) do nothing;
insert into public.app_settings (key, value) values ('cleanup_plays_days', '30') on conflict (key) do nothing;

create index if not exists redemptions_user_idx on public.redemptions (user_id, created_at desc);
create index if not exists redemptions_status_idx on public.redemptions (status, updated_at);

create or replace function public.run_cleanup()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_orders_days integer := coalesce(nullif((select value from public.app_settings where key = 'cleanup_orders_days'), '')::integer, 7);
  v_notes_days integer := coalesce(nullif((select value from public.app_settings where key = 'cleanup_notifications_days'), '')::integer, 30);
  v_plays_days integer := coalesce(nullif((select value from public.app_settings where key = 'cleanup_plays_days'), '')::integer, 30);
  v_orders integer;
  v_notes integer;
  v_plays integer;
  v_attempts integer;
begin
  -- Orders that were handed over (or cancelled) leave the database after a few days.
  delete from public.redemptions
    where status in ('fulfilled', 'cancelled') and updated_at < now() - make_interval(days => greatest(v_orders_days, 1));
  get diagnostics v_orders = row_count;

  delete from public.notifications where created_at < now() - make_interval(days => greatest(v_notes_days, 1));
  get diagnostics v_notes = row_count;

  -- Daily play records are only needed for today's limits and for double-claim protection (24 hours).
  delete from public.game_plays where played_at < now() - make_interval(days => greatest(v_plays_days, 2));
  get diagnostics v_plays = row_count;

  delete from public.game_attempts where started_at < now() - interval '7 days';
  get diagnostics v_attempts = row_count;

  return jsonb_build_object('orders', v_orders, 'notifications', v_notes, 'game_plays', v_plays, 'game_attempts', v_attempts);
end;
$$;
revoke all on function public.run_cleanup() from public, anon, authenticated;

-- The owner's "Clean up now" button.
create or replace function public.owner_run_cleanup()
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  return public.run_cleanup();
end;
$$;
revoke all on function public.owner_run_cleanup() from public, anon;
grant execute on function public.owner_run_cleanup() to authenticated;

-- Run it by itself every night (02:15 UTC) if the scheduler (pg_cron) is switched on.
-- If it is not on yet: Supabase, Database, Extensions, switch on pg_cron, then run this file again.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('snacktic-cleanup', '15 2 * * *', 'select public.run_cleanup()');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Classic games can be replayed as often as students like.
-- Crumb Quest Classic Bake used a small daily cap. It now pays one-time level milestones instead
-- (each pays once per student, ever), so there is no replay limit and nothing to farm.
-- Rules that pay a fixed amount do not need a maximum score, so that limit is removed for them.
-- ---------------------------------------------------------------------------
update public.game_rules
  set award_type = 'milestones', daily_first_award = 0, replay_award = 0, daily_cap = 1000, max_score = 1000, min_score = 1
  where game_id = 'crumb-quest' and mode = 'classic-bake';

insert into public.game_milestones (game_id, mode, score, points) values
  ('crumb-quest', 'classic-bake', 5, 2),
  ('crumb-quest', 'classic-bake', 10, 3),
  ('crumb-quest', 'classic-bake', 25, 5),
  ('crumb-quest', 'classic-bake', 50, 10),
  ('crumb-quest', 'classic-bake', 100, 20),
  ('crumb-quest', 'classic-bake', 200, 40)
on conflict do nothing;

update public.game_rules set max_score = 1000000 where award_type = 'fixed';

-- Paste this into the Supabase SQL Editor and run it. Every line should say true.
-- A "false" means that numbered file has not been run yet: run it (in number order) and check again.
select
  to_regclass('public.shops') is not null                                                              as "011 shops and ads",
  to_regclass('public.find_friend_players') is not null                                                as "012 find a friend",
  to_regclass('public.push_subscriptions') is not null                                                 as "013 push and weather",
  to_regclass('public.game_attempts') is not null                                                      as "014 game challenges",
  exists (select 1 from information_schema.columns where table_name = 'rewards' and column_name = 'stock') as "015 stock",
  to_regclass('public.game_items') is not null                                                         as "016 hints and progress",
  exists (select 1 from public.app_settings where key = 'cleanup_orders_days')                         as "017 cleanup",
  to_regclass('public.feedback') is not null                                                           as "018 ebooks, retries, feedback",
  to_regclass('public.delivery_locations') is not null                                                 as "019 delivery and invites",
  to_regclass('public.scheduled_notifications') is not null                                            as "020 notifications schedule";

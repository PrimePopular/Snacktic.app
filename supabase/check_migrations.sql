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
  to_regclass('public.scheduled_notifications') is not null                                            as "020 notifications schedule",
  to_regclass('public.ad_opens') is not null                                                           as "021 ad engagement and invite limits",
  to_regclass('public.bonus_settings') is not null                                                     as "022 bonus rewards",
  to_regclass('public.game_personal_bests') is not null                                                as "023 cookie war speed",
  to_regprocedure('public.admin_points_overview(text,text,integer,integer)') is not null              as "024 points analysis",
  to_regclass('public.news_items') is not null                                                         as "025 news and announcements",
  to_regclass('public.billboard_posts') is not null                                                    as "026 billboards",
  to_regclass('public.ad_reach') is not null                                                           as "027 ad analytics",
  to_regprocedure('public.admin_overview()') is not null                                               as "028 analysis hub",
  to_regclass('public.billboard_comments') is not null                                                 as "029 billboard likes and comments",
  to_regclass('public.admin_activity') is not null                                                     as "030 content trail and editors";

-- Update 032: video in ads.
-- Run once in the Supabase SQL Editor. Safe to run again.
-- An ad can carry a video link: a YouTube link (opens in YouTube) or a direct .mp4 file link (plays inside Snacktic).
alter table public.ads add column if not exists video_url text check (video_url is null or video_url ~* '^https?://');

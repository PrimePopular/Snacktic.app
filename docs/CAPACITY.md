# Can Snacktic handle about 3,000 students?

Short answer: the design is fine for 3,000 on the free plans, with a few things to watch. This is a review of the design and the limits, not a measured load test (nothing here has been run under real traffic yet).

## Where the free plans could pinch (limits change, so check the pricing pages)
- **Supabase database size**: about 500 MB. Snacktic stores small rows. Finished orders, old messages and old game records clean themselves up, and Crumb Points history is tiny. 3,000 students is a small fraction of this.
- **Supabase file storage (1 GB) and download traffic (about 5 GB a month)**: this is the real risk. It is pictures (events, places, shops, rewards, ads, screenshots). Pictures are shrunk before upload and cached for a year. Keep pictures small and remove old ones. Ebooks are links, so they use no storage.
- **Supabase pausing**: a free project pauses after about a week with no activity, and has no automatic backups. During school holidays open the app once a week, and export your data now and then (Students export, and the Supabase backups page).
- **Monthly active users**: the free plan allows far more than 3,000.
- **Cloudflare**: the website itself is static files, so many students at once is not a problem.

## What is already done to stay fast
- Lists load a page at a time (Rewards loads as you scroll) and the app keeps recent lists on the phone.
- The database has indexes on the busy tables (points history, plays, orders, notifications).
- Points are always counted in the database, never by the app, so heavy use cannot corrupt a balance.
- Notifications go out in batches of 150 a minute so a large audience cannot overload the function.

## What to test before the whole campus joins
1. Have 20 to 30 friends open the app at the same time and use it for 10 minutes. Watch Supabase, **Reports** (API requests, database health) for slow requests.
2. If the admin Students list feels slow, tell me: it loads every student, and I will add pages.
3. Watch storage and download traffic in the Supabase dashboard during the first weeks. If pictures grow too large, shrink or delete the oldest.
4. If you outgrow the free plan, the cheapest Supabase paid plan removes the pausing and adds backups.

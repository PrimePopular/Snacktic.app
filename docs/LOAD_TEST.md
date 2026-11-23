# Load testing Snacktic (100 to 2,000 students at once)

I could not run a load test from where I work, so this is a ready-made test you run yourself. It uses k6, a free tool.

## Before you start
- **Never test your live project.** A test can use up a month of free allowance in minutes and can slow the real app for students.
  Make a second, free Supabase project, run all the `supabase/*.sql` files in it (they build the same tables), and add a few events,
  rewards and Billboard posts so there is something to read. Use that project's address and anon key below.
- Know your plan's limits first (Supabase Free: 500 MB database, about 5 GB of data transfer a month, 200 realtime connections,
  and the project pauses after a week of no use). A test at 2,000 users will hit the free transfer limit. That is a useful result: it
  tells you what plan you need.

## Run it
1. Install k6 from k6.io (Windows, Mac or Linux).
2. In a terminal, from the Snacktic folder:
   `k6 run -e SUPABASE_URL=https://YOUR-TEST-REF.supabase.co -e ANON_KEY=YOUR-TEST-ANON-KEY -e PEAK=100 loadtest/snacktic-k6.js`
3. Repeat with `PEAK=500`, `1000`, then `2000`.

## Reading the result
- `http_req_failed` under 1% and `http_req_duration p(95)` under 1000 ms means that load is fine.
- If it goes red at a number, that number is your limit on that plan. Then check Supabase, Reports, for the database CPU and connections.

## What this does not test
It reads only (Home, Discover, Rewards, Billboards). It does not test signing up, claiming points or games, and it does not
test realtime. Those need a small separate test; ask me when you are ready.

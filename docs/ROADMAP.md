# Roadmap and decisions

The single place that records what is built, what is next, and the rules the owner has decided.
Update it whenever a decision changes.

## Built
Accounts (nickname, WhatsApp number optional, forgot password), Home feed that adapts to each student,
Discover (events, places with maps, news, search and filters), Games page with the central points API,
Rewards (items with pictures, orders), gifting in Profile with daily receiving limits, admin dashboard
(news, events, places, categories, rewards and orders, students, team, points and limits, game points),
account suspension, start-up animation, installable app and offline copies of public lists.

## Decided, not built yet (in this order)
1. ~~**Ads**~~ **Built (update 011).** Owner-only admin section. Ads show in the Home feed tagged "Ad", never first,
   never second, never back to back. The database pays 0 to 5 points (owner sets it per ad), once per student per ad.
2. ~~**Shops** in Discover~~ **Built (update 011).** Shops with address, hours, phone, partner products and a
   "Near me" sort. **Maps:** no map is loaded inside the app any more. Places, shops and events have an
   "Open in Google Maps" button (free, no key). Still to do: a "you are near a shop with this product" card.
   Products sold by Snacktic itself are dropped: the products here are partner products shops pay to show.
3. ~~**Find a Friend**~~ **Built (update 012):** owner starts, stops and pays prizes from the admin; in-app messages (bell in the top bar) tell a student they were found. Real phone push notifications (Web Push) are a later batch. Original notes:
   - Students tap Join and get a personal QR code.
   - Scanning someone's code pays the scanner (points per scan set by the owner).
   - Each code can be scanned once only. If A scanned B, B cannot scan A back; B should find someone else.
   - The person scanned gets an in-app message: "You've been found! Now go find a friend."
   - A list of friends found, and a leaderboard of who found the most; top finders get prize points.
   - A "Find a Friend is live" tag appears on every main screen while it runs; the page and tag exist only
     while it is live, and it resets afterwards. Joining it brings new people into the app.
4. **Notifications** inside the app (the "you've been found" message and others).
5. **News vs Announcements** switch; **nudge cards** between sections ("check out Rewards", "see new
   events"); cards for games, products and campaigns in the Home feed.
6. **Trivia** question bank in the admin, and the real games (the owner sends them).
7. **Profile** extras: profile picture, notification preferences; account deletion later.
8. **UI polish last**, with a workflow for it. Weather card and daily prayer times are later ideas (check the
   free weather service's terms for commercial use first).

## Rules
- Only the owner can: change points, suspend or restore accounts, see the Students list, manage the team and
  game points. Helper admins handle content, reward items and orders (they see buyer nickname, WhatsApp
  number and email on orders only).
- A student can receive at most N gifts and M points per day (owner sets N and M; starting values 3 and 50).
- Orders: buying a reward spends points and tells the student an agent will contact them on WhatsApp; the
  team delivers in person at school. Items are physical.
- Collect only what is needed. Phone number is optional at sign-up and required when ordering.


## Update 014: the first two games
- **Crumbly** (number merging) and **Crumb Quest** (word game) are in the Games page, slots 1 and 2. Their pages are in `public/games/` and run inside the app. They only report results; the database pays.
- Daily challenges: first try each day free, retries cost Crumb Points (default 30, owner sets it in Admin, Game challenges). A try must be started on the server (`start_game_attempt`) and pays once.
- Crumbly Classic pays one-time score milestones (default 5,000: 10, 10,000: 20, 20,000: 30; editable). Crumbly Daily pays by score up to 150 a day. Crumb Quest Daily Quest pays per level cleared (5, 8, 10, 12, 14, 16, 18, 20, 22, 25 = 150). Crumb Quest Classic Bake pays a few points a day.
- Run `supabase/014_game_challenges.sql`. All numbers are editable in the admin (Game points, Game challenges).
- Known weakness: scores are produced by the game running on the phone. The database caps the score, the time and the daily total, but a determined cheater could still send a high but possible score.
- Still to do: the third game (5 stages), the trivia bank (on hold), ad-based retries (maybe later, switchable).


## Update 015
- Rewards have a stock count (empty = unlimited). Two students can no longer buy the last one; cancelling an order puts it back.
- Third game: Cookie Wall Race (slot 3). Levels 1 to 3 casual, levels 4 and 5 daily challenges with a paid retry. Run `supabase/015_stock_prefs_cookie_wall.sql`.
- A lost or empty daily try now always uses up the try.
- Notifications: students choose weather, prayer, games and new rewards. The owner switches prayer and games on in Admin, Daily notifications. Setup: docs/PUSH_SETUP.md.
- "A new version is ready" banner and docs/UPDATING.md.

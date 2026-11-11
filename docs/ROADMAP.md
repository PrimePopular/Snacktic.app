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
1. **Ads**: an admin section; ads appear naturally in feeds, tagged "Ad"; viewing one earns 1 or 2 Crumb
   Points (owner sets it; one reward per ad per student). Never two ads back to back, and never as the first
   or second card.
2. **Products and Shops** in Discover (no stock status for now), with maps. **Maps for events** too:
   OpenStreetMap map, "Open in Google Maps" button, address search and pasting a long Google Maps link to
   fill the position.
3. **Find a Friend** (special event, QR codes; uses two small free libraries, approved):
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

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

## Update 016 (bug fixes, batch A and B)
- Crumb Quest no longer has its own crumbs or the free 100. Its balance is the student's real Crumb Points, sent by the app. Hints are bought through the database (`spend_game_item`): charged once, never twice, nothing taken if it fails. Hint prices: Admin, Game challenges.
- Game progress (levels, best scores, hint bank, settings) is saved in the database and restored before a game opens. Daily challenge state is handled by the server and is not copied.
- A running game is full screen, with a slim bar (Leave game and the Crumb Points). The page behind it does not scroll.
- The result of a game appears over the game. Daily challenges show Retry (not Play again).
- Crumb Quest touch dragging: pointer capture on the letter wheel, no text selection or long-press menu, page scrolling locked while a game runs. Needs checking on a real phone.
- Crumbly daily limit is back to the original 3 minutes. The "boxes already on the board" in the daily is the game's own design (`preRows: 2` in the original file).
- Run `supabase/016_game_items_and_progress.sql`.
- Next: delivery locations (GOUNI only), Find a Friend as a referral link, Support and Feedback, compact game cards, UI polish.

## Update 017 (testing feedback)
- Game result is a pop-up over the game. Play again and Retry go straight back into the same mode (no picker). A daily retry asks before charging.
- Cookie Wall Race keeps its own original screens. Levels 4 and 5 ask the app for permission to start (first try free, retries cost points).
- Crumb Quest: the game's own points pill, Home button and logo are hidden inside Snacktic (one Crumb Points display, in the bar). Wording says Crumb Points.
- Crumbly: no exact time shown in the instructions.
- Classic modes have no replay limit: Crumb Quest Classic Bake now pays one-time level milestones. Fixed-amount rules no longer show a maximum score.
- Ads: a feed with only 2 cards still shows an ad at the end.
- Weather uses each student's own place (phone location or a searched place), campus only as the fallback.
- Rewards have a Delete button. Auto cleanup of finished orders and old data (Admin, Storage cleanup). Run `supabase/017_cleanup_and_classic_rules.sql`.
- Next: scheduled notifications with times set in the admin and weather per student's place, delivery locations, Find a Friend as a referral link, Support and Feedback, a 3,000-student capacity review.

## Update 018 (ebooks, ad retries, Support)
- Ebooks: Admin, Rewards: choose "An ebook or digital item" and paste a link to the book (for example Google Drive, sharing set to anyone with the link). Students buy with Crumb Points and get the link at once; it stays in Profile, My activity, My ebooks. Links are kept where students cannot read them before buying. No file is stored in Supabase, so it uses no storage.
- Rewards is a market: tabs for Items and Ebooks (swipe sideways to change), compact cards, the list grows as you scroll, ads between the cards. Activity, orders and ebooks moved to Profile and open on tap.
- Ads also appear in Discover (events, places, shops).
- Retrying a daily challenge: watch an ad for 15 seconds (free) or pay Crumb Points. At most 5 retries a day (owner can change it per game in Admin, Game challenges). No ads available: Crumb Points only.
- Support and Feedback: Profile (and Guest profile) to /support: report a bug, request a feature or an update, email or WhatsApp. Reports go to Admin, Feedback with a status. The owner gets a message in the bell for each one. Contacts are editable in Admin, Feedback.
- Ended events are deleted (with their pictures) whenever an admin opens the dashboard. Find a Friend events can be deleted.
- Run `supabase/018_ebooks_ad_retries_feedback.sql`.
- Next: notifications whose times the owner sets, weather per student's place, delivery restricted to Godfrey Okoye University, Find a Friend as a referral link, a 3,000 student capacity review.


## Update 022
- Deleting a reward no longer fails when it has orders: orders keep their own copy of the reward name. The owner can also remove a handed-over order straight away (Rewards, Recent handled orders, Remove).
- Delivery: physical rewards can only be ordered for an approved place (right now Godfrey Okoye University). The notice shows before the order, the server refuses other places, students can ask for a new place, and the owner manages places in Admin, Delivery places.
- Find a Friend is an invite link: the QR code is a normal web address with the player's code. Anyone can scan it with their normal camera. When the person signs up or signs in, the inviter earns the points. Each person counts for one inviter (the first), nobody can invite themselves, and there is a limit per inviter (50 by default). The in-app scanner is gone.
- Whenever someone receives points (a gift or points from the team) they get a message, and their balance on top refreshes (it also refreshes by itself every 45 seconds).
- Weather: the card now follows the student's own location automatically and describes the whole day with advice (umbrella, light clothes, jacket), using real sunshine and cloud data. Points history now has names for game retries and hint purchases.
- Install: every phone now shows how to install (Android menu steps when Chrome does not offer a button, and four clear steps for iPhone).
- Run `supabase/019_delivery_referrals_orders.sql`.
- Still to do: notifications whose time the owner sets (with the daily weather message for each student's place, using the same outlook), the Jumia-style Rewards look, Crumb Quest layout, a 3,000 student capacity review.

## Update 023
- WhatsApp numbers get the Nigeria country code (+234) by default. A number typed as 0903 300 0131, 9033000131 or +234 903 300 0131 all become +2349033000131 when saved, and the WhatsApp button in Rewards orders works for every number (old numbers that start with 0 too). A number typed with another country's + code is kept as it is.

## Update 024
- Notifications: the owner sets what is sent and exactly when (Admin, Daily notifications): weather, prayer (with the school link), games reminder and custom messages, each with time, repeat (daily, weekdays, weekends), start and end dates and how long it stays valid. One function (`supabase/functions/push`) does everything; setup is in docs/PUSH_SETUP.md and needs no command line. Run `supabase/020_scheduled_notifications.sql`.
- Weather notification is written for each student's own place (about 10 km), with advice, using the same rules as the card in the app. Students who have not shared a place get the campus weather.
- Retrying a daily challenge is by watching an ad. With no ad available students are told so. The owner can retry freely (to test). Retry limit per day is still editable.
- Ads: metrics (views, taps, last 7 days) per ad in Admin, Ads; ads also appear between game cards, in the game chooser and on the game result pop-up.
- Game cards are compact (name and Play).
- Rewards has a "Just added" rail and bolder prices.
- docs/CAPACITY.md reviews the 3,000 student question.

## Update 025
- Notifications are on by default: every kind starts switched on for everyone, and right after signing in a friendly card asks once to allow them on the phone (one tap). "Not now" asks again after a week. A phone only allows notifications after the student says yes once, so this cannot be skipped entirely.

## Update 026 (launch preparation)
- Merged your fixes to feed.css and home.css (cards can no longer stretch the page sideways).
- Privacy notice rewritten to be true for everything the app now does (ads, location, notifications, invites, feedback, delivery, how long things are kept). It previously said "we do not show ads".
- Admin Students list shows 50 at a time (fast with 3,000 students).
- `supabase/check_migrations.sql` shows which database files have been run. `docs/LAUNCH_CHECKLIST.md` lists everything left to do before launch.

## Update 027
- Ads: cards have a fixed size like event cards (a long message no longer stretches the feed). Tapping opens the full ad in its own view (picture, full text, link); closing returns to the same place in the feed. Opening an ad counts as a click.
- Ad reward: only after the ad has been open for about 3 seconds, once per student per ad, checked on the server (`begin_ad_open` and `claim_ad_points`). The amount is never shown before. Closing early earns nothing.
- Ad rotation: Home, Discover, Games and Rewards each start with a different ad (the one this phone has seen least recently), so every active ad gets its turn and none disappears.
- Find a Friend: new look (hero, steps, QR pass ticket, podium) and the in-app scanner is back (scan a friend's pass: they earn the points). A person can only ever be invited once, even across events. Daily and lifetime invite limits are set when starting an event.
- Events now show up once in a while in Games and Rewards, with a clear EVENT label.
- Run `supabase/021_ad_engagement_and_invite_limits.sql`.

## Planned later (from your 16 Nov proposal)
- Ad analytics dashboard for advertisers (impressions, unique reach, unique clicks, CTR, engagement over time). Basic views, taps and the last 7 days already exist in Admin, Ads.
- Announcements separate from News, with an expiry time (24 hours by default).
- News from outside sources: first check which APIs allow it, their limits and content rules.
- Billboards: a social-style feed the admin publishes to (text, images, video, links, featured posts, kept at least 30 days).
- Places to Visit: own tag and pin icon, never expires.
- Paid ad placement levels (standard, featured, premium), always labelled as ads.
- Crumb Points history per student in the admin.
- Store: coupons, gift cards, vouchers, discount percentages, and a Digital Library.
- Cookie War: speed-based rewards and playful defeat messages (you said this is already handled).

## Update 028 (included in 029)
- **Crumb Quest fix:** the phone layout now fits one screen with nothing bleeding off the sides (word board shrinks to fit, wheel sizes from the screen height), and swiping letters works reliably on touch screens inside the app.
- **Onboarding tour:** 7 short skippable slides, shown once to first-time visitors, reopened from Profile or Support ("Take the Snacktic tour").
- **Public Rewards browsing:** visitors who are not signed in can see every reward (picture, description, type, price, offers). Getting one asks them to sign in or register.
- **Bonus Rewards (new):** special low-price items for new members. Run `supabase/022_bonus_rewards.sql`. The database enforces who can claim (account younger than the eligibility days), the end time, the quantity and the per-person limit. Admin: Rewards page, "Bonus Rewards: rules and numbers" (on/off, days, how often, where, views/clicks/claims) and a "Bonus Reward" switch on each item.
- **"Ebooks" is now "Digital"** everywhere students and admins see it.
- Service worker cache bumped to v2, so every phone drops old saved files on its next visit.

## Update 029
Run these in the Supabase SQL Editor, in order: `021` (if not yet), `022`, `023`, `024`, `025`, `026`, `027`, `028`. Then run `check_migrations.sql`: every line should say true.
- **Cookie War:** a hidden timer starts at the player's first move and stops at the end (never shown). Levels 1 to 5: the first win is a personal best worth 1 point, each clearly faster win after that pays one more (2, 3, 4 ... up to 8 paid improvements per level). The database checks the time (impossible times are ignored), keeps the best, and pays once. Losing now shows an opponent taunt on the result screen, different for each level and sharper as the levels rise (Cookie Monster at level 5), rotated so a line is not repeated back to back.
- **Points analysis (Admin, owner only):** where points come from and go (by source, for a period you choose), a list of every student with balance, earned, spent and the last 24 hours, flags for big earners, and the full transaction trail for any student. Built from the transaction records.
- **Places to Visit:** places carry a permanent green PLACES TO VISIT tag with a location pin and their own card look. The event category (for example Hangout) is no longer shown as their label.
- **News and Announcements are separate:** Discover has an Announcements tab (admin-written, new ones default to disappearing after 24 hours, with an optional start time) and a News tab (automatic feed, shown only when stories exist). See `docs/NEWS_SOURCES.md` for the API research and setup. News needs a YouTube key and the `fetch-news` function before it fills.
- **Billboards:** a new bottom tab and an admin page (post layouts: text, big picture, swipeable pictures, video, link card, quote; featured, scheduled, draft, archive, edit, delete). Every post stays up at least 30 days (the database enforces it). Featured posts can show on Home, always tagged BILLBOARD.
- **Ad analytics (Admin, Ads):** impressions, unique reach, clicks, unique clicks, click-through rate, Crumb Points paid, and activity over time per campaign, plus a copyable advertiser report with totals only.
- Onboarding now reaches everyone who has not seen it, including people who arrive through an invite link.

### Not built yet (ask for these next)
Coupons, gift cards and vouchers as reward types, percentage discounts (50/80/90/custom) with start dates and per-product limits, custom product categories; places, shops and Billboards appearing across more sections with an admin switchboard; advertiser accounts and campaign approval; premium ad placement; news from Reddit and X (see NEWS_SOURCES.md for why not); load testing for 100 to 3,000 users; a record of Find a Friend scans that did not earn a reward.

### Update 029, second round
- **Crumb Quest:** swiping now works inside the app. Cause: every letter selection rebuilt all the wheel buttons, which removed the button under the finger, so touch screens stopped sending the rest of the swipe. Buttons are now updated in place. Hint prices in the shop now show the real price the app charges (set in Admin, Points and limits). The game no longer shows "+5 crumbs" for the hidden cookie or floating "+N" popups inside Snacktic, because Crumb Points are paid by the app when the game ends, not per word.
- **Analysis (Admin, owner only):** one page with Overview (students, active right now, plays, points in and out), Games (plays, players, plays today, players in the last 15 minutes, scores, top players per game), Ads, Points (with a flag rule you set and save, for example 300 points in 4 hours), Rewards and Find a Friend. Run `supabase/028_analysis_hub.sql`.
- **News in Admin:** a News page lists fetched stories and lets you hide or delete them. Home shows one or two of the most popular. Students see a News tab in Discover once stories exist.
- **Find a Friend** uses icons instead of emoji. The reward text already follows each event's own points per friend, so it changes with the event.
- **Everything in every section:** rewards, places, Billboards and games now drop into Home, Discover, Billboards, Games and Rewards, each keeping its own label (REWARD, PLACES TO VISIT, BILLBOARD, GAME).
- Queued items are in `docs/LATER.md`.

## Update 030
Run `supabase/029_billboard_likes_comments.sql` and `supabase/030_content_trail_and_editors.sql`, then `check_migrations.sql`.
- **Billboard likes and comments.** Heart and comment buttons with counts on every post. Anyone can read; signing in is needed to like or comment (5 comments a minute at most, 500 characters). A student can delete their own comment; the owner, admins and editors can delete any.
- **Billboards on Home never run dry.** After the Home feed, Billboard posts keep coming, a page at a time, mixed up each visit, loading more as you scroll, each tagged BILLBOARD.
- **Who posted what.** Analysis has a new "Who posted" tab: one line per admin, helper or editor (posted, edited, deleted, last active) and a full list of every action with name, what and when. It is recorded by the database, so it cannot be hidden from the app. Recording starts when 030 is run. Covers Billboards, announcements, events, places, shops, ads, rewards and news.
- **Content editor role.** In Team, "Make content editor" gives someone access to Billboards and Events only. They cannot see anything else in admin, and the database enforces it.

## Update 031 (priority: getting people to sign up)
Run `supabase/031_signup_and_daily_rewards.sql` and `supabase/032_treasure_hunt.sql`, then `check_migrations.sql`. For Google sign-in, follow `docs/GOOGLE_SIGNIN.md`.
- **Sign up is impossible to miss.** First-time visitors get the tour with a bold orange Sign up bar (and Sign up with Google) on every slide. A big orange "Sign up free" banner tops Home, and a slim orange strip shows on the other screens, for anyone not signed in. Each can be dismissed.
- **Sign up with Google** on the sign-up screen, Home banner and tour. Needs setup in Supabase and Google (docs/GOOGLE_SIGNIN.md). Google users get a nickname automatically; name and WhatsApp number are asked only when they redeem a physical reward.
- **Welcome bonus:** 10 Crumb Points for signing up (you set the amount in Admin, Points and limits). Paid once, when the email is confirmed (Google straight away).
- **Daily login reward:** a 7-day cycle (a slim Claim line on Home until claimed, the full week in Profile), 5, 8, 10, 12, 15, 20, 30 (100 in total), starting again after day 7 or after a missed day. You can change each day's amount.
- **Daily Challenge retries are back to two options:** Retry with Crumb Points, or Watch an ad (free). Both count toward the daily retry limit.
- **Tour rewritten:** 9 short slides (welcome, how Crumb Points work, Discover, Games, Events you can join with Find a Friend and Treasure Hunt, Billboards, Rewards, feedback, install). Next and Skip wait 2 seconds on each slide. The last slide offers to add Snacktic to the home screen.
- **Treasure Hunt:** Admin, Treasure Hunt. Make a code, set the points and how many people can claim it, print the QR card and paste it up. When that many different people have scanned it, it says "Too late". Each person can claim a code once. A visitor who scans signs up first and is brought straight back to claim it. Shows who found each code.

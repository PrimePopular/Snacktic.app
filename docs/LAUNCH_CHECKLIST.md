# Launch checklist

Tick each line as you do it. Everything here is something only you can do (settings, content, testing). The app itself is built.

## A. The database (30 minutes)
1. Supabase, **SQL Editor**: paste the whole of `supabase/check_migrations.sql` and run it.
2. Every column must say `true`. If one says `false`, run that numbered file from the `supabase` folder (they must be run in number order), then run the check again.

## B. Supabase settings (very important)
1. **Authentication, URL Configuration**: Site URL = your live website address. Add the same address under Redirect URLs (keep `http://localhost:5173` too).
2. **Authentication, Providers, Email**: keep **"Confirm email" switched OFF for launch week.** Why: the free Brevo plan sends about 300 emails a day (check their current limit). If confirmation is on, 3,000 students signing up in a day or two would hit that limit and many could not register. You can switch it on later.
3. Test **Forgot password** with a real email. The email must arrive and the link must open your live website, not localhost.
4. **Project Settings, Database**: note that a free project pauses after about a week of no activity. Open the app weekly.

## C. Fill the app with real content (an empty app looks broken)
1. Admin, **Categories**: add the event and place categories (for example Food, Party, Sports, Study, Music).
2. Admin: add at least 3 **Events**, 3 **Places**, 2 **Shops** (with a product or two), and 2 to 3 **News** items. Make one announcement "major".
3. Admin, **Ads**: add 2 or 3 ads (picture, message, link, 1 or 2 points, a last day).
4. Admin, **Rewards**: add several items with pictures, prices and stock, and at least one ebook with its link.
5. Admin, **Delivery places**: check "Godfrey Okoye University (GOUNI)" is switched on.
6. Admin, **Share link (QR code)**: paste your live website address. Download the QR code and print it for posters.
7. Admin, **Campus location**: set it (the weather uses it for anyone who has not shared their location).
8. Admin, **Game points** and **Game challenges**: look through the amounts once.
9. Admin, **Feedback**: check the support email and WhatsApp number are right.
10. Admin, **Find a Friend**: start the event for launch day (points per invite, prizes, last day).

## D. Test with two phones (one hour, before Tuesday)
1. Phone 1: sign up a new account. Phone 2: sign in as another account.
2. Play each game once. Finish a daily challenge. Retry it by watching an ad.
3. Buy a physical reward (check the GOUNI notice) and an ebook. In Admin, open the order, press the WhatsApp button, then Handed over.
4. Send points from phone 1 to phone 2 in Profile. The top number on phone 2 should update (within a minute, or at once if the bell rings).
5. Find a Friend: on phone 1 join and show the QR. On phone 2 (or a third phone) scan it with the normal camera, sign up, and check phone 1 earned the points.
6. Send a bug report from Support & Feedback. It must appear in Admin, Feedback.
7. Install on an Android phone and on an iPhone using the steps in Profile.
8. Check that ads appear in Home, Discover, Games and Rewards.

## E. Notifications (optional for launch, can be added any day after)
The app works fully without them. When you are ready, follow `docs/PUSH_SETUP.md`.

## F. Launch day and the first week
1. Print the QR poster. Announce Find a Friend.
2. Watch Supabase, **Reports** (slow requests, database size) and storage once a day.
3. Read Admin, Feedback every day and tell me what comes in.
4. Send me anything that breaks, with the Cloudflare error lines if a build ever goes red.

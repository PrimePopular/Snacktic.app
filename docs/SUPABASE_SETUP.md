# Supabase setup (free plan)

Snacktic's content comes from the database and is managed through the admin dashboard. There is no hard-coded sample data. Until an administrator adds content, the student app shows friendly empty states.

## One-time setup

1. Create a free account at supabase.com and create a new project. Choose a region close to your students and save the database password somewhere safe (the app never needs it).
2. In the project, open **SQL Editor > New query**, paste the whole of `supabase/schema.sql`, and press **Run**. You should see "Success". If you see an error, copy it exactly and send it to the Foundation/Backend developer.
3. Then run the numbered update files **in order**, the same way: `supabase/002_auth_extras.sql`, `supabase/003_owner_and_students.sql`, `supabase/004_team_and_announcements.sql`, `supabase/005_events_categories_images.sql`, then `supabase/006_contacts_pictures_rewards.sql` (event contact details, announcement pictures and the owner's redemption list), `supabase/007_places.sql` (Places, and separate numbered categories for places), `supabase/008_game_points.sql` (game reward rules and the trusted function that pays for game results), `supabase/009_maps_and_game_modes.sql` (map positions for places, game modes and points that depend on the score), then `supabase/010_orders_phone_suspend_limits.sql` (WhatsApp numbers, suspending accounts, reward pictures, helper-handled orders and gift receiving limits). The last one also creates the `event-images` picture storage (public to view, admins only to upload, files limited to 500 KB). They are safe to run more than once, so if you are unsure whether you ran one, run it again.
4. Open **Project Settings > API** and copy the **Project URL** and the **anon public** key.
5. In the project root, create a file named `.env.local` (copy `.env.example`) and fill it in:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

   Restart `npm run dev` after creating or changing this file.
6. **Never** put the `service_role` key anywhere in this project, and never commit `.env.local` (it is already git-ignored).

## Password reset emails (needed for "Forgot password")

Two settings in Supabase make reset links work. Without them, the "Forgot password" button will appear to do nothing.

1. **Tell Supabase where the link may send people back to.** Open **Authentication > URL Configuration**. Set **Site URL** to `http://localhost:5173` while developing, and add the same address under **Redirect URLs**. When the site goes live, add its real address too (for example `https://snacktic.pages.dev`). Links to any address not on this list will not work.
2. **Set up a real email sender.** Supabase's built-in sender is only for testing. As of November 2026 it is limited to 2 emails per hour for the whole project and, as far as I know, only sends to addresses on your own Supabase team, so ordinary students will never receive a reset email. Under **Authentication > Emails > SMTP Settings**, switch on **Custom SMTP** and enter the details from an email service. Brevo's free plan includes SMTP and, as far as I know, 300 emails per day. Resend and others also have free plans. Check the current terms before choosing.
   After switching on custom SMTP, check **Authentication > Rate Limits** and raise the hourly email limit if needed.

Until step 2 is done, you can reset a forgotten password for your own test accounts with this one-time command in the SQL Editor (change the email and password):

```sql
update auth.users
set encrypted_password = crypt('NEW_PASSWORD_HERE', gen_salt('bf'))
where lower(email) = lower('THE_EMAIL');
```

## Making yourself the owner

There are three roles: **student** (everyone), **admin** (a helper who manages content) and **owner** (you: also sees the Students page with emails and exports). The app can never change a role. It is only done here, in the database.

1. Create your account through the app's sign-up screen (Profile tab). Usernames may only contain letters, numbers and underscores, for example `Prime_1`.
2. In the SQL Editor, run this with the email you signed up with:

   ```sql
   update public.profiles set role = 'owner'
   where id = (select id from auth.users where lower(email) = lower('YOUR_EMAIL'));
   ```
3. Check it worked (the editor will say "Success. No rows returned" for the update, which is normal):

   ```sql
   select username, role from public.profiles;
   ```
   Your row should show `owner`.
4. Sign out of the app and sign in again. The Profile tab now shows an **Owner** badge and an **Open admin dashboard** button.

To make a helper an admin instead, use the same command with `'admin'` in place of `'owner'`.

## Good to know

- During development you can turn off **Authentication > Providers > Email > Confirm email** so sign-ups work instantly. Turn it back on before launch and check the current limits of Supabase's built-in email sending.
- Free projects have usage limits and, as far as I know, can be paused after a period of inactivity. Check Supabase's current free-plan terms before relying on it for a public launch.
- Points can only change through the database functions (`gift_points`, `redeem_reward`, `admin_adjust_points`, `admin_set_redemption_status`). The app cannot edit a balance directly.

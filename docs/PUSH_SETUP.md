# Phone notifications: one-time setup (no command line needed)

Everything is done in the Supabase website and in Cloudflare. Take it one step at a time. Keep a Notepad open to paste values into.

## What you will have at the end
- A morning weather message for each student's own place, a prayer reminder, a games reminder, and any message you add in Admin, **Daily notifications**, each at the time you choose.
- A phone message whenever a student gets points, a prize or a gift, and when a new reward is added.

## Step 1: the database
Supabase, **SQL Editor**: run these files from the `supabase` folder if you have not already (in this order): `013_push_and_weather.sql`, then `020_scheduled_notifications.sql`.

## Step 2: your keys
You made these already (a Public Key and a Private Key). If you lost them, run this in PowerShell and copy both: `npx web-push generate-vapid-keys`.
Also invent a long random password with no spaces (30 letters and numbers). This is your **PUSH_SECRET**.

## Step 3: put the public key in the app
1. In `.env.local` add `VITE_VAPID_PUBLIC_KEY=` followed by the Public Key (no spaces).
2. In Cloudflare, your project, **Settings**, **Build**, **Build variables and secrets**: add the same name and value.
3. Push anything to GitHub (or press Retry build) so the website rebuilds.
Check: on the live site, Profile shows a "Phone notifications" part.

## Step 4: create the function
1. Supabase, **Edge Functions**, **Deploy a new function**, **Via Editor**.
2. Name it exactly: `push`
3. In VS Code open `supabase/functions/push/index.ts`, press Ctrl+A then Ctrl+C. Paste it over everything in the editor. Press **Deploy**.
4. Open the function's settings (Details). Switch **off** "Enforce JWT verification" (it may be called "Verify JWT"). This is safe: the function refuses anyone without your PUSH_SECRET.

## Step 5: give it the secrets
Supabase, **Edge Functions**, **Secrets**, add these four (name, then value):
- `VAPID_PUBLIC_KEY` = your Public Key
- `VAPID_PRIVATE_KEY` = your Private Key
- `VAPID_SUBJECT` = `mailto:snacktic.service@gmail.com`
- `PUSH_SECRET` = your random password

## Step 6: two webhooks
Supabase, **Database**, **Webhooks**, **Create a new hook**. Make two. For both: Type **HTTP Request**, Method **POST**, and add an HTTP header named `x-push-secret` with your PUSH_SECRET as the value (keep `Content-Type: application/json`).
1. Name `push-messages`, table `notifications`, event **Insert**, URL `https://YOUR_REF.supabase.co/functions/v1/push?kind=message`
2. Name `push-new-reward`, table `rewards`, event **Insert**, URL `https://YOUR_REF.supabase.co/functions/v1/push?kind=reward`

YOUR_REF is the part of your Supabase address before `.supabase.co`.

## Step 7: the clock
1. Supabase, **Database**, **Extensions**: switch on `pg_cron` and `pg_net`.
2. **SQL Editor**: paste this, replace `YOUR_REF` and `YOUR_SECRET`, and run it. It checks every minute whether something is due.
```sql
select cron.schedule('push-scheduled', '* * * * *', $$ select net.http_post(
  url := 'https://YOUR_REF.supabase.co/functions/v1/push?kind=scheduled',
  headers := '{"Content-Type":"application/json","x-push-secret":"YOUR_SECRET"}'::jsonb,
  body := '{}'::jsonb) $$);
```
This has your secret in it, so do not save it in the project. To stop it later: `select cron.unschedule('push-scheduled');`

## Step 8: set it up in the admin
1. **Campus location**: the weather for students who have not shared their location.
2. **Daily notifications**: check the time zone (Nigeria is `Africa/Lagos`), then edit each notification. For the prayer reminder paste the school prayer link and switch it on.

## Step 9: test
1. On your phone, open the live site, sign in, Profile, **Turn on notifications**. Allow it. On iPhone, add Snacktic to the Home Screen first and open it from there.
2. In Admin, Daily notifications, edit the games reminder and set its time to 2 minutes from now. Wait. A notification should arrive.
3. If nothing arrives: Supabase, Edge Functions, `push`, **Logs**. Send me what it says.

## Good to know
- Each minute the function sends to up to 150 phones, then continues with the rest the next minute. With 3,000 students everyone is reached in about 20 minutes, which is why a notification should be "valid for" 30 minutes or more.
- Messages from the phones' point of view: students choose weather, prayer, games, new rewards and announcements in Profile.
- iPhones only receive notifications after Snacktic is added to the Home Screen.

# Phone notifications and daily weather: one-time setup

Everything here is free. You do this once. Use PowerShell in your project folder.
Replace `<ref>` with your project reference (the part of your Supabase address before `.supabase.co`).

## 1. Database
Run `supabase/013_push_and_weather.sql` in the Supabase SQL Editor.

## 2. Make the keys
```
npx web-push generate-vapid-keys
```
It prints a **Public Key** and a **Private Key**. Keep the private one secret (never in the project files).
Also invent a long random password for `PUSH_SECRET` (any 30+ letters and numbers).

## 3. Put the public key in the app
- In `.env.local` add: `VITE_VAPID_PUBLIC_KEY=<the public key>`
- In Cloudflare (your project, Settings, Variables) add the same name and value, then redeploy.

## 4. Install the Supabase tool and publish the two functions
```
npx supabase login
npx supabase link --project-ref <ref>
npx supabase secrets set VAPID_PUBLIC_KEY=<public key> VAPID_PRIVATE_KEY=<private key> VAPID_SUBJECT=mailto:snacktic.service@gmail.com PUSH_SECRET=<your random password>
npx supabase functions deploy send-push --no-verify-jwt
npx supabase functions deploy daily-weather --no-verify-jwt
```
(`--no-verify-jwt` is safe here because both functions refuse anyone who does not send your `PUSH_SECRET`.)

## 5. Send a phone message whenever a student gets an in-app message
Supabase dashboard, **Database, Webhooks, Create a new hook**:
- Table: `notifications`, Events: **Insert**
- Type: **HTTP Request**, Method: **POST**
- URL: `https://<ref>.supabase.co/functions/v1/send-push`
- HTTP Headers: add `x-push-secret` with your `PUSH_SECRET`, and keep `Content-Type: application/json`

## 6. Daily weather each morning
Set the campus location in the admin first (Campus location). Then, in the SQL Editor (this one has your secret in it, so do not save it in the project):
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'daily-weather',
  '30 5 * * *', -- 05:30 UTC, which is 06:30 in Nigeria. Change the numbers for another time.
  $$ select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/daily-weather',
       headers := '{"Content-Type":"application/json","x-push-secret":"<your random password>"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
```
To stop it later: `select cron.unschedule('daily-weather');`

## 7. Try it
Open the live website on your phone, sign in, Profile, **Turn on notifications**. To test the weather message, open the function in the Supabase dashboard (Edge Functions, daily-weather) and press **Test** with the header above.
- iPhone: only works after Snacktic is added to the Home Screen and opened from there.
- Android: works in Chrome, installed or not.
- Notifications only work on the live HTTPS website, not on `npm run dev`.

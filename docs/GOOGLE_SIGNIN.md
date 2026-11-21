# Turning on "Sign up with Google"

The buttons are already in the app (the sign-up screen, the Home banner and the tour). They only work once Google sign-in is switched on
in Supabase. This takes about 10 minutes, once.

1. **Google Cloud:** go to console.cloud.google.com, make a project (or use one), then *APIs & Services, OAuth consent screen*. Choose External,
   fill in the app name (Snacktic), your support email, and save. Add your site address under Authorized domains.
2. **Create the key:** *APIs & Services, Credentials, Create credentials, OAuth client ID*, type *Web application*.
   - Authorized JavaScript origins: your site address, for example `https://snacktic.app`
   - Authorized redirect URIs: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` (Supabase shows the exact address in the next step)
   Copy the **Client ID** and **Client secret**.
3. **Supabase:** *Authentication, Providers, Google*. Switch it on and paste the Client ID and secret. Save.
4. **Supabase, Authentication, URL Configuration:** set *Site URL* to your site address, and add the same address (with `/`) under *Redirect URLs*.
5. Run `supabase/031_signup_and_daily_rewards.sql` so a Google sign-up gets a username, a profile and the welcome bonus automatically.

A student who signs up with Google gets a nickname made from their email (they can change it in Profile). They add their name and WhatsApp
number later, only when they first redeem a physical reward, as before.

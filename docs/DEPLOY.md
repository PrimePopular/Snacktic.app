# Putting Snacktic online (free)

The app is a PWA: once it has a web address on HTTPS, students open it in their phone's browser and can
install it to the home screen. The installable and offline parts only switch on in the real (production)
build, not in `npm run dev`.

## 1. GitHub (backup and the link to hosting)
1. In VS Code open **Source Control** (the branch icon), choose **Initialize Repository**, type a message
   such as "Snacktic" and press **Commit**.
2. Choose **Publish to GitHub** and pick **Private**. `node_modules` and `.env.local` are skipped
   automatically (see `.gitignore`).
3. Turn on two-step sign-in for your GitHub account.

## 2. Cloudflare Pages (the free website)
1. Create a free Cloudflare account, then **Workers & Pages > Create > Pages > Connect to Git** and choose
   the Snacktic repository.
2. Build settings: **Build command** `npm run build`, **Build output directory** `dist`.
3. Under environment variables add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and
   `VITE_CONTACT_EMAIL` (the same values as your `.env.local`).
4. Deploy. You get an address like `snacktic.pages.dev`. Every time you push to GitHub it updates itself.
   The screens at Cloudflare change from time to time, so follow their wording if it differs slightly.

## 3. Tell Supabase about the new address
In Supabase open **Authentication > URL Configuration**. Set **Site URL** to your new address and add it
under **Redirect URLs**. Without this, password-reset links will not work on the live site.

## 4. Try it on a phone
- Open the address on a phone. After a first visit the app is saved on the phone.
- Turn on airplane mode and reopen it: events, places and news seen earlier still show, with a notice that
  they were saved earlier. Points, rewards and accounts always need a connection.
- Android: Profile shows an **Install Snacktic** button. iPhone: Safari > Share > **Add to Home Screen**.

## 5. Later
- A domain you own (about a yearly fee) lets email from Brevo avoid spam folders and gives a nicer address.
- Free Supabase projects pause after a week of inactivity and have no automatic backups. See
  `docs/LIMITS_AND_COSTS.md` before a public launch.
- When you release a new version of the app, the service worker (`public/sw.js`) refreshes itself. If you
  change how it saves files, raise `VERSION` at the top of that file.

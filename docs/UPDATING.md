# How updates reach students

1. You change the project and push it to GitHub (VS Code, Source Control, Commit, Sync/Push).
2. Cloudflare sees the push, builds the site and publishes it. Watch it under Deployments.
3. Phones and the installed app update by themselves:
   - Every time Snacktic opens with internet, it checks for a new version.
   - If one is found, it downloads in the background and a banner appears: "A new version of Snacktic is ready. Refresh". One tap and they are on it. If they ignore it, the next time they open the app they have it.
   - Students never reinstall anything.
4. Database changes are separate: run any new `supabase/0xx_*.sql` file in the Supabase SQL Editor (in number order) BEFORE or right after you publish the matching app update. Edge Function changes need their `npx supabase functions deploy <name> --no-verify-jwt` command.
5. A student who has been offline for a long time gets the update the next time they open the app with internet.

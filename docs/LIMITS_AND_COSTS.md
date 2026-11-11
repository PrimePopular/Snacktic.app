# Limits and costs (checked November 2026)

Figures come from Supabase's and Brevo's published plans at the time of writing. They change, so confirm
before launch. Everything below is free unless stated.

## Supabase free plan
- 50,000 monthly active users, 500 MB database, 1 GB file storage, 5 GB data transfer (egress) per month, unlimited API requests.
- Projects are **paused after one week of inactivity**. Paused means the app stops working until the project is restored.
- Automatic daily backups are, as far as I know, a paid-plan feature (Pro, from about $25 a month).

## What that means for about 3,000 students
- **Accounts and points**: comfortably fine. 3,000 users is a small fraction of the user limit, and text data (accounts, points, announcements, events) is tiny compared with the 500 MB database.
- **Pictures are the real limit.** Data transfer is only 5 GB a month. If every student loads several pictures a day, that is used up quickly. When pictures are added: shrink every image in the browser before upload (target 100 KB or less), cache them on the device, and look at serving them through Cloudflare's cache instead of straight from Supabase. Check Cloudflare's current free limits first.
- **The one-week pause matters on a campus**: holidays and exam breaks could pause the project. A paid plan removes the pause and adds backups. Plan on it before a public launch if the app must always be available.
- **Email**: the built-in email sender cannot be used for real students. Use a free email service through custom SMTP. Brevo's free plan allows, as far as I know, 300 emails a day, which is plenty for password resets but could be exceeded if everyone signs up on one day and email confirmation is switched on.

## Hosting
- Cloudflare Pages (free) for the website. Check its current build and traffic limits before launch.

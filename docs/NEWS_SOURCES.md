# News sources (checked 19 Nov 2026)

News is an automatic feed, separate from Announcements. Before building, each source's access, limits and permissions were checked.

| Source | Can we use it? | Limits and cost | Decision |
|---|---|---|---|
| **YouTube** (official Data API) | Yes | Free. 10,000 quota units a day per project. "Most popular in your country" costs **1 unit** a call (search costs 100, so never use search). More quota only by a compliance application. | **Use now.** One call every 30 minutes is about 50 units a day. |
| **RSS feeds** from news sites | Yes, headlines and links only | Free, no key. Show headline, small summary and a link out; never copy full articles. | **Use now.** You choose the sites. |
| **Reddit** (official API) | Not for a commercial app | Free tier is **non-commercial only**, needs approval and OAuth, 100 requests a minute. Commercial use needs a contract with Reddit. Unauthenticated access is blocked. | **Not used.** Revisit if Snacktic signs a Reddit agreement. |
| **X** | Technically yes, but paid | No free tier since Feb 2026. Pay-per-use, about $0.005 per post read. | **Not used** for now. Could be added later if budget allows. |

## Setting it up (one time)
1. Run `supabase/025_news_and_announcements.sql`.
2. Get a YouTube Data API key (Google Cloud, enable "YouTube Data API v3", create an API key).
3. In Supabase, create an Edge Function named `fetch-news` and paste `supabase/functions/fetch-news/index.ts`.
4. Add these secrets to the function: `NEWS_SECRET` (any long random text), `YOUTUBE_API_KEY`, optional `YOUTUBE_REGION` (default `NG`),
   and `NEWS_RSS_FEEDS` (comma separated feed addresses of the news sites you want).
5. Schedule it every 30 minutes the same way as the push scheduler, sending the header `x-news-secret`.

Until step 3 to 5 are done, students simply do not see a News tab. Nothing breaks.

## Ranking
YouTube stories rank by views (log scale). RSS stories rank by how fresh they are. Stories older than 7 days are removed.
The detailed summaries and ranking you described for a future update can replace the simple ones here without changing the database.

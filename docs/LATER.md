# Later (noted, not built yet)

Things asked for that are queued. Tell me which to do next.

## From the latest feedback
- **Treasure Hunt extras.** Harder hunts over time (for example codes that unlock in order), and a Treasure Hunt category in the Rewards Store.
- **UI polish pass.** A round of visual improvements after the features settle.

## Still to do
- **Treasure Hunt extras.** Harder hunts over time (for example codes that unlock in order), and a Treasure Hunt category in the Rewards Store.
- **UI polish pass.** A round of visual improvements after the features settle.
- Advertiser accounts and campaign approval; premium ad placement (paid for better exposure, always labelled AD).
- News from Reddit and X (see NEWS_SOURCES.md); you said you will explain how you want News to work.
- Run the load test in `docs/LOAD_TEST.md` on a copy of the project and decide the Supabase plan from the result.
- Coupon and gift-card codes shown as text (today a coupon, voucher or gift card is delivered as a link, for example to a page with the code).

## Switched off on purpose
- **Billboard likes and comments** are built but disconnected (the team felt empty like counts were discouraging). To bring them back, set `BILLBOARD_SOCIAL_ENABLED` to `true` in `src/features/billboards/flags.ts` and deploy. Planned for when Snacktic reaches about 3,000 students.

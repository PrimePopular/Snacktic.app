# Agreed decisions

## Find a Friend campaign
- The finder receives the campaign points. The person found receives nothing.
- Campaign points cannot be redeemed by the finder. They must be gifted to another student.
- Gifted points must be sent within **7 days**, after which they expire.
- A student can be found by many different students.
- One reward per finder-and-found pair per campaign. The same pair cannot earn again, in either direction, within that campaign.

## Guest Mode
- Guests can play every available game.
- Scores and progress are saved on the device only.
- Guests earn no permanent Crumb Points.
- After registering, a student can claim eligible scores from the previous **24 hours**. The server checks them before awarding points. Unclaimed scores expire after 24 hours.

## Score validation
- Every game defines its own scoring rules and maximum legitimate score (`SCORING.md`).
- The server checks that the score is achievable, the session is legitimate, the result is not a duplicate, reward limits are not exceeded, and the award is allowed.

## Cost
- The first release must run on free tiers only: GitHub, Cloudflare Pages, Supabase free plan.
- Expiry (gifts, guest scores) is checked when data is read rather than by a scheduled background job.
- Review current free-tier limits and commercial terms before a public launch.

## Games section layout
- Four permanent classic games, each with a fixed slot (1 to 4).
- Limited-time events such as Find a Friend are a separate "Special events" area, not part of the game list. They appear only between their start and end dates and then disappear.

my name
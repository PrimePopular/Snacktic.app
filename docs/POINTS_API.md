# Crumb Points: the one central place

All points logic lives in **`src/features/points/`**. Import from there and nowhere else:

```ts
import { getBalance, submitGameResult, giftPoints, listRewards } from '../../features/points';
```

A balance is never stored or edited by the app. It is the sum of transactions, and transactions are
only created by trusted database functions (`supabase/*.sql`). The app asks; the database decides.

## For game developers: you only report a result

You do **not** call the points service. Your game component calls `onFinish(result)` once, and the
Games page (`src/pages/games/GameHost.tsx`) sends the result through `submitGameResult()` for you.

```ts
onFinish({ gameId: 'catch-crumbs', score: 87, durationMs: 45000, finishedAt: new Date().toISOString() });
```

What happens next, with no extra code from you:

| Situation | Result |
| --- | --- |
| Signed in, online | Sent now. The server checks and pays, then the result screen shows "+N Crumb Points". |
| Guest | Kept on the phone for 24 hours. After they create an account and sign in, it is sent and checked. |
| Signed in but offline | Kept and retried automatically when the phone is back online. |

The server refuses results that are impossible (score above the maximum, round too short or too long,
from the future, older than 24 hours) and never pays the same result twice.

## Modes: regular play and daily challenges

A game can have several modes. Report which one was played in `mode` (lowercase letters, numbers and dashes):

```ts
onFinish({ gameId: 'number-rush', mode: 'classic', score: 42, durationMs: 60000, finishedAt: ... });
onFinish({ gameId: 'number-rush', mode: 'daily',   score: 118, durationMs: 300000, finishedAt: ... });
onFinish({ gameId: 'ai-match',    mode: 'level-4', score: 1, durationMs: 240000, finishedAt: ... }); // 1 = won, 0 = lost
```

Each game and mode pair gets its own rule, so an easy mode can pay little (or nothing) and a hard daily
challenge can pay a lot. Games with one mode can leave `mode` out. To show a game's modes on its card, list
them in `modes` when registering it in `src/games/registry.ts`.

## Two ways to pay

| Pays | Good for | How |
| --- | --- | --- |
| A fixed amount | beating an AI level, finishing a puzzle | first round of the day pays one amount, replays pay a smaller one |
| An amount that grows with the score | a timed number game | points per score point, up to a maximum per round; replays pay a chosen percentage |

For win-or-lose games report `score: 1` for a win and `score: 0` for a loss, and set "score needed to earn
anything" to 1. A loss then pays nothing and does not use up the day's first-round bonus.

## Rules are set by the owner, not in code

Nothing is paid for a game until the owner adds a rule in **Admin > Game points**:

- a **fixed amount** (first round of the day, and a smaller amount for each replay) or **points that depend on the score**,
- the **score needed to earn anything**,
- the **daily cap**: the most one student can earn from that game and mode per day,
- the **highest possible score** and the **shortest / longest realistic round**,
- the **time zone** that decides when a new day starts.

The game id in the rule must equal the game's folder name (for example `catch-crumbs`), and the mode id must equal the `mode` the game reports. Each game
developer documents these numbers in the game's `SCORING.md` (copy `docs/GAME_SCORING_TEMPLATE.md`).

## For other modules

| Need | Function |
| --- | --- |
| Show the balance | `getBalance()` |
| Activity list | `listHistory(limit)` |
| Reward shop | `listRewards()`, `redeemReward(id)`, `listMyRedemptions()` |
| Send points to a friend | `giftPoints(username, amount)` |
| Send a finished game result (the Games page does this) | `submitGameResult(result, signedIn)` |
| Send results that were waiting (the app does this automatically) | `flushPendingResults()` |

Owner-only functions (`admin*`) exist for the admin panel and are refused by the database for anyone else.

## Trying it without a real game

`src/games/_template` is a tiny working game (tap for 10 seconds). Copy it, or register it temporarily in
`src/games/registry.ts` with id `tap-test`, add a rule for `tap-test` in the admin panel, and play it.
Remove the registration before launch.

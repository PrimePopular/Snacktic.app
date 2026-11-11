# Scoring rules: Tap Test (template)

This file shows how a finished SCORING.md looks. Copy it with the game folder and edit it.

## How scoring works
One point per tap during a 10 second round.

## Round length
Always exactly 10 seconds (10,000 ms).

## Maximum legitimate score
About 15 taps per second is the fastest a human can tap, so 150 in 10 seconds. The owner sets
`max_score` for this game to 150 in the admin panel (Games tab).

## Fastest plausible completion
The round is fixed at 10 seconds, so `min_duration_ms` and `max_duration_ms` are both about 10,000.

## Modes
- `practice`: replay as much as you like. Owner sets a small fixed amount.
- `daily`: the daily challenge. Owner sets points that depend on the score (for example 0.5 points per tap, at most 60 per round).

## Result submitted
`gameId: 'tap-test'`, `mode` ('practice' or 'daily'), `score` (taps), `durationMs: 10000`, `finishedAt` (ISO time).

## Suggested reward rule
Set by the owner in the admin panel: points for the first round of the day, a smaller amount for
replays, and a daily cap per student. Nothing is paid until the owner sets amounts.

## Known weaknesses
A script could call the result function directly. The server limits this with the maximum score,
the time window, one daily bonus and the daily cap, so the damage is capped.

# Scoring rules: <Game name>

Copy this file to `src/games/<game-id>/SCORING.md` and complete every section before integration.

## How scoring works
Plain description of how points are earned during a round.

## Round length
Minimum and maximum possible duration in seconds.

## Maximum legitimate score
The highest score achievable by perfect play in one round, and how you calculated it.

## Fastest plausible completion
The shortest realistic round time for a given score (used to reject impossible results).

## Result submitted
Fields reported through `onFinish`: `gameId`, `score`, `durationMs`, `finishedAt`, plus anything extra the server needs to verify the round (for example, number of matches made).

## Numbers the owner needs (Admin > Game points)
- Highest possible score
- Shortest realistic round, in seconds
- Longest realistic round, in seconds

## Suggested reward rule
How a score converts to Crumb Points, and a suggested daily cap. The final numbers are set by the backend developer and the project owner.

## Known weaknesses
Ways a player could cheat in this game that the server should watch for.

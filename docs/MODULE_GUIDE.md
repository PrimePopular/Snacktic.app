# Module guide

How to build a module so it drops into Snacktic without touching anyone else's code.

## 1. Ownership and boundaries

| Module | Files you may edit | Do not edit without permission |
| --- | --- | --- |
| Home | `src/pages/home/` | everything else |
| Discover | `src/pages/discover/`, `src/features/{events,products,locations,stock}` | other pages, `src/core/`, `src/shared/` |
| Games (selection page) | `src/pages/games/` | `src/core/`, `src/games/game.types.ts` |
| Special events (e.g. Find a Friend) | `src/special-events/<event-id>/` plus one entry in `specialEvents` in `src/games/registry.ts` | other pages |
| A single game | `src/games/<game-id>/` plus one entry in `src/games/registry.ts` | other games, other pages |
| Rewards | `src/pages/rewards/`, `src/features/points/` | other pages |
| Profile and auth | `src/pages/profile/`, `src/features/authentication/` | other pages |
| Backend | `src/services/`, `supabase/` (migrations and policies) | pages |
| Admin | `src/admin/` | student pages |
| PWA | `src/pwa/`, `public/manifest.webmanifest` | pages |

Shared files (`src/core/`, `src/shared/`, `src/styles/`, `index.html`, `package.json`, `vite.config.ts`) belong to the Foundation developer. If you need a change, open an issue or describe it in your Pull Request.

## 2. Adding a game

The Games page has two areas. **Classic games** are the four permanent games, each with a fixed slot (1 to 4) so the layout never shifts. **Special events** are limited-time, game-like campaigns (Find a Friend and similar). They have a start and end date, appear only while active, and then disappear. Do not register a special event as a classic game.

1. Create `src/games/<game-id>/index.tsx` with a **default export** component taking `GameProps` (see `src/games/game.types.ts`).
2. Call `onFinish({ gameId, score, durationMs, finishedAt })` exactly once when the round ends.
3. Add one entry to `classicGames` in `src/games/registry.ts` with your `slot` (an example is in that file).
4. Copy `docs/GAME_SCORING_TEMPLATE.md` to `src/games/<game-id>/SCORING.md` and fill it in. A game is not ready to integrate without it.
5. Keep the game self-contained: its own CSS file, its own assets under `public/sounds/<game-id>/` or inside its folder.
6. A game must work offline and must **never** change a permanent points balance. It only reports its result through `onFinish`. See `docs/POINTS_API.md` for how points are paid, and ask the owner to add a rule for your game id in Admin > Game points.
7. If your game has modes (for example regular and daily challenge), report the mode in `onFinish` and list the modes on the game's registry entry. See `docs/POINTS_API.md`.
8. `src/games/_template` is a tiny working game with two modes to copy from.

### Adding a special event

1. Create `src/special-events/<event-id>/index.tsx` with a default export taking `SpecialEventProps`.
2. Add an entry to `specialEvents` in `src/games/registry.ts` with `startsAt` and `endsAt`.
3. The event is shown only between those dates. The device clock decides what is displayed; the **server** must check the dates before awarding anything.
4. In Phase 5 the list moves into the database so administrators can start and end events from the dashboard.

## 3. Shared services (agreed interfaces)

Modules talk to central systems through these interfaces, not through each other's code. They are created in Phase 2 with sample data and switched to the database in Phase 4. Their shapes will not change when that happens.

```ts
// src/features/points/pointsService.ts
getBalance(): Promise<number>
getHistory(): Promise<PointsTransaction[]>
requestGameAward(result: GameResult): Promise<AwardOutcome>   // server validates
giftPoints(toUsername: string, amount: number): Promise<GiftOutcome>

// src/features/events | products | locations | stock
listEvents(): Promise<EventItem[]>
listProducts(): Promise<Product[]>
listLocations(): Promise<Location[]>
getStock(locationId: string): Promise<StockEntry[]>
```

Rules: pages request data through these functions, never keep their own copy of balances, events, products or stock, and always handle loading, empty and error states with the shared components.

## 4. Design rules

- Colours, fonts, spacing and radii come from `src/styles/variables.css`. Brown text on orange passes contrast; white text on orange does not, so use brown.
- Mobile first. Test at 360px wide, then widen.
- Tap targets at least 44px. Keep visible focus outlines.
- Respect reduced motion (already handled globally; do not override it).
- Use `Button`, `Card`, `PageHeader`, `EmptyState` and `Loading` from `src/shared/components` before writing your own.

## 5. Offline rules (for the PWA developer)

- App shell and static assets: cache-first with versioned cache names.
- Events, products, announcements: network-first, fall back to cache, and label cached data as possibly out of date.
- **Never serve points, account, gifting or redemption data from a stale cache.** Those calls must always go to the network and fail clearly when offline.
- Fonts: download Space Grotesk and DM Sans as `.woff2` into `public/fonts/` and add `@font-face` rules so they work offline (currently loaded from Google Fonts in `index.html`).
- The icons in `public/icons/` were cut from the brand sheet at low resolution. Replace them with high-resolution exports of the app icon when available.

## 6. Security reminders

- Only the Supabase **anon** key belongs in frontend code, via `.env.local`. The service-role key never enters this repository.
- Every table needs Row Level Security. Hiding the `/admin` route protects nothing on its own.
- Points awards, gifts and redemptions are decided on the server, never by the phone.

## 7. Done means

Source, styles, assets, a note on dependencies, how to run and test it, and known limitations, as listed in the project plan.

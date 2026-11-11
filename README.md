# Snacktic

Good snacks, good moments. A campus Progressive Web App (React, TypeScript, Vite, Supabase).

**Status: Phase 1 complete.** Application shell with working navigation and placeholder pages for the five sections. No backend yet.

## Run it

Requires Node.js 18 or newer. Run all commands from the folder that contains `package.json`, and run `npm install` first. Without it, commands such as `npm run typecheck` fail with "tsc is not recognized".

```bash
npm install        # run again whenever package.json changes
npm run dev        # http://localhost:5173
npm run typecheck  # type check without building
npm run build      # production build into dist/
```

Open the app on a phone on the same Wi-Fi by running `npm run dev -- --host`.

## Where things live

| Folder | What goes there | Owner |
| --- | --- | --- |
| `src/core/` | App entry, router, navigation, shell | Foundation |
| `src/shared/components/` | Reusable buttons, cards, empty states | Foundation |
| `src/styles/` | Design tokens and global styles | Foundation |
| `src/pages/<section>/` | The five main pages | One developer each |
| `src/games/<game-id>/` | One folder per classic game (4 fixed slots) | Game developers |
| `src/special-events/<id>/` | Limited-time events such as Find a Friend | Rewards |
| `src/features/` | Central systems (points, events, products, ...) | See `docs/MODULE_GUIDE.md` |
| `src/services/` | Database, auth and sync access | Backend |
| `src/admin/` | Administrative dashboard | Admin |
| `src/pwa/` | Service worker and registration | PWA |

Maps use OpenStreetMap embeds (free, no account or key). A map with many pins would need the Leaflet library, which needs approval first.

Bottom tabs: Home, Discover, Games, Rewards. Profile is the avatar in the top bar.

Routes: `/#/` Home, `/#/discover`, `/#/games`, `/#/games/:id`, `/#/games/events/:id`, `/#/rewards`, `/#/profile`, `/#/admin`.

## Read next

- `docs/SUPABASE_SETUP.md` to create the free database (needed before Home, Rewards, Profile and Admin work with real data).
- `docs/ROADMAP.md` for what is built, what is next and the owner's decided rules.
- `docs/DEPLOY.md` to put the app online for free and test it on phones.
- `docs/POINTS_API.md` for how points work and how games get paid (read this before building a game).
- `docs/LIMITS_AND_COSTS.md` for free-plan limits and what they mean at about 3,000 students.
- `docs/MODULE_GUIDE.md` for ownership, rules and how to drop a module in.
- `docs/DECISIONS.md` for the agreed rules (Find a Friend, guest points, score validation).
- `docs/GAME_SCORING_TEMPLATE.md` for the scoring document every game must include.

## Rules in one minute

- Work on your own branch (`feature/<module>`), open a Pull Request, never commit to `main`.
- Edit only your own folder. Shared files belong to the Foundation developer.
- Use the tokens in `src/styles/variables.css`. Do not invent new colours or fonts.
- No new libraries without approval. Everything here must run on free tiers.
- Never commit `.env` files, passwords or service keys.

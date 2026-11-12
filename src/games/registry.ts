import type { ClassicSlot, GameDefinition, SpecialEventDefinition } from './game.types';

/**
 * The four permanent positions on the Games page. A slot with no registered game shows as
 * "coming soon" with its planned name, so the page layout never shifts when a game arrives.
 */
export const classicSlots: { slot: ClassicSlot; plannedName: string }[] = [
  { slot: 1, plannedName: 'Crumbly' },
  { slot: 2, plannedName: 'Crumb Quest' },
  { slot: 3, plannedName: 'Coming soon' },
  { slot: 4, plannedName: 'Coming soon' },
];

/**
 * Register each classic game here, one entry per game. Adding one entry is all a game
 * developer needs to change in shared code. Example (uncomment when the game exists):
 *
 * {
 *   id: 'catch-crumbs',
 *   slot: 1,
 *   title: 'Catch the Crumbs',
 *   summary: 'Catch falling crumbs before they hit the floor.',
 *   instructions: 'Drag left and right to catch crumbs. Miss three and the game ends.',
 *   estimatedSeconds: 45,
 *   load: () => import('./catch-crumbs'),
 * },
 */
export const classicGames: GameDefinition[] = [
  {
    id: 'crumbly',
    slot: 1,
    title: 'Crumbly',
    summary: 'Merge matching cookies before the rows reach the top.',
    instructions: 'Tap a column to drop a cookie. Touching cookies with the same number merge into the next number. Do not let a rising row push a cookie out of the top.',
    estimatedSeconds: 180,
    modes: [
      { id: 'classic', label: 'Classic' },
      { id: 'daily', label: 'Daily Challenge', dailyChallenge: true },
    ],
    load: () => import('./crumbly'),
  },
  {
    id: 'crumb-quest',
    slot: 2,
    title: 'Crumb Quest',
    summary: 'Build words from the letter cookies.',
    instructions: 'Slide across the letters to spell words and fill the board. In the Daily Quest you race the cookie alarm through 10 levels.',
    estimatedSeconds: 120,
    modes: [
      { id: 'classic-bake', label: 'Classic Bake' },
      { id: 'daily-quest', label: 'Daily Quest', dailyChallenge: true },
    ],
    load: () => import('./crumb-quest'),
  },
];

export function findGame(id: string): GameDefinition | undefined {
  return classicGames.find((game) => game.id === id);
}

/**
 * Limited-time events (for example Find a Friend). None are hard-coded: there is nothing here
 * until an event exists. Phase 5 loads them from the database, where administrators create and
 * end them without a code change. Until then this list stays empty.
 */
export const specialEvents: SpecialEventDefinition[] = [];

export function findSpecialEvent(id: string): SpecialEventDefinition | undefined {
  return specialEvents.find((event) => event.id === id);
}

/**
 * Uses the device clock, which is fine for deciding what to show. It is NOT used to decide
 * whether points are awarded: the server checks the event dates itself.
 */
export function isEventActive(event: SpecialEventDefinition, now: Date = new Date()): boolean {
  const time = now.getTime();
  return time >= Date.parse(event.startsAt) && time < Date.parse(event.endsAt);
}

/** Anything that can appear in the Home feed and belongs to a category. Places have no start time. */
export interface Rankable {
  id: string;
  categoryId: number | null;
  startsAt?: string;
}

/** How soon an item is, 0 to 1. Ongoing and imminent events matter most; places have no time, so sit in the middle. */
function timeScore(item: Rankable, now: number): number {
  if (!item.startsAt) return 0.4;
  const hoursToStart = (Date.parse(item.startsAt) - now) / 3_600_000;
  if (hoursToStart <= 0) return 1;
  if (hoursToStart <= 72) return 0.8;
  if (hoursToStart <= 168) return 0.5;
  return 0.2;
}

/**
 * Brand new student: events in the order they happen, with places woven in after every 2 events
 * so the feed is a mix from the very first visit.
 */
function coldStart<T extends Rankable>(items: readonly T[]): T[] {
  const timed = items
    .filter((i) => i.startsAt)
    .sort((a, b) => Date.parse(a.startsAt as string) - Date.parse(b.startsAt as string));
  const untimed = items.filter((i) => !i.startsAt);
  const out: T[] = [];
  let u = 0;
  timed.forEach((item, index) => {
    out.push(item);
    if ((index + 1) % 2 === 0 && u < untimed.length) out.push(untimed[u++]);
  });
  while (u < untimed.length) out.push(untimed[u++]);
  return out;
}

/** How much of the student's total interest sits in this item's category, 0 to 1. */
function share(item: Rankable, affinity: ReadonlyMap<number, number>, total: number): number {
  if (item.categoryId === null) return 0;
  return (affinity.get(item.categoryId) ?? 0) / total;
}

/** Share of interest below which a category counts as "outside what they usually pick". */
const LOW_INTEREST = 0.1;
/** Every Nth card (the 4th, 8th, ...) is a deliberate surprise from outside their usual picks. */
const SURPRISE_EVERY = 4;
/** Below this much total interest there is nothing to learn from yet. */
const MIN_TOTAL_INTEREST = 1;

/**
 * Orders the Home feed (events and places together).
 *  - A brand new student sees events in the order they happen with places woven in.
 *  - Otherwise items score 65% on how much the student likes that category and 35% on how soon it
 *    is, and every 4th card is swapped for one from a category they rarely pick, to see how they
 *    respond. Discover is never personalised: it lists everything.
 */
export function rankForHome<T extends Rankable>(
  items: readonly T[],
  affinity: ReadonlyMap<number, number>,
  now: number,
  random: () => number = Math.random,
): T[] {
  let total = 0;
  for (const value of affinity.values()) total += value;
  if (total < MIN_TOTAL_INTEREST) return coldStart(items);

  const result = items
    .map((item) => ({ item, score: 0.65 * share(item, affinity, total) + 0.35 * timeScore(item, now) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Date.parse(a.item.startsAt ?? '9999-01-01') - Date.parse(b.item.startsAt ?? '9999-01-01'),
    )
    .map((entry) => entry.item);

  const used = new Set<string>();
  for (let slot = SURPRISE_EVERY - 1; slot < result.length; slot += SURPRISE_EVERY) {
    const candidates = result
      .slice(slot + 1)
      .filter((c) => !used.has(c.id) && share(c, affinity, total) < LOW_INTEREST);
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(random() * candidates.length)];
    used.add(pick.id);
    result.splice(result.indexOf(pick), 1);
    result.splice(slot, 0, pick);
  }
  return result;
}

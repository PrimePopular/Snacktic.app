import type { Ad } from './ads.types';

export type Woven<T> = { kind: 'item'; item: T } | { kind: 'ad'; ad: Ad; key: string };

/** One random seed for this visit, so ties between equally fresh ads break differently each visit but never while scrolling. */
const seed = Math.random();

function rank(key: string): number {
  let h = 2166136261;
  const text = `${seed}:${key}`;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

const SHOWN_KEY = 'snacktic.adShown';

function shownTimes(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SHOWN_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

/** Remember that this ad was just seen on this phone, so the next section starts with a different one. */
export function markAdShown(id: string): void {
  try {
    const map = shownTimes();
    map[id] = Date.now();
    localStorage.setItem(SHOWN_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable: rotation simply falls back to a random order */
  }
}

/**
 * Puts the ads in rotation order for one section: the ad this phone has seen least recently comes first. So Home can show one
 * ad, Discover another, Games a third and Rewards a fourth, and every active ad gets its turn. Ads never disappear: the one
 * shown longest ago simply comes up again. Computed once per screen, so ads don't change while someone scrolls.
 */
export function orderAds(allAds: readonly Ad[], section: string): Ad[] {
  const seen = shownTimes();
  return [...allAds].sort((a, b) => (seen[a.id] ?? 0) - (seen[b.id] ?? 0) || rank(`${section}:${a.id}`) - rank(`${section}:${b.id}`));
}

/**
 * Mixes ads (already in rotation order) into a list so they look like part of it. An ad comes after the 3rd item and then
 * after every 5th item, so an ad is never first, never second and never next to another ad. A list of just 2 items still
 * gets one ad at the end.
 */
export function weaveAds<T>(items: readonly T[], ads: readonly Ad[]): Woven<T>[] {
  const out: Woven<T>[] = [];
  let next = 0;
  items.forEach((item, i) => {
    out.push({ kind: 'item', item });
    const n = i + 1;
    if (ads.length > 0 && n >= 3 && (n - 3) % 5 === 0) {
      out.push({ kind: 'ad', ad: ads[next % ads.length], key: `ad-${n}` });
      next += 1;
    }
  });
  if (ads.length > 0 && items.length === 2) out.push({ kind: 'ad', ad: ads[0], key: 'ad-end' });
  return out;
}

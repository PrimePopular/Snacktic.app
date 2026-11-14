import type { Ad } from './ads.types';

export type Woven<T> = { kind: 'item'; item: T } | { kind: 'ad'; ad: Ad; key: string };

/** One random seed for this visit: ads come in a different order each visit but never reshuffle while someone scrolls. */
const seed = Math.random();

function rank(id: string): number {
  let h = 2166136261;
  const text = `${seed}:${id}`;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/**
 * Mixes ads into a list so they look like part of it. An ad comes after the 3rd item and then after every 5th item,
 * so an ad is never first, never second and never next to another ad. Ads take turns, and come round again in a long
 * list. A list of just 2 items still gets one ad at the end.
 */
export function weaveAds<T>(items: readonly T[], allAds: readonly Ad[]): Woven<T>[] {
  const ads = [...allAds].sort((a, b) => rank(a.id) - rank(b.id));
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

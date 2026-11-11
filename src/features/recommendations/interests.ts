/**
 * What each student seems to like, kept ONLY on their own device (nothing is sent anywhere).
 * Each event category number collects a score when the student opens, filters by or contacts about
 * that kind of event. Old interest fades with a half-life of two weeks, so the feed follows
 * changing tastes. Owned by the Home developer.
 */
const KEY = 'snacktic.interests';
export const HALF_LIFE_DAYS = 14;
const DAY_MS = 86_400_000;

interface Entry {
  score: number;
  at: number;
}
type Stored = Record<string, Entry>;

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Stored) : {};
  } catch {
    return {};
  }
}

function write(data: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable (private mode): the feed just stays unpersonalised */
  }
}

/** Score after fading. Exported so it can be tested. */
export function decayed(entry: Entry, now: number): number {
  const days = Math.max(0, (now - entry.at) / DAY_MS);
  return entry.score * Math.pow(0.5, days / HALF_LIFE_DAYS);
}

/** Adds interest in a category. Weights used: open details 2, tap a filter 1, tap a contact button 3. */
export function recordInterest(categoryId: number | null, weight: number, now: number = Date.now()): void {
  if (categoryId === null) return;
  const data = read();
  const key = String(categoryId);
  const previous = data[key] ? decayed(data[key], now) : 0;
  data[key] = { score: previous + weight, at: now };
  write(data);
}

/** Current (faded) interest per category number. */
export function getAffinities(now: number = Date.now()): Map<number, number> {
  const out = new Map<number, number>();
  for (const [key, entry] of Object.entries(read())) {
    const id = Number(key);
    const value = decayed(entry, now);
    if (Number.isFinite(id) && value > 0.01) out.set(id, value);
  }
  return out;
}

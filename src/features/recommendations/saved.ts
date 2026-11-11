/** Events and places a student has tapped the heart on. Kept only on their own device. */
const KEY = 'snacktic.saved';

export type SavedKind = 'event' | 'place';

const keyOf = (kind: SavedKind, id: string) => `${kind}:${id}`;

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function savedKeys(): Set<string> {
  return new Set(read());
}

export function isSaved(kind: SavedKind, id: string): boolean {
  return read().includes(keyOf(kind, id));
}

/** Flips the saved state and returns the new one. */
export function toggleSaved(kind: SavedKind, id: string): boolean {
  const all = read();
  const key = keyOf(kind, id);
  const next = all.includes(key) ? all.filter((k) => k !== key) : [...all, key];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the heart works until the page closes */
  }
  return next.includes(key);
}

export const savedKey = keyOf;

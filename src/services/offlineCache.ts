/**
 * Keeps the last good copy of public lists (events, places, news, categories) on the phone, so the
 * app can still show something with no connection. Used ONLY for public browsing data.
 * Points, accounts, gifts and orders are never kept here: they must always be live.
 */
const PREFIX = 'snacktic.cache.';
const NETWORK_PROBLEM = /failed to fetch|network|load failed|fetch failed/i;

let servingSaved = false;
const listeners = new Set<() => void>();

function setServingSaved(value: boolean) {
  if (servingSaved === value) return;
  servingSaved = value;
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  // Back online: the next load fetches fresh data, so stop saying the data is old.
  window.addEventListener('online', () => setServingSaved(false));
}

export const isServingSavedData = () => servingSaved;

export function subscribeSavedData(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

interface Saved<T> {
  at: number;
  data: T;
}

function read<T>(key: string): Saved<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Saved<T>) : null;
  } catch {
    return null;
  }
}

function write<T>(key: string, data: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full or unavailable: the app just works online only */
  }
}

/**
 * Runs the fetch. On success, saves the result. If the connection fails and a saved copy exists,
 * returns that copy instead (and flags it so the screen can say so). Real errors still throw.
 */
export async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const data = await fetcher();
    write(key, data);
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (NETWORK_PROBLEM.test(message)) {
      const saved = read<T>(key);
      if (saved) {
        setServingSaved(true);
        return saved.data;
      }
    }
    throw error;
  }
}

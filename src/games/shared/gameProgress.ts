/**
 * Keeps a student's game progress safe. Games save their progress in this phone's storage; this copies it to the
 * database (and back), so it survives clearing the browser, a new phone, or the phone tidying old data.
 * Only keys that belong to the game are copied, and never the daily-challenge state (the server handles that).
 */
import { supabase } from '../../services/database';

export interface ProgressSpec {
  gameId: string;
  /** Only storage keys starting with one of these belong to the game. */
  prefixes: string[];
  /** Keys that are never copied. */
  exclude?: string[];
}

const markerKey = (gameId: string) => `snacktic.progressAt.${gameId}`;

function ownKeys(spec: ProgressSpec): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && spec.prefixes.some((p) => key.startsWith(p)) && !(spec.exclude ?? []).includes(key)) keys.push(key);
  }
  return keys;
}

async function signedIn(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

/** Before the game opens: bring the saved copy back if it is newer than what this phone has. Never throws. */
export async function restoreProgress(spec: ProgressSpec): Promise<void> {
  try {
    if (!supabase || !(await signedIn())) return;
    const { data, error } = await supabase.from('game_progress').select('data, updated_at').eq('game_id', spec.gameId).maybeSingle();
    if (error || !data) return;
    const saved = Date.parse((data as { updated_at: string }).updated_at);
    const local = Number(localStorage.getItem(markerKey(spec.gameId)) ?? 0);
    if (!(saved > local)) return;
    const values = (data as { data: Record<string, string> }).data;
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'string' && spec.prefixes.some((p) => key.startsWith(p)) && !(spec.exclude ?? []).includes(key)) localStorage.setItem(key, value);
    }
    localStorage.setItem(markerKey(spec.gameId), String(saved));
  } catch (error) {
    console.error('[games] restore progress', error);
  }
}

/** Copy this phone's progress to the database. Never throws. */
export async function saveProgress(spec: ProgressSpec): Promise<void> {
  try {
    if (!supabase || !(await signedIn())) return;
    const values: Record<string, string> = {};
    for (const key of ownKeys(spec)) {
      const value = localStorage.getItem(key);
      if (value !== null) values[key] = value;
    }
    if (Object.keys(values).length === 0) return;
    const { error } = await supabase.rpc('save_game_progress', { p_game_id: spec.gameId, p_data: values });
    if (error) throw new Error(error.message);
    localStorage.setItem(markerKey(spec.gameId), String(Date.now() + 2000));
  } catch (error) {
    console.error('[games] save progress', error);
  }
}

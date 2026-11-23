import { supabase } from '../../services/database';

export type CrossSection = 'home' | 'discover' | 'billboards' | 'games' | 'rewards';
export type CrossKind = 'reward' | 'place' | 'billboard' | 'game';

export const CROSS_SECTIONS: CrossSection[] = ['home', 'discover', 'billboards', 'games', 'rewards'];
export const CROSS_KINDS: CrossKind[] = ['reward', 'place', 'billboard', 'game'];

export const sectionNames: Record<CrossSection, string> = { home: 'Home', discover: 'Discover', billboards: 'Billboards', games: 'Games', rewards: 'Rewards' };
export const kindNames: Record<CrossKind, string> = { reward: 'Rewards', place: 'Places to visit', billboard: 'Billboard posts', game: 'Games' };

export type CrossMatrix = Record<CrossSection, CrossKind[]>;

/** What shows where until the owner changes it. A section never shows its own kind (Rewards has no reward teasers). */
export const DEFAULT_MATRIX: CrossMatrix = {
  home: ['reward', 'game', 'place', 'billboard'],
  discover: ['billboard', 'reward', 'game'],
  billboards: ['reward', 'place', 'game'],
  games: ['place', 'billboard', 'reward'],
  rewards: ['place', 'billboard', 'game'],
};

const KEY = 'cross_matrix';
let cached: { at: number; value: CrossMatrix } | null = null;

function clean(raw: unknown): CrossMatrix {
  const out = { ...DEFAULT_MATRIX };
  if (!raw || typeof raw !== 'object') return out;
  for (const section of CROSS_SECTIONS) {
    const list = (raw as Record<string, unknown>)[section];
    if (Array.isArray(list)) out[section] = list.filter((k): k is CrossKind => CROSS_KINDS.includes(k as CrossKind));
  }
  return out;
}

/** Public. Falls back to the defaults if nothing is saved yet or the setting cannot be read. */
export async function getCrossMatrix(force = false): Promise<CrossMatrix> {
  if (cached && !force && Date.now() - cached.at < 60_000) return cached.value;
  let value = DEFAULT_MATRIX;
  if (supabase) {
    try {
      const { data } = await supabase.from('app_settings').select('value').eq('key', KEY).maybeSingle();
      if (data?.value) value = clean(JSON.parse(String(data.value)));
    } catch {
      /* use the defaults */
    }
  }
  cached = { at: Date.now(), value };
  return value;
}

/** Owner only. */
export async function saveCrossMatrix(matrix: CrossMatrix): Promise<void> {
  if (!supabase) throw new Error('The database is not connected yet.');
  const { error } = await supabase.from('app_settings').upsert({ key: KEY, value: JSON.stringify(matrix) }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
  cached = { at: Date.now(), value: matrix };
}

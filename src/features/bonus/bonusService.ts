import { supabase } from '../../services/database';
import type { BonusStat, BonusStatus } from './bonus.types';
import { BONUS_SECTIONS } from './bonus.types';

/** Used when the database update (supabase/022) has not been run yet: no promotion, nothing breaks. */
export const NO_BONUS: BonusStatus = { enabled: false, eligible: false, eligibilityDays: 7, newUserEvery: 4, othersEvery: 12, sections: [...BONUS_SECTIONS], claimed: [] };

interface StatusRow {
  enabled: boolean;
  eligible: boolean;
  eligibility_days: number;
  new_user_every: number;
  others_every: number;
  sections: string[] | null;
  claimed: string[] | null;
}

let cached: { at: number; value: BonusStatus } | null = null;

/** Works for visitors too. Cached for a minute so every section does not ask again. */
export async function getBonusStatus(force = false): Promise<BonusStatus> {
  if (!supabase) return NO_BONUS;
  if (!force && cached && Date.now() - cached.at < 60_000) return cached.value;
  try {
    const { data, error } = await supabase.rpc('bonus_status');
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as StatusRow | undefined;
    if (!row) return NO_BONUS;
    const value: BonusStatus = {
      enabled: row.enabled,
      eligible: row.eligible,
      eligibilityDays: row.eligibility_days,
      newUserEvery: row.new_user_every,
      othersEvery: row.others_every,
      sections: row.sections ?? [...BONUS_SECTIONS],
      claimed: row.claimed ?? [],
    };
    cached = { at: Date.now(), value };
    return value;
  } catch {
    return NO_BONUS;
  }
}

export function forgetBonusStatus(): void {
  cached = null;
}

const seen = new Set<string>();

/** Counts a view once per visit, or a click each time. Never blocks or shows an error. */
export function trackBonus(rewardId: string, kind: 'view' | 'click'): void {
  if (!supabase) return;
  if (kind === 'view') {
    if (seen.has(rewardId)) return;
    seen.add(rewardId);
  }
  void supabase.rpc('track_bonus', { p_reward: rewardId, p_kind: kind }).then(() => undefined, () => undefined);
}

export async function adminBonusStats(): Promise<BonusStat[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('admin_bonus_stats');
  if (error) throw new Error(error.message);
  return ((data ?? []) as { reward_id: string; reward_name: string; views: number; clicks: number; claims: number }[]).map((r) => ({
    rewardId: r.reward_id,
    name: r.reward_name,
    views: Number(r.views),
    clicks: Number(r.clicks),
    claims: Number(r.claims),
  }));
}

export async function adminSaveBonusSettings(input: { enabled: boolean; eligibilityDays: number; newUserEvery: number; othersEvery: number; sections: string[] }): Promise<void> {
  if (!supabase) throw new Error('The database is not connected yet.');
  const { error } = await supabase
    .from('bonus_settings')
    .update({ enabled: input.enabled, eligibility_days: input.eligibilityDays, new_user_every: input.newUserEvery, others_every: input.othersEvery, sections: input.sections })
    .eq('id', true);
  if (error) throw new Error(error.message);
  forgetBonusStatus();
}

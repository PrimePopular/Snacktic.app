import { supabase } from '../../services/database';
import { notifyPointsChanged } from './pointsService';

export interface RewardSettings {
  /** Crumb Points a new account gets for joining. */
  signupBonus: number;
  /** The seven daily login amounts, day 1 first. */
  dailyLogin: number[];
  /** How many seconds a student must keep an event open to earn its points. */
  eventViewSeconds: number;
}

export const DEFAULT_REWARD_SETTINGS: RewardSettings = { signupBonus: 10, dailyLogin: [5, 8, 10, 12, 15, 20, 30], eventViewSeconds: 3 };

let cached: RewardSettings | null = null;

/** Public. If the database update (supabase/031) has not been run, the defaults are used so the screens still make sense. */
export async function getRewardSettings(force = false): Promise<RewardSettings> {
  if (cached && !force) return cached;
  if (!supabase) return DEFAULT_REWARD_SETTINGS;
  try {
    // The seconds column arrives with supabase/036; read without it if that has not been run.
    let res = await supabase.from('reward_settings').select('signup_bonus, daily_login, event_view_seconds').limit(1).maybeSingle();
    if (res.error) res = await supabase.from('reward_settings').select('signup_bonus, daily_login').limit(1).maybeSingle();
    if (res.error || !res.data) return DEFAULT_REWARD_SETTINGS;
    const row = res.data as { signup_bonus: number; daily_login: number[]; event_view_seconds?: number };
    cached = { signupBonus: row.signup_bonus, dailyLogin: row.daily_login.length === 7 ? row.daily_login : DEFAULT_REWARD_SETTINGS.dailyLogin, eventViewSeconds: row.event_view_seconds ?? 3 };
    return cached;
  } catch {
    return DEFAULT_REWARD_SETTINGS;
  }
}

/** Owner only. */
export async function saveRewardSettings(input: RewardSettings): Promise<void> {
  if (!supabase) throw new Error('The database is not connected yet.');
  let { error } = await supabase.from('reward_settings').update({ signup_bonus: input.signupBonus, daily_login: input.dailyLogin, event_view_seconds: input.eventViewSeconds }).eq('id', true);
  // Before supabase/036 there is no seconds column: save the rest.
  if (error && /event_view_seconds/.test(error.message)) ({ error } = await supabase.from('reward_settings').update({ signup_bonus: input.signupBonus, daily_login: input.dailyLogin }).eq('id', true));
  if (error) throw new Error(error.message);
  cached = input;
}

export interface DailyStatus {
  /** The day (1 to 7) the student is on, or just claimed. */
  nextDay: number;
  claimedToday: boolean;
  amounts: number[];
}

export async function getDailyStatus(): Promise<DailyStatus | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('daily_login_status');
  if (error) return null;
  const r = (Array.isArray(data) ? data[0] : data) as { next_day: number; claimed_today: boolean; amounts: number[] } | undefined;
  return r ? { nextDay: r.next_day, claimedToday: r.claimed_today, amounts: r.amounts } : null;
}

/** Claims today's reward. Returns the points paid (0 if it was already claimed). */
export async function claimDaily(): Promise<{ awarded: number; day: number }> {
  if (!supabase) throw new Error('The database is not connected yet.');
  const { data, error } = await supabase.rpc('claim_daily_login');
  if (error) throw new Error('Could not claim the reward. Please try again.');
  const r = (Array.isArray(data) ? data[0] : data) as { awarded: number; day: number };
  if (r.awarded > 0) notifyPointsChanged();
  return { awarded: r.awarded, day: r.day };
}

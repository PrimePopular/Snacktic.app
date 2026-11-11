/** Owner-side tools for game reward rules and the day-reset time zone. Reads are open; writes are owner only. */
import { supabase } from '../../services/database';

export type AwardType = 'fixed' | 'by_score';

export interface GameRule {
  gameId: string;
  /** For example "practice", "daily", "level-4". "default" for a game with one mode. */
  mode: string;
  modeLabel: string;
  isDailyChallenge: boolean;
  title: string;
  active: boolean;
  awardType: AwardType;
  /** fixed: points for the first round of the day */
  dailyFirstAward: number;
  /** fixed: points for each replay */
  replayAward: number;
  /** by_score: points per score point (for example 0.5) */
  pointsPerScore: number;
  /** by_score: the most one round can pay */
  maxRoundAward: number;
  /** by_score: replays pay this percentage of a first round */
  replayPercent: number;
  /** Scores below this pay nothing and do not use up the daily bonus (use it so losing pays nothing). */
  minScore: number;
  dailyCap: number;
  maxScore: number;
  minDurationMs: number;
  maxDurationMs: number;
}

interface Row {
  game_id: string;
  mode: string;
  mode_label: string;
  is_daily_challenge: boolean;
  title: string;
  active: boolean;
  award_type: AwardType;
  daily_first_award: number;
  replay_award: number;
  points_per_score: number | string;
  max_round_award: number;
  replay_percent: number;
  min_score: number;
  daily_cap: number;
  max_score: number;
  min_duration_ms: number;
  max_duration_ms: number;
}

const COLUMNS =
  'game_id, mode, mode_label, is_daily_challenge, title, active, award_type, daily_first_award, replay_award, points_per_score, max_round_award, replay_percent, min_score, daily_cap, max_score, min_duration_ms, max_duration_ms';

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

const fromRow = (r: Row): GameRule => ({
  gameId: r.game_id,
  mode: r.mode,
  modeLabel: r.mode_label,
  isDailyChallenge: r.is_daily_challenge,
  title: r.title,
  active: r.active,
  awardType: r.award_type,
  dailyFirstAward: r.daily_first_award,
  replayAward: r.replay_award,
  pointsPerScore: Number(r.points_per_score),
  maxRoundAward: r.max_round_award,
  replayPercent: r.replay_percent,
  minScore: r.min_score,
  dailyCap: r.daily_cap,
  maxScore: r.max_score,
  minDurationMs: r.min_duration_ms,
  maxDurationMs: r.max_duration_ms,
});

export async function adminListGameRules(): Promise<GameRule[]> {
  const { data, error } = await client().from('game_rules').select(COLUMNS).order('game_id', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(fromRow);
}

/** Creates the rule, or updates it when it already exists (a rule is one game and one mode). */
export async function adminSaveGameRule(rule: GameRule, isNew: boolean): Promise<void> {
  const row = {
    game_id: rule.gameId,
    mode: rule.mode,
    mode_label: rule.modeLabel.trim(),
    is_daily_challenge: rule.isDailyChallenge,
    title: rule.title.trim(),
    active: rule.active,
    award_type: rule.awardType,
    daily_first_award: rule.dailyFirstAward,
    replay_award: rule.replayAward,
    points_per_score: rule.pointsPerScore,
    max_round_award: rule.maxRoundAward,
    replay_percent: rule.replayPercent,
    min_score: rule.minScore,
    daily_cap: rule.dailyCap,
    max_score: rule.maxScore,
    min_duration_ms: rule.minDurationMs,
    max_duration_ms: rule.maxDurationMs,
  };
  const query = isNew
    ? client().from('game_rules').insert(row)
    : client().from('game_rules').update(row).eq('game_id', rule.gameId).eq('mode', rule.mode);
  const { error } = await query;
  if (error) throw new Error(error.message.includes('duplicate') ? 'A rule for that game and mode already exists.' : error.message);
}

export async function getTimezone(): Promise<string> {
  const { data, error } = await client().from('app_settings').select('key, value').eq('key', 'timezone').maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { value: string } | null)?.value ?? 'UTC';
}

export async function setTimezone(value: string): Promise<void> {
  const { error } = await client().from('app_settings').update({ value }).eq('key', 'timezone');
  if (error) throw new Error(error.message);
}

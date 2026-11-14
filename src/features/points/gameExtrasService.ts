/** Owner tools for daily-challenge retry costs and score milestones. Reads are open; writes are owner only. */
import { supabase } from '../../services/database';

export interface Milestone {
  score: number;
  points: number;
}

export interface ExtraRule {
  gameId: string;
  mode: string;
  label: string;
  isDaily: boolean;
  isMilestones: boolean;
  retryCost: number;
  maxRetries: number;
  milestones: Milestone[];
}

interface RuleRow {
  game_id: string;
  mode: string;
  mode_label: string;
  title: string;
  is_daily_challenge: boolean;
  award_type: string;
  retry_cost: number;
  max_retries: number;
}

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

export async function adminListExtras(): Promise<ExtraRule[]> {
  const [rules, milestones] = await Promise.all([
    client().from('game_rules').select('game_id, mode, mode_label, title, is_daily_challenge, award_type, retry_cost, max_retries').order('game_id'),
    client().from('game_milestones').select('game_id, mode, score, points').order('score'),
  ]);
  if (rules.error) throw new Error(rules.error.message);
  if (milestones.error) throw new Error(milestones.error.message);
  const rows = (milestones.data ?? []) as { game_id: string; mode: string; score: number; points: number }[];
  return ((rules.data ?? []) as RuleRow[])
    .filter((r) => r.is_daily_challenge || r.award_type === 'milestones')
    .map((r) => ({
      gameId: r.game_id,
      mode: r.mode,
      label: `${r.title}${r.mode_label ? ` (${r.mode_label})` : ''}`,
      isDaily: r.is_daily_challenge,
      isMilestones: r.award_type === 'milestones',
      retryCost: r.retry_cost,
      maxRetries: r.max_retries ?? 5,
      milestones: rows.filter((m) => m.game_id === r.game_id && m.mode === r.mode).map((m) => ({ score: m.score, points: m.points })),
    }));
}

export async function adminSetRetryCost(gameId: string, mode: string, cost: number, maxRetries: number): Promise<void> {
  const { error } = await client().from('game_rules').update({ retry_cost: cost, max_retries: maxRetries }).eq('game_id', gameId).eq('mode', mode);
  if (error) throw new Error(error.message);
}

export async function adminSetMilestones(gameId: string, mode: string, rows: Milestone[]): Promise<void> {
  const { error } = await client().rpc('owner_set_game_milestones', { p_game_id: gameId, p_mode: mode, p_rows: rows });
  if (error) throw new Error(error.message.includes('Owner only') ? 'Only the owner can change this.' : error.message);
}

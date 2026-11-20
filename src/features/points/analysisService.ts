import { supabase } from '../../services/database';

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);

export interface Overview {
  students: number;
  new7d: number;
  active24h: number;
  active15m: number;
  plays24h: number;
  pointsEarned24h: number;
  pointsSpent24h: number;
  orders7d: number;
  friends7d: number;
}

export interface GameStat {
  gameId: string;
  mode: string;
  plays: number;
  players: number;
  playsToday: number;
  playersNow: number;
  avgScore: number;
  bestScore: number;
  pointsPaid: number;
}

export interface TopPlayer {
  gameId: string;
  username: string;
  plays: number;
  points: number;
}

export interface RewardStat {
  name: string;
  kind: string;
  redemptions: number;
  pointsSpent: number;
  students: number;
}

export interface FriendStat {
  campaign: string;
  invites: number;
  inviters: number;
  pointsPaid: number;
}

async function rows(fn: string, args?: Record<string, unknown>): Promise<Row[]> {
  const { data, error } = await client().rpc(fn, args);
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

export async function getOverview(): Promise<Overview> {
  const r = (await rows('admin_overview'))[0] ?? {};
  return { students: num(r.students), new7d: num(r.new_7d), active24h: num(r.active_24h), active15m: num(r.active_15m), plays24h: num(r.plays_24h), pointsEarned24h: num(r.points_earned_24h), pointsSpent24h: num(r.points_spent_24h), orders7d: num(r.orders_7d), friends7d: num(r.friends_7d) };
}

export async function getGameStats(days: number): Promise<GameStat[]> {
  return (await rows('admin_game_analytics', { p_days: days })).map((r) => ({ gameId: String(r.game_id), mode: String(r.mode), plays: num(r.plays), players: num(r.players), playsToday: num(r.plays_today), playersNow: num(r.players_now), avgScore: num(r.avg_score), bestScore: num(r.best_score), pointsPaid: num(r.points_paid) }));
}

export async function getTopPlayers(days: number): Promise<TopPlayer[]> {
  return (await rows('admin_game_top_players', { p_days: days })).map((r) => ({ gameId: String(r.game_id), username: String(r.username), plays: num(r.plays), points: num(r.points) }));
}

export async function getRewardStats(days: number): Promise<RewardStat[]> {
  return (await rows('admin_reward_analytics', { p_days: days })).map((r) => ({ name: String(r.reward_name), kind: String(r.kind), redemptions: num(r.redemptions), pointsSpent: num(r.points_spent), students: num(r.students) }));
}

export async function getFriendStats(): Promise<FriendStat[]> {
  return (await rows('admin_friend_analytics')).map((r) => ({ campaign: String(r.campaign), invites: num(r.invites), inviters: num(r.inviters), pointsPaid: num(r.points_paid) }));
}

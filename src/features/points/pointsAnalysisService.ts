import { supabase } from '../../services/database';

export interface StudentPoints {
  userId: string;
  username: string;
  balance: number;
  earned: number;
  spent: number;
  earned24h: number;
  entries: number;
  lastActivity: string | null;
}

export interface SourceTotal {
  kind: string;
  earned: number;
  spent: number;
  entries: number;
  students: number;
}

export interface PointsEntry {
  createdAt: string;
  amount: number;
  kind: string;
  note: string;
}

export type PointsSort = 'balance' | 'earned' | 'earned_24h' | 'recent';

/** Friendly names for where points come from or go to. */
export const sourceLabels: Record<string, string> = {
  game_award: 'Game reward',
  game_speed: 'Cookie War speed record',
  ad_view: 'Ad reward',
  campaign_award: 'Find a Friend / campaign',
  gift_sent: 'Gift sent',
  gift_received: 'Gift received',
  redemption: 'Reward redemption',
  admin_adjustment: 'Owner adjustment',
  game_retry: 'Game retry',
  game_purchase: 'Hint purchase',
};

export const sourceLabel = (kind: string): string => sourceLabels[kind] ?? kind;

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

export async function listStudentPoints(search: string, sort: PointsSort, offset: number, limit = 25): Promise<StudentPoints[]> {
  const { data, error } = await client().rpc('admin_points_overview', { p_search: search, p_sort: sort, p_limit: limit, p_offset: offset });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    userId: r.user_id as string,
    username: r.username as string,
    balance: Number(r.balance),
    earned: Number(r.earned),
    spent: Number(r.spent),
    earned24h: Number(r.earned_24h),
    entries: Number(r.entries),
    lastActivity: (r.last_activity as string | null) ?? null,
  }));
}

export async function listPointSources(days: number): Promise<SourceTotal[]> {
  const { data, error } = await client().rpc('admin_points_sources', { p_days: days });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    kind: r.kind as string,
    earned: Number(r.earned),
    spent: Number(r.spent),
    entries: Number(r.entries),
    students: Number(r.students),
  }));
}

export async function listStudentTrail(userId: string): Promise<PointsEntry[]> {
  const { data, error } = await client().rpc('admin_user_points', { p_user: userId, p_limit: 150 });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    createdAt: r.created_at as string,
    amount: Number(r.amount),
    kind: r.kind as string,
    note: (r.note as string) ?? '',
  }));
}

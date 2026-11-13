/** Owner tools for automatic storage cleanup. Settings are plain numbers of days; the database does the deleting. */
import { supabase } from '../../services/database';

export interface CleanupSettings {
  ordersDays: number;
  notificationsDays: number;
  playsDays: number;
}

export interface CleanupResult {
  orders: number;
  notifications: number;
  game_plays: number;
  game_attempts: number;
}

const KEYS = ['cleanup_orders_days', 'cleanup_notifications_days', 'cleanup_plays_days'];

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

export async function getCleanupSettings(): Promise<CleanupSettings> {
  const { data, error } = await client().from('app_settings').select('key, value').in('key', KEYS);
  if (error) throw new Error(error.message);
  const get = (key: string, fallback: number) => {
    const n = Number((data as { key: string; value: string }[]).find((s) => s.key === key)?.value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return { ordersDays: get('cleanup_orders_days', 7), notificationsDays: get('cleanup_notifications_days', 30), playsDays: get('cleanup_plays_days', 30) };
}

export async function saveCleanupSettings(settings: CleanupSettings): Promise<void> {
  const rows = [
    { key: 'cleanup_orders_days', value: String(settings.ordersDays) },
    { key: 'cleanup_notifications_days', value: String(settings.notificationsDays) },
    { key: 'cleanup_plays_days', value: String(settings.playsDays) },
  ];
  const { error } = await client().from('app_settings').upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

export async function runCleanupNow(): Promise<CleanupResult> {
  const { data, error } = await client().rpc('owner_run_cleanup');
  if (error) throw new Error(error.message.includes('Owner only') ? 'Only the owner can do this.' : error.message);
  return data as CleanupResult;
}

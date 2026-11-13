/** Owner switches for the scheduled notifications. Stored in app_settings (readable by everyone, so no secrets here). */
import { supabase } from '../../services/database';

export interface DailyNotificationSettings {
  prayerEnabled: boolean;
  prayerLink: string;
  gamesEnabled: boolean;
}

const KEYS = ['prayer_enabled', 'prayer_link', 'games_enabled'];

export async function getDailyNotificationSettings(): Promise<DailyNotificationSettings> {
  if (!supabase) throw new Error('The database is not connected yet.');
  const { data, error } = await supabase.from('app_settings').select('key, value').in('key', KEYS);
  if (error) throw new Error(error.message);
  const get = (key: string) => (data as { key: string; value: string }[]).find((s) => s.key === key)?.value ?? '';
  return { prayerEnabled: get('prayer_enabled') === 'true', prayerLink: get('prayer_link'), gamesEnabled: get('games_enabled') !== 'false' };
}

export async function saveDailyNotificationSettings(settings: DailyNotificationSettings): Promise<void> {
  if (!supabase) throw new Error('The database is not connected yet.');
  const rows = [
    { key: 'prayer_enabled', value: settings.prayerEnabled ? 'true' : 'false' },
    { key: 'prayer_link', value: settings.prayerLink.trim() },
    { key: 'games_enabled', value: settings.gamesEnabled ? 'true' : 'false' },
  ];
  const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

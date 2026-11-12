/** The campus name and position used for the weather. Owner only to change (the database refuses anyone else). */
import { supabase } from '../../services/database';

export interface CampusLocation {
  name: string;
  latitude: string;
  longitude: string;
}

export async function getCampusLocation(): Promise<CampusLocation> {
  if (!supabase) return { name: '', latitude: '', longitude: '' };
  const { data, error } = await supabase.from('app_settings').select('key, value').in('key', ['campus_name', 'campus_latitude', 'campus_longitude']);
  if (error) throw new Error(error.message);
  const get = (key: string) => (data as { key: string; value: string }[]).find((s) => s.key === key)?.value ?? '';
  return { name: get('campus_name'), latitude: get('campus_latitude'), longitude: get('campus_longitude') };
}

export async function saveCampusLocation(location: CampusLocation): Promise<void> {
  if (!supabase) throw new Error('The database is not connected yet.');
  const rows = [
    { key: 'campus_name', value: location.name.trim() },
    { key: 'campus_latitude', value: location.latitude.trim() },
    { key: 'campus_longitude', value: location.longitude.trim() },
  ];
  const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(error.message);
  try {
    sessionStorage.removeItem('snacktic.weather');
  } catch {
    /* fine */
  }
}

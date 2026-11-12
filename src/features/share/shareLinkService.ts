/**
 * The address people are sent to when they scan the Share code. The owner sets it in the admin
 * (app_settings, key "share_link"). Settings are readable by everyone, so guests can see it too.
 */
import { supabase } from '../../services/database';

const KEY = 'share_link';

/** The owner's chosen link, or '' if none has been set. Never throws: sharing must always work. */
export async function getShareLink(): Promise<string> {
  if (!supabase) return '';
  try {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', KEY).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? String((data as { value: string }).value) : '';
  } catch (error) {
    console.error('[share] link', error);
    return '';
  }
}

/** Owner only (the database refuses anyone else). An empty value goes back to the app's own address. */
export async function saveShareLink(link: string): Promise<void> {
  if (!supabase) throw new Error('The database is not connected yet.');
  const { error } = await supabase.from('app_settings').upsert({ key: KEY, value: link.trim() }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

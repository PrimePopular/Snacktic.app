/** In-app messages for the signed-in student. Created only by trusted database functions. */
import { supabase } from '../../services/database';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

interface Row {
  id: string;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

export async function listNotifications(limit = 20): Promise<AppNotification[]> {
  const { data, error } = await client()
    .from('notifications')
    .select('id, title, body, link, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((r) => ({ id: r.id, title: r.title, body: r.body, link: r.link, read: r.is_read, createdAt: r.created_at }));
}

export async function markAllRead(): Promise<void> {
  const { error } = await client().rpc('mark_notifications_read');
  if (error) throw new Error(error.message);
}

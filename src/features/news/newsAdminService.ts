import { supabase } from '../../services/database';
import type { NewsItem } from './news.types';

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

export interface AdminNews extends NewsItem {
  hidden: boolean;
  score: number;
}

/** Every saved story, including hidden ones, newest first. Admin only. */
export async function adminListNews(): Promise<AdminNews[]> {
  const { data, error } = await client()
    .from('news_items')
    .select('id, source, source_name, title, summary, image_url, url, published_at, hidden, score')
    .order('published_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    source: r.source as NewsItem['source'],
    sourceName: r.source_name as string,
    title: r.title as string,
    summary: r.summary as string,
    imageUrl: (r.image_url as string | null) ?? null,
    url: r.url as string,
    publishedAt: r.published_at as string,
    hidden: r.hidden as boolean,
    score: Number(r.score),
  }));
}

export async function setNewsHidden(id: string, hidden: boolean): Promise<void> {
  const { error } = await client().from('news_items').update({ hidden }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteNews(id: string): Promise<void> {
  const { error } = await client().from('news_items').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

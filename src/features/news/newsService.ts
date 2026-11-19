import { supabase } from '../../services/database';
import { cached } from '../../services/offlineCache';
import type { NewsItem } from './news.types';

interface Row {
  id: string;
  source: NewsItem['source'];
  source_name: string;
  title: string;
  summary: string;
  image_url: string | null;
  url: string;
  published_at: string;
}

/**
 * The automatic news feed, best stories first. If the news table does not exist yet (supabase/025 not run) or nothing has been
 * fetched, this is an empty list and the News tab stays hidden: students never see a broken or empty panel.
 */
export async function listNews(limit = 30): Promise<NewsItem[]> {
  if (!supabase) return [];
  const db = supabase;
  try {
    const rows = await cached('news-feed', async () => {
      const { data, error } = await db
        .from('news_items')
        .select('id, source, source_name, title, summary, image_url, url, published_at')
        .eq('hidden', false)
        .order('score', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    });
    return rows.map((r) => ({ id: r.id, source: r.source, sourceName: r.source_name, title: r.title, summary: r.summary, imageUrl: r.image_url, url: r.url, publishedAt: r.published_at }));
  } catch {
    return [];
  }
}

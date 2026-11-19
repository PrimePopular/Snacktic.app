export interface NewsItem {
  id: string;
  source: 'youtube' | 'reddit' | 'x' | 'rss';
  sourceName: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  url: string;
  publishedAt: string;
}

export const sourceLabels: Record<NewsItem['source'], string> = { youtube: 'YouTube', reddit: 'Reddit', x: 'X', rss: 'News site' };

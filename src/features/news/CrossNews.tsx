import { useEffect, useState } from 'react';
import { NewsCard } from './NewsCard';
import { listNews } from './newsService';
import type { NewsItem } from './news.types';

/** One or two of the most popular stories, shown on Home. Nothing shows if there is no news yet. */
export function CrossNews({ count = 2 }: { count?: number }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  useEffect(() => {
    let active = true;
    void listNews(10).then((all) => active && setItems(all.slice(0, count)));
    return () => {
      active = false;
    };
  }, [count]);
  if (items.length === 0) return null;
  return (
    <section className="cross-bonus" aria-label="Trending news">
      <h2 className="home-section-title">Trending news</h2>
      <ul className="news-list">
        {items.map((item) => (
          <li key={item.id}>
            <NewsCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

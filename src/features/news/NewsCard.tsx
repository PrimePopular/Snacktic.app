import { safeLink } from '../../shared/url';
import type { NewsItem } from './news.types';
import { sourceLabels } from './news.types';

const when = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** One story from the automatic news feed: picture, headline, where it came from, a short summary and a link out. */
export function NewsCard({ item }: { item: NewsItem }) {
  const link = safeLink(item.url);
  return (
    <article className="news-card news-card--feed">
      {item.imageUrl && (
        <div className="news-card__media">
          <img src={item.imageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        </div>
      )}
      <div className="news-card__body">
        <div className="news-card__meta">
          <span className="news-card__sticker">{sourceLabels[item.source]}</span>
          <span className="news-card__date">{when.format(new Date(item.publishedAt))}</span>
        </div>
        <h3>{item.title}</h3>
        {item.summary && <p className="text-secondary">{item.summary}</p>}
        <p className="text-small">Source: {item.sourceName || sourceLabels[item.source]}</p>
        {link && (
          <a className="link-button" href={link} target="_blank" rel="noopener noreferrer">
            Read or watch at the source
          </a>
        )}
      </div>
    </article>
  );
}

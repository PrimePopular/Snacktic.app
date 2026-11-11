import { CardArt } from './CardArt';
import './feed.css';

interface FeedCardProps {
  title: string;
  categoryId: number | null;
  imageUrl: string | null;
  categoryName?: string;
  /** Short bold label on the picture, for example "Tomorrow 9:00 PM". Optional. */
  pill?: string;
  /** One line under the title, for example the place. */
  meta?: string;
  saved: boolean;
  status: string;
  onToggleSaved: () => void;
  onShare: () => void;
  onOpen: () => void;
}

export function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" />
    </svg>
  );
}

export function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="m8.3 10.7 7.4-4.4M8.3 13.3l7.4 4.4" />
    </svg>
  );
}

/**
 * The shared card for events and places: picture across the top (or the default art), a big title,
 * and a slim row with a like and a share button. Tapping the picture or title opens the details.
 */
export function FeedCard({ title, categoryId, imageUrl, categoryName, pill, meta, saved, status, onToggleSaved, onShare, onOpen }: FeedCardProps) {
  const tint = (categoryId ?? 0) % 3;

  return (
    <article className="feed-card">
      <button type="button" className="feed-card__open" onClick={onOpen} aria-haspopup="dialog">
        <span className={`feed-card__media ${imageUrl ? '' : `feed-card__media--tint${tint}`}`}>
          {imageUrl ? <img src={imageUrl} alt="" loading="lazy" decoding="async" /> : <CardArt />}
          {categoryName && <span className="feed-card__sticker">{categoryName}</span>}
          {pill && <span className="feed-card__pill">{pill}</span>}
        </span>
        <span className="feed-card__title">{title}</span>
        {meta && <span className="feed-card__meta">{meta}</span>}
      </button>
      <div className="feed-card__row">
        <span className="feed-card__source">
          <span className="feed-card__avatar" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-orange)"><circle cx="12" cy="12" r="9" /></svg>
          </span>
          <span>Snacktic{categoryName ? ` · ${categoryName}` : ''}</span>
        </span>
        <span className="feed-card__status" role="status">{status}</span>
        <span className="feed-card__actions">
          <button type="button" className="icon-button" aria-pressed={saved} aria-label={saved ? `Unlike ${title}` : `Like ${title}`} onClick={onToggleSaved}>
            <HeartIcon filled={saved} />
          </button>
          <button type="button" className="icon-button" aria-label={`Share ${title}`} onClick={onShare}>
            <ShareIcon />
          </button>
        </span>
      </div>
    </article>
  );
}

import { useId } from 'react';
import type { ReactNode } from 'react';
import { Button, Modal } from '../../shared/components';
import { CardArt } from './CardArt';
import { HeartIcon, ShareIcon } from './FeedCard';
import './feed.css';

export interface Highlight {
  icon: 'calendar' | 'pin';
  text: string;
}

export interface DetailLink {
  href: string;
  label: string;
  primary?: boolean;
  onClick?: () => void;
}

interface DetailSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  categoryId: number | null;
  imageUrl: string | null;
  categoryName?: string;
  highlights: Highlight[];
  description?: string;
  saved: boolean;
  status: string;
  onToggleSaved: () => void;
  onShare: () => void;
  /** A link that opens the place in Google Maps. No map is loaded inside the app. */
  map?: { openUrl: string };
  /** Extra sections shown after the description (for example a shop's products). */
  children?: ReactNode;
  contact?: { heading: string; name?: string; links: DetailLink[] };
}

function HighlightIcon({ kind }: { kind: Highlight['icon'] }) {
  return kind === 'calendar' ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/**
 * The details page for an event or place, shown as a nearly full-height sheet: picture, title,
 * highlights, like and share, the description, an optional map and who to contact.
 */
export function DetailSheet({ open, onClose, title, categoryId, imageUrl, categoryName, highlights, description, saved, status, onToggleSaved, onShare, map, contact, children }: DetailSheetProps) {
  const titleId = useId();
  const tint = (categoryId ?? 0) % 3;

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} className="modal--sheet">
      <div className="detail">
        <div className={`detail__media ${imageUrl ? '' : `feed-card__media--tint${tint}`}`}>
          {imageUrl ? <img src={imageUrl} alt="" decoding="async" /> : <CardArt />}
          <button type="button" className="detail__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="detail__body">
          {categoryName && <span className="badge">{categoryName}</span>}
          <h2 id={titleId}>{title}</h2>

          {highlights.length > 0 && (
            <ul className="detail__highlights">
              {highlights.map((h, i) => (
                <li key={i}>
                  <span className="detail__highlight-icon">
                    <HighlightIcon kind={h.icon} />
                  </span>
                  <span>{h.text}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="detail__actions">
            <button type="button" className={`detail__like ${saved ? 'detail__like--on' : ''}`} aria-pressed={saved} onClick={onToggleSaved}>
              <HeartIcon filled={saved} />
              {saved ? 'Liked' : 'Like'}
            </button>
            <button type="button" className="detail__share" onClick={onShare}>
              <ShareIcon />
              Share
            </button>
          </div>
          {status && <p className="text-xs text-secondary" role="status">{status}</p>}

          {description && (
            <section className="detail__section">
              <h3>About</h3>
              <p className="detail__text">{description}</p>
            </section>
          )}

          {children}

          {map && (
            <section className="detail__section">
              <a className="btn btn--secondary" href={map.openUrl} target="_blank" rel="noopener noreferrer">
                Open in Google Maps
              </a>
            </section>
          )}

          {contact && contact.links.length > 0 && (
            <section className="detail__contact">
              <h3>{contact.heading}</h3>
              {contact.name && <p className="text-secondary">Contact {contact.name}</p>}
              <div className="detail__buttons">
                {contact.links.map((l, i) => (
                  <a key={i} className={`btn ${l.primary ? 'btn--primary' : 'btn--secondary'}`} href={l.href} onClick={l.onClick} {...(l.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                    {l.label}
                  </a>
                ))}
              </div>
            </section>
          )}

          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

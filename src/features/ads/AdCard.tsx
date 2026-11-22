import { isVideoFile, youtubeThumb } from '../../shared/video';
import { useEffect, useId, useRef, useState } from 'react';
import { Modal } from '../../shared/components';
import { pictureUrl } from '../../services/pictures';
import { linkLabel, safeLink } from '../../shared/url';
import { useAuth } from '../authentication';
import { beginAdOpen, claimAdPoints, trackAdEvent } from './adsService';
import { markAdShown } from './weave';
import type { Ad } from './ads.types';
import './ads.css';

const CLAIMED_KEY = 'snacktic.adsClaimed';

function alreadyClaimed(id: string): boolean {
  try {
    return (localStorage.getItem(CLAIMED_KEY) ?? '').split(',').includes(id);
  } catch {
    return false;
  }
}

function rememberClaimed(id: string) {
  try {
    const ids = (localStorage.getItem(CLAIMED_KEY) ?? '').split(',').filter(Boolean);
    if (!ids.includes(id)) localStorage.setItem(CLAIMED_KEY, [...ids, id].slice(-200).join(','));
  } catch {
    /* storage unavailable: the database still pays only once */
  }
}

interface AdFullProps {
  ad: Ad;
  titleId?: string;
  /** Count a tap on the link as a click (used where the ad is shown without the card). */
  trackLink?: boolean;
}

/** The whole ad: picture, advertiser, full message and link. Used in the expanded view and while waiting to retry a game. */
export function AdFull({ ad, titleId, trackLink = false }: AdFullProps) {
  const link = safeLink(ad.link);
  const video = ad.videoUrl ? safeLink(ad.videoUrl) : null;
  const thumb = video ? youtubeThumb(video) : null;
  return (
    <div className="ad-full">
      {video && isVideoFile(video) && (
        <div className="ad-full__media">
          <video src={video} controls preload="metadata" playsInline />
        </div>
      )}
      {video && !isVideoFile(video) && (
        <a className="ad-full__media ad-full__video" href={video} target="_blank" rel="noopener noreferrer sponsored" aria-label={`Watch the video: ${ad.title}`}>
          {thumb ? <img src={thumb} alt="" referrerPolicy="no-referrer" /> : <span className="ad-full__video-text">Watch the video</span>}
          <span className="ad-full__play" aria-hidden="true" />
        </a>
      )}
      {!video && ad.imagePath && (
        <div className="ad-full__media">
          <img src={pictureUrl(ad.imagePath)} alt="" decoding="async" />
        </div>
      )}
      <div className="ad-full__body">
        <span className="ad-card__tag ad-card__tag--inline">Ad</span>
        {ad.advertiser && <p className="ad-card__by">{ad.advertiser}</p>}
        <h2 id={titleId}>{ad.title}</h2>
        {ad.body && <p className="ad-full__text">{ad.body}</p>}
        {link && (
          <a
            className="btn btn--primary"
            href={link}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() => trackLink && trackAdEvent(ad.id, 'click')}
          >
            {linkLabel(link) === 'Open link' ? 'Learn more' : linkLabel(link)}
          </a>
        )}
      </div>
    </div>
  );
}

interface AdDetailProps {
  ad: Ad;
  open: boolean;
  onClose: () => void;
  noReward: boolean;
}

/**
 * The expanded view of an ad, like opening an event. Opening it is a "click". A signed-in student who stays about three
 * seconds earns the reward once for this ad (the server checks the time and that it is the first time). The amount is not
 * shown beforehand. Closing earlier earns nothing.
 */
function AdDetail({ ad, open, onClose, noReward }: AdDetailProps) {
  const { status } = useAuth();
  const titleId = useId();
  const [earned, setEarned] = useState(0);

  useEffect(() => {
    if (!open) return;
    setEarned(0);
    trackAdEvent(ad.id, 'click');
    if (noReward || status !== 'signed-in' || alreadyClaimed(ad.id)) return;
    let cancelled = false;
    let timer: number | undefined;
    void beginAdOpen(ad.id).then(() => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        void claimAdPoints(ad.id).then((points) => {
          rememberClaimed(ad.id);
          if (!cancelled && points > 0) setEarned(points);
        });
      }, 3200);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, ad.id, noReward, status]);

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId}>
      <div className="ad-detail">
        <button type="button" className="detail__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <AdFull ad={ad} titleId={titleId} />
        {earned > 0 && (
          <p className="form-notice ad-detail__earned" role="status">
            You earned {earned} Crumb {earned === 1 ? 'Point' : 'Points'}!
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * A sponsored card, always tagged "Ad". It has a fixed size like an event card, so a long message never stretches the feed.
 * Tapping it opens the full ad. Guests see ads too.
 */
export function AdCard({ ad, noReward = false }: { ad: Ad; noReward?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  // Count a view when the ad has really been on screen (more than half, for a second), and note it for rotation.
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(timer);
        if (!entry?.isIntersecting) return;
        timer = window.setTimeout(() => {
          trackAdEvent(ad.id, 'view');
          markAdShown(ad.id);
          observer.disconnect();
        }, 1000);
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [ad.id]);

  return (
    <>
      <article className="ad-card" ref={ref}>
        <button type="button" className="ad-card__open" onClick={() => setOpen(true)} aria-label={`Ad: ${ad.title}. Open`}>
          <span className="ad-card__tag">Ad</span>
          <div className={`ad-card__media ${ad.imagePath ? '' : 'ad-card__media--plain'}`}>
            {ad.imagePath ? <img src={pictureUrl(ad.imagePath)} alt="" loading="lazy" decoding="async" /> : <span className="ad-card__initial">{(ad.advertiser || ad.title).slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="ad-card__body">
            {ad.advertiser && <p className="ad-card__by">{ad.advertiser}</p>}
            <h2 className="ad-card__title">{ad.title}</h2>
            {ad.body && <p className="ad-card__desc">{ad.body}</p>}
          </div>
        </button>
      </article>
      <AdDetail ad={ad} open={open} onClose={() => setOpen(false)} noReward={noReward} />
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../authentication';
import { pictureUrl } from '../../services/pictures';
import { linkLabel, safeLink } from '../../shared/url';
import { claimAdPoints } from './adsService';
import type { Ad } from './ads.types';
import './ads.css';

const SEEN_KEY = 'snacktic.adsClaimed';

function alreadyClaimed(id: string): boolean {
  try {
    return (localStorage.getItem(SEEN_KEY) ?? '').split(',').includes(id);
  } catch {
    return false;
  }
}

function rememberClaimed(id: string) {
  try {
    const ids = (localStorage.getItem(SEEN_KEY) ?? '').split(',').filter(Boolean);
    if (!ids.includes(id)) localStorage.setItem(SEEN_KEY, [...ids, id].slice(-200).join(','));
  } catch {
    /* storage unavailable: the database still pays only once */
  }
}

/**
 * A sponsored card, always tagged "Ad". When a signed-in student has really looked at it (more than
 * half on screen for a second) the database pays the points, once per ad. Guests simply see the ad.
 */
export function AdCard({ ad }: { ad: Ad }) {
  const { status } = useAuth();
  const ref = useRef<HTMLElement>(null);
  const [earned, setEarned] = useState(0);
  const link = safeLink(ad.link);
  const signedIn = status === 'signed-in';

  useEffect(() => {
    const node = ref.current;
    if (!node || !signedIn || ad.points <= 0 || alreadyClaimed(ad.id) || typeof IntersectionObserver === 'undefined') return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(timer);
        if (!entry?.isIntersecting) return;
        timer = window.setTimeout(() => {
          observer.disconnect();
          void claimAdPoints(ad.id).then((points) => {
            rememberClaimed(ad.id);
            if (points > 0) setEarned(points);
          });
        }, 1000);
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [ad.id, ad.points, signedIn]);

  return (
    <article className="ad-card" ref={ref}>
      <span className="ad-card__tag">Ad</span>
      {ad.imagePath && (
        <div className="ad-card__media">
          <img src={pictureUrl(ad.imagePath)} alt="" loading="lazy" decoding="async" />
        </div>
      )}
      <div className="ad-card__body">
        {ad.advertiser && <p className="ad-card__by">{ad.advertiser}</p>}
        <h2>{ad.title}</h2>
        {ad.body && <p className="text-secondary">{ad.body}</p>}
        {link && (
          <a className="btn btn--secondary" href={link} target="_blank" rel="noopener noreferrer sponsored">
            {linkLabel(link) === 'Open link' ? 'Learn more' : linkLabel(link)}
          </a>
        )}
        {earned > 0 && (
          <p className="ad-card__earned" role="status">
            +{earned} Crumb {earned === 1 ? 'Point' : 'Points'}
          </p>
        )}
        {earned === 0 && !signedIn && ad.points > 0 && <p className="text-xs text-secondary">Sign in to earn Crumb Points from ads.</p>}
      </div>
    </article>
  );
}

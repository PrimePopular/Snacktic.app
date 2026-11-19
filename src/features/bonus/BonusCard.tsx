import { useEffect } from 'react';
import { Link } from '../../core/router';
import { CardArt } from '../feed';
import type { Reward } from '../points';
import { pictureUrl } from '../../services/pictures';
import { endsText } from './bonus';
import { trackBonus } from './bonusService';
import type { BonusStatus } from './bonus.types';
import './bonus.css';

/**
 * A Bonus Reward as a card in the feed. It looks different from ordinary cards and ads on purpose, so it reads as a special
 * offer. Tapping it opens the reward's page, where signing in and getting it happen.
 */
export function BonusCard({ reward, status }: { reward: Reward; status: BonusStatus }) {
  useEffect(() => trackBonus(reward.id, 'view'), [reward.id]);
  const left = reward.stock !== null && reward.stock > 0 && reward.stock <= 10 ? reward.stock : null;
  const ends = endsText(reward);
  const claimed = status.claimed.includes(reward.id);
  return (
    <Link to={`/rewards/${reward.id}`} className="bonus-card" onClick={() => trackBonus(reward.id, 'click')} aria-label={`New member offer: ${reward.name}`}>
      <div className="bonus-card__media">
        {reward.imagePath ? <img src={pictureUrl(reward.imagePath)} alt="" loading="lazy" decoding="async" /> : <CardArt />}
        <span className="bonus-card__ribbon">NEW MEMBER OFFER</span>
      </div>
      <div className="bonus-card__body">
        <h3>{reward.name}</h3>
        {reward.description && <p className="bonus-card__desc">{reward.description}</p>}
        <p className="bonus-card__price">
          <strong>{(reward.bonusCost ?? reward.costPoints).toLocaleString()} pts</strong>
          <s>{reward.costPoints.toLocaleString()} pts</s>
        </p>
        <p className="bonus-card__meta">
          {left !== null && <span>Only {left} left</span>}
          {ends && <span>{ends}</span>}
          {!status.eligible && <span>For members in their first {status.eligibilityDays} days</span>}
        </p>
        <span className="bonus-card__cta">{claimed ? 'Already claimed' : status.eligible ? 'Get this offer' : 'See the offer'}</span>
      </div>
    </Link>
  );
}

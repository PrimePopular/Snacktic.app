import { endsText, isDiscountLive, isOfferLive, priceOf } from '../../features/bonus';
import { CardArt } from '../../features/feed';
import { productTypeLabels } from '../../features/points';
import type { Reward } from '../../features/points';
import { pictureUrl } from '../../services/pictures';
import { Button } from '../../shared/components';

export interface RewardCardProps {
  reward: Reward;
  /** null for a visitor who is not signed in. */
  balance: number | null;
  ownedUrl?: string;
  suspended?: boolean;
  /** Is this person a new member who may claim Bonus Rewards? */
  eligible: boolean;
  claimed: boolean;
  /** Tapping the button. For a visitor this opens the "sign in first" sheet. */
  onGet: (reward: Reward) => void;
  /** For a visitor, tapping the card itself opens the details. */
  onOpen?: (reward: Reward) => void;
}

/** One item in the market. Compact, so many fit on a screen. Bonus Rewards show the special price beside the crossed-out normal one. */
export function RewardCard({ reward, balance, ownedUrl, suspended, eligible, claimed, onGet, onOpen }: RewardCardProps) {
  const bonus = reward.isBonus && isOfferLive(reward);
  const price = priceOf(reward);
  const discount = isDiscountLive(reward) ? reward.discountPercent : null;
  const missing = balance === null ? 0 : price - balance;
  const soldOut = reward.stock === 0;
  const ends = bonus ? endsText(reward) : null;

  let label: string;
  let disabled = false;
  if (balance === null) label = bonus ? 'Sign in to get this offer' : 'Sign in to get this';
  else if (soldOut) {
    label = 'Sold out';
    disabled = true;
  } else if (bonus && claimed) {
    label = 'Already claimed';
    disabled = true;
  } else if (bonus && !eligible) {
    label = 'For new members';
    disabled = true;
  } else if (missing > 0) {
    label = `Need ${missing.toLocaleString()} more`;
    disabled = true;
  } else label = reward.kind === 'digital' ? 'Get it now' : 'Get this';

  return (
    <article className={`reward-card${bonus ? ' reward-card--bonus' : ''}`}>
      <div className="reward-card__media feed-card__media--tint0" onClick={onOpen ? () => onOpen(reward) : undefined}>
        {reward.imagePath ? <img src={pictureUrl(reward.imagePath)} alt="" loading="lazy" decoding="async" /> : <CardArt />}
        <span className="reward-card__cost">
          {price.toLocaleString()} pts
          {(bonus || discount !== null) && <span className="reward-card__was">{reward.costPoints.toLocaleString()}</span>}
        </span>
        {bonus ? <span className="reward-card__tag reward-card__tag--bonus">Bonus</span> : discount !== null ? <span className="reward-card__tag reward-card__tag--bonus">{discount}% off</span> : reward.kind === 'digital' && <span className="reward-card__tag">{productTypeLabels[reward.productType]}</span>}
      </div>
      <div className="reward-card__body">
        <h3>{reward.name}</h3>
        {reward.description && <p className="text-secondary text-small reward-card__desc">{reward.description}</p>}
        {bonus && <p className="text-small"><strong>New member offer{ends ? ` · ${ends}` : ''}</strong></p>}
        {reward.stock !== null && reward.stock > 0 && reward.stock <= 5 && (
          <p className="text-small">
            <strong>Only {reward.stock} left</strong>
          </p>
        )}
        {ownedUrl ? (
          <Button onClick={() => window.open(ownedUrl, '_blank', 'noopener')}>Open</Button>
        ) : (
          <Button disabled={disabled || Boolean(suspended)} onClick={() => onGet(reward)}>
            {label}
          </Button>
        )}
      </div>
    </article>
  );
}

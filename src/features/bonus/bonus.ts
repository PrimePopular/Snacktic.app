import type { Reward } from '../points';

/** An offer that can still be shown: switched on and not past its end time. */
export function isOfferLive(reward: Reward, now = Date.now()): boolean {
  if (!reward.isBonus || reward.bonusCost === null) return false;
  if (reward.bonusEndsAt && new Date(reward.bonusEndsAt).getTime() < now) return false;
  return reward.stock === null || reward.stock > 0;
}

/** Is an ordinary percentage discount running right now (inside its dates)? */
export function isDiscountLive(reward: Reward, now = Date.now()): boolean {
  if (reward.isBonus || reward.discountPercent === null) return false;
  if (reward.discountStartsAt && new Date(reward.discountStartsAt).getTime() > now) return false;
  if (reward.discountEndsAt && new Date(reward.discountEndsAt).getTime() <= now) return false;
  return true;
}

/** What this person would pay: the special price for a bonus offer, the discounted price during a discount, otherwise the normal price. */
export function priceOf(reward: Reward): number {
  if (reward.isBonus && reward.bonusCost !== null) return reward.bonusCost;
  if (isDiscountLive(reward) && reward.discountPercent !== null) return Math.max(1, Math.ceil((reward.costPoints * (100 - reward.discountPercent)) / 100));
  return reward.costPoints;
}

/** "Ends in 2 days" / "Ends today", or null when there is no end time. */
export function endsText(reward: Reward, now = Date.now()): string | null {
  if (!reward.bonusEndsAt) return null;
  const ms = new Date(reward.bonusEndsAt).getTime() - now;
  if (ms <= 0) return 'Ended';
  const hours = Math.ceil(ms / 3_600_000);
  if (hours < 24) return hours <= 1 ? 'Ends within the hour' : `Ends in ${hours} hours`;
  const days = Math.ceil(hours / 24);
  return `Ends in ${days} day${days === 1 ? '' : 's'}`;
}

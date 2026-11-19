import type { Reward } from '../points';

/** An offer that can still be shown: switched on and not past its end time. */
export function isOfferLive(reward: Reward, now = Date.now()): boolean {
  if (!reward.isBonus || reward.bonusCost === null) return false;
  if (reward.bonusEndsAt && new Date(reward.bonusEndsAt).getTime() < now) return false;
  return reward.stock === null || reward.stock > 0;
}

/** What this person would pay: the special price for a live bonus offer, otherwise the normal price. */
export function priceOf(reward: Reward): number {
  return reward.isBonus && reward.bonusCost !== null ? reward.bonusCost : reward.costPoints;
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

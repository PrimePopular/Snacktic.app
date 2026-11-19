export type TransactionKind =
  | 'game_award'
  | 'ad_view'
  | 'game_retry'
  | 'game_purchase'
  | 'campaign_award'
  | 'gift_sent'
  | 'gift_received'
  | 'redemption'
  | 'admin_adjustment';

export interface PointsTransaction {
  id: string;
  amount: number;
  kind: TransactionKind;
  note: string;
  createdAt: string;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  costPoints: number;
  active: boolean;
  imagePath: string | null;
  /** How many are left. null means unlimited, 0 means sold out. */
  stock: number | null;
  /** physical: delivered in school by the team. digital: an ebook or other digital item, delivered at once as a link. */
  kind: 'physical' | 'digital';
  /** A Bonus Reward: a special offer for new members. costPoints is then the normal price and bonusCost the special one. */
  isBonus: boolean;
  bonusCost: number | null;
  bonusEndsAt: string | null;
  bonusLimitPerUser: number;
}

export interface DigitalPurchase {
  rewardId: string | null;
  title: string;
  url: string;
  createdAt: string;
}

export type RedemptionStatus = 'pending' | 'fulfilled' | 'cancelled';

export interface Redemption {
  id: string;
  rewardName: string;
  pointsCost: number;
  status: RedemptionStatus;
  createdAt: string;
}

/** The owner's view of a redemption, including who made it. */
export interface AdminRedemption extends Redemption {
  username: string;
  phone: string;
  email: string;
  /** Where to deliver it, as chosen when ordering. */
  deliveryPlace: string;
}

export const kindLabels: Record<TransactionKind, string> = {
  game_award: 'Game reward',
  ad_view: 'Ad reward',
  game_retry: 'Game retry',
  game_purchase: 'Hint purchase',
  campaign_award: 'Campaign reward',
  gift_sent: 'Gift sent',
  gift_received: 'Gift received',
  redemption: 'Redeemed',
  admin_adjustment: 'Adjustment',
};

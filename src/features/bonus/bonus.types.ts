/** The rules the owner sets for Bonus Rewards, plus what is true for this visitor. */
export interface BonusStatus {
  /** Master switch. When off, Bonus Rewards are not promoted. */
  enabled: boolean;
  /** True for a signed-in student whose account is newer than the eligibility days. Always false for visitors. */
  eligible: boolean;
  eligibilityDays: number;
  /** A bonus card comes up about once in this many cards for new members. */
  newUserEvery: number;
  /** ...and once in this many for everyone else. */
  othersEvery: number;
  /** Sections where Bonus Rewards may appear: home, discover, games, rewards. */
  sections: string[];
  /** Offers this person has already claimed. */
  claimed: string[];
}

export interface BonusStat {
  rewardId: string;
  name: string;
  views: number;
  clicks: number;
  claims: number;
}

export const BONUS_SECTIONS = ['home', 'discover', 'games', 'rewards'] as const;

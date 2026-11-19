import { useEffect, useState } from 'react';
import { listRewards } from '../points';
import type { Reward } from '../points';
import { BonusCard } from './BonusCard';
import { isOfferLive } from './bonus';
import { getBonusStatus } from './bonusService';
import type { BonusStatus } from './bonus.types';

let offersCache: { at: number; list: Reward[] } | null = null;

async function liveOffers(): Promise<Reward[]> {
  if (!offersCache || Date.now() - offersCache.at > 60_000) offersCache = { at: Date.now(), list: await listRewards() };
  return offersCache.list.filter((r) => isOfferLive(r));
}

/**
 * Once in a while, lets one Bonus Reward appear in another section (Home, Discover, Games) so new members find the offers
 * wherever they are. New members see it more often than everyone else. The owner sets where and how often in the admin.
 */
export function CrossBonus({ section }: { section: 'home' | 'discover' | 'games' | 'rewards' }) {
  const [pick, setPick] = useState<{ reward: Reward; status: BonusStatus } | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const status = await getBonusStatus();
      if (!status.enabled || !status.sections.includes(section)) return;
      const every = status.eligible ? status.newUserEvery : status.othersEvery;
      if (Math.random() > Math.min(0.95, 2 / Math.max(1, every))) return;
      const offers = (await liveOffers()).filter((r) => !status.claimed.includes(r.id));
      if (!active || offers.length === 0) return;
      setPick({ reward: offers[Math.floor(Math.random() * offers.length)], status });
    })().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [section]);

  if (!pick) return null;
  return (
    <section className="cross-bonus" aria-label="A special offer">
      <BonusCard reward={pick.reward} status={pick.status} />
    </section>
  );
}

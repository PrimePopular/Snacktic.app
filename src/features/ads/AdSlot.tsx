import { useState } from 'react';
import { AdCard } from './AdCard';
import { useLiveAds } from './useLiveAds';

/** One ad in a spot where there is no list to mix it into (the end of a screen, a result pop-up). Shows nothing if there are no ads. */
export function AdSlot({ noReward = false }: { noReward?: boolean }) {
  const ads = useLiveAds();
  const [pick] = useState(() => Math.random());
  if (ads.length === 0) return null;
  return <AdCard ad={ads[Math.floor(pick * ads.length)]} noReward={noReward} />;
}

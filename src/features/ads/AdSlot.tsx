import { AdCard } from './AdCard';
import { useRotatedAds } from './useLiveAds';

/** One ad in a spot where there is no list to mix it into (the end of a screen, a result pop-up). Shows nothing if there are no ads. */
export function AdSlot({ noReward = false }: { noReward?: boolean }) {
  const ads = useRotatedAds('slot');
  if (ads.length === 0) return null;
  return <AdCard ad={ads[0]} noReward={noReward} />;
}

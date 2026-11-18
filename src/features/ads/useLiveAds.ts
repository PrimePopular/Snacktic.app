import { useEffect, useMemo, useState } from 'react';
import { listLiveAds } from './adsService';
import { orderAds } from './weave';
import type { Ad } from './ads.types';

let cache: { at: number; ads: Ad[] } | null = null;

/** The ads that can be shown right now. Shared by every screen, refreshed every 5 minutes. A failure just means no ads. */
export function useLiveAds(): Ad[] {
  const [ads, setAds] = useState<Ad[]>(cache?.ads ?? []);

  useEffect(() => {
    let active = true;
    if (cache && Date.now() - cache.at < 5 * 60_000) return;
    void listLiveAds()
      .catch((error: unknown) => {
        console.error('[ads]', error);
        return [] as Ad[];
      })
      .then((list) => {
        cache = { at: Date.now(), ads: list };
        if (active) setAds(list);
      });
    return () => {
      active = false;
    };
  }, []);

  return ads;
}

/** The live ads in rotation order for one section ("home", "discover", "games", "rewards"). */
export function useRotatedAds(section: string): Ad[] {
  const ads = useLiveAds();
  return useMemo(() => orderAds(ads, section), [ads, section]);
}

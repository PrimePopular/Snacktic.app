import { useEffect, useState } from 'react';
import { AdCard, listLiveAds } from '../../features/ads';
import type { Ad } from '../../features/ads';
import { beginAdRetry } from '../../features/points';
import { Button, Card } from '../../shared/components';

const SECONDS = 15;

interface AdGateProps {
  gameId: string;
  mode: string;
  /** Called with the gate id once the ad has been on screen long enough. */
  onReady: (gateId: string) => void;
  onCancel: () => void;
}

/**
 * Retry by watching an ad. The server picks the ad and notes the time; this shows it for 15 seconds. The student can
 * open the advertiser's link and come back: the clock keeps running. The server checks the time again before the retry starts.
 */
export function AdGate({ gameId, mode, onReady, onCancel }: AdGateProps) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [gate, setGate] = useState<string | null>(null);
  const [started, setStarted] = useState(0);
  const [left, setLeft] = useState(SECONDS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const begun = await beginAdRetry(gameId, mode);
        const ads = await listLiveAds();
        if (!active) return;
        setAd(ads.find((a) => a.id === begun.adId) ?? ads[0] ?? null);
        setGate(begun.gateId);
        setStarted(Date.now());
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    })();
    return () => {
      active = false;
    };
  }, [gameId, mode]);

  useEffect(() => {
    if (!started) return;
    const tick = () => setLeft(Math.max(0, Math.ceil(SECONDS - (Date.now() - started) / 1000)));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [started]);

  return (
    <div className="game-overlay game-overlay--top" role="dialog" aria-modal="true" aria-label="Watch an ad to retry">
      <Card tone="warm" className="game-result">
        <h2 className="game-result__title">Watch to retry</h2>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : !ad ? (
          <p className="text-secondary">Finding an ad…</p>
        ) : (
          <>
            <AdCard ad={ad} noReward />
            <p className="text-secondary text-small">{left > 0 ? `Your retry unlocks in ${left} second${left === 1 ? '' : 's'}.` : 'Thanks for watching!'}</p>
          </>
        )}
        <div className="game-result__actions">
          <Button disabled={!gate || left > 0} onClick={() => gate && onReady(gate)}>
            Continue
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}

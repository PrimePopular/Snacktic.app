import { useCallback, useEffect, useState } from 'react';
import { getBalance, previewAttempt, startAttempt } from '../../features/points';
import type { AttemptPreview } from '../../features/points';
import { Button } from '../../shared/components';
import { AdGate } from './AdGate';

interface RetryPickerProps {
  gameId: string;
  mode: string;
  /** Called with the new try once it has been started on the server. */
  onStart: (attemptId: string) => void;
}

/**
 * Retrying a daily challenge, two ways: spend Crumb Points, or watch an ad (about 15 seconds) for free. Both count toward the
 * daily retry limit. If no ad is available the student is told so and can still pay with points. The owner can retry freely.
 */
export function RetryPicker({ gameId, mode, onStart }: RetryPickerProps) {
  const [preview, setPreview] = useState<AttemptPreview | null>(null);
  const [ad, setAd] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(() => {
    setError(null);
    void previewAttempt(gameId, mode)
      .then(setPreview)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Something went wrong.'));
  }, [gameId, mode]);

  useEffect(() => {
    check();
    void getBalance().then(setBalance).catch(() => setBalance(null));
  }, [check]);

  async function begin(gateId?: string) {
    setBusy(true);
    setError(null);
    try {
      const attempt = await startAttempt(gameId, mode, gateId);
      onStart(attempt.attemptId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
      setAd(false);
    }
  }

  if (error && !preview) {
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  }
  if (!preview) return <p className="text-secondary">One moment…</p>;

  if (preview.ownerFree) {
    return (
      <div className="retry-picker">
        <Button disabled={busy} onClick={() => void begin()}>
          Retry (free for you)
        </Button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    );
  }

  if (preview.retriesLeft <= 0) return <p className="text-secondary">No retries left today. Come back tomorrow for a new try.</p>;

  const cost = preview.cost;
  const missing = balance !== null && cost > 0 ? cost - balance : 0;

  return (
    <div className="retry-picker">
      <p className="text-secondary text-small">
        Try again. Pick one: {preview.retriesLeft} {preview.retriesLeft === 1 ? 'retry' : 'retries'} left today.
      </p>
      <Button disabled={busy || missing > 0} onClick={() => void begin()}>
        {cost > 0 ? `Retry with ${cost.toLocaleString()} Crumb Points` : 'Try again'}
      </Button>
      {missing > 0 && <p className="text-secondary text-small">You need {missing.toLocaleString()} more Crumb Points for this one.</p>}
      <Button variant="secondary" disabled={busy || !preview.adsAvailable} onClick={() => setAd(true)}>
        Watch an ad to retry (free)
      </Button>
      {!preview.adsAvailable && (
        <p className="text-secondary text-small">
          No ad is available right now.{' '}
          <button type="button" className="link-button" onClick={check}>
            Check again
          </button>
        </p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {ad && <AdGate gameId={gameId} mode={mode} onCancel={() => setAd(false)} onReady={(gate) => void begin(gate)} />}
    </div>
  );
}

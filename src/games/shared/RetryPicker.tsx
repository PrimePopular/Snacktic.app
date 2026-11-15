import { useCallback, useEffect, useState } from 'react';
import { previewAttempt, startAttempt } from '../../features/points';
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
 * Retrying a daily challenge: watch an ad first (about 15 seconds), at most a few times a day. If no ad is available the
 * student is told so and can check again a little later. The owner can retry freely, to test the games.
 */
export function RetryPicker({ gameId, mode, onStart }: RetryPickerProps) {
  const [preview, setPreview] = useState<AttemptPreview | null>(null);
  const [ad, setAd] = useState(false);
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

  return (
    <div className="retry-picker">
      {preview.adsAvailable ? (
        <>
          <Button disabled={busy} onClick={() => setAd(true)}>
            Watch an ad to retry
          </Button>
          <p className="text-secondary text-small">
            {preview.retriesLeft} {preview.retriesLeft === 1 ? 'retry' : 'retries'} left today.
          </p>
        </>
      ) : (
        <>
          <p className="text-secondary">There is no ad available right now, so you can't retry yet. Please try again in a little while.</p>
          <Button variant="secondary" onClick={check}>
            Check again
          </Button>
        </>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {ad && <AdGate gameId={gameId} mode={mode} onCancel={() => setAd(false)} onReady={(gate) => void begin(gate)} />}
    </div>
  );
}

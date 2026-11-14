import { useEffect, useState } from 'react';
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

/** The ways to retry a daily challenge: watch an ad (free), or pay Crumb Points. At most a few retries a day. */
export function RetryPicker({ gameId, mode, onStart }: RetryPickerProps) {
  const [preview, setPreview] = useState<AttemptPreview | null>(null);
  const [ad, setAd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void previewAttempt(gameId, mode)
      .then((p) => active && setPreview(p))
      .catch((err: unknown) => active && setError(err instanceof Error ? err.message : 'Something went wrong.'));
    return () => {
      active = false;
    };
  }, [gameId, mode]);

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

  function payAndRetry() {
    if (!preview) return;
    if (preview.cost > 0 && !window.confirm(`Retrying costs ${preview.cost} Crumb Points. Continue?`)) return;
    void begin();
  }

  if (error && !preview) {
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  }
  if (!preview) return <p className="text-secondary">One moment…</p>;

  if (preview.retriesLeft <= 0) return <p className="text-secondary">No retries left today. Come back tomorrow for a new try.</p>;

  return (
    <div className="retry-picker">
      <p className="text-secondary text-small">
        {preview.retriesLeft} {preview.retriesLeft === 1 ? 'retry' : 'retries'} left today.
      </p>
      {preview.adsAvailable ? (
        <Button disabled={busy} onClick={() => setAd(true)}>
          Retry by watching an ad
        </Button>
      ) : (
        <p className="text-secondary text-small">No ads right now, so retries use Crumb Points.</p>
      )}
      <Button variant={preview.adsAvailable ? 'secondary' : 'primary'} disabled={busy} onClick={payAndRetry}>
        {preview.cost > 0 ? `Retry for ${preview.cost} Crumb Points` : 'Retry'}
      </Button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {ad && <AdGate gameId={gameId} mode={mode} onCancel={() => setAd(false)} onReady={(gate) => void begin(gate)} />}
    </div>
  );
}

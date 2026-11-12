import { useEffect, useState } from 'react';
import { useAuth } from '../../features/authentication';
import { previewAttempt, startAttempt } from '../../features/points';
import { playTap } from '../../services/sound';
import { Button, Card } from '../../shared/components';
import './games-embed.css';

export interface ChooserMode {
  /** Must match the mode in the admin's game rules. */
  id: string;
  label: string;
  description: string;
  /** A once-a-day challenge: the first try is free, more tries cost Crumb Points. Needs an account. */
  daily?: boolean;
}

interface ModeChooserProps {
  gameId: string;
  modes: ChooserMode[];
  /** For a daily challenge, attemptId is the try the server just started. */
  onStart: (mode: string, attemptId?: string) => void;
}

/** The screen before a game starts: pick a mode. For daily challenges it shows what the try costs and starts it on the server. */
export function ModeChooser({ gameId, modes, onStart }: ModeChooserProps) {
  const { status } = useAuth();
  const signedIn = status === 'signed-in';
  const [previews, setPreviews] = useState<Record<string, { cost: number; tries: number }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    for (const mode of modes) {
      if (!mode.daily) continue;
      void previewAttempt(gameId, mode.id)
        .then((p) => {
          if (active) setPreviews((prev) => ({ ...prev, [mode.id]: { cost: p.cost, tries: p.tries } }));
        })
        .catch((err: unknown) => console.error('[games] preview', err));
    }
    return () => {
      active = false;
    };
  }, [gameId, modes, signedIn]);

  async function start(mode: ChooserMode) {
    playTap();
    setError(null);
    if (!mode.daily) return onStart(mode.id);
    setBusy(mode.id);
    try {
      const { attemptId } = await startAttempt(gameId, mode.id);
      onStart(mode.id, attemptId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(null);
    }
  }

  return (
    <div className="mode-chooser">
      {modes.map((mode) => {
        const preview = previews[mode.id];
        return (
          <Card key={mode.id} className="mode-chooser__card">
            <h3>{mode.label}</h3>
            <p className="text-secondary">{mode.description}</p>
            {mode.daily && !signedIn ? (
              <Button to="/profile">Sign in to play</Button>
            ) : (
              <Button disabled={busy !== null} onClick={() => void start(mode)}>
                {busy === mode.id
                  ? 'Starting…'
                  : mode.daily && preview
                    ? preview.tries === 0
                      ? 'Play (free today)'
                      : `Try again for ${preview.cost} Crumb Points`
                    : 'Play'}
              </Button>
            )}
          </Card>
        );
      })}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

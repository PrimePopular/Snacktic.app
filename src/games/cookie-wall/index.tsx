import { useRef, useState } from 'react';
import { useAuth } from '../../features/authentication';
import { previewAttempt, startAttempt } from '../../features/points';
import { Button, Card } from '../../shared/components';
import { RetryPicker } from '../shared/RetryPicker';
import type { GameProps } from '../game.types';
import { GameFrame } from '../shared/GameFrame';
import type { SendToGame } from '../shared/GameFrame';
import type { ProgressSpec } from '../shared/gameProgress';

const GAME_ID = 'cookie-wall';

/** The game's own settings and progress are kept in the database too. */
const PROGRESS: ProgressSpec = { gameId: GAME_ID, prefixes: ['snacktic-'] };

/**
 * Cookie Wall Race keeps its own original screens (home, levels, how to play). Levels 1 to 3 are casual. Levels 4 and 5
 * are daily challenges: the game asks the app for permission to start, and the app starts the try (free the first time
 * each day, Crumb Points for a retry). Page: public/games/cookie-wall/.
 */
export default function CookieWall({ start, onFinish, onExit }: GameProps) {
  const { status } = useAuth();
  const signedIn = status === 'signed-in';
  const firstLevel = start ? Number(start.mode.replace('level-', '')) || 1 : 0;
  const attempt = useRef<string | undefined>(start?.attemptId);
  const startedAt = useRef(Date.now());
  const done = useRef(false);
  const [pick, setPick] = useState<{ level: number; send: SendToGame } | null>(null);

  const src = start
    ? `/games/cookie-wall/index.html?embed=1&auto=1&level=${firstLevel}${start.attemptId ? '&approved=1' : ''}`
    : '/games/cookie-wall/index.html?embed=1';

  function finish(level: number, won: boolean, seconds: number) {
    if (done.current) return;
    done.current = true;
    onFinish({
      gameId: GAME_ID,
      mode: `level-${level}`,
      score: won ? 1 : 0,
      durationMs: Math.max(0, Math.round(seconds * 1000)),
      finishedAt: new Date().toISOString(),
      attemptId: level > 3 ? attempt.current : undefined,
    });
  }

  /** A daily level asks to start: begin the try on the server, then tell the game it may go ahead. */
  async function approve(level: number, send: SendToGame) {
    if (!signedIn) return send({ type: 'start-denied', error: 'Sign in to play the daily challenge.' });
    try {
      const preview = await previewAttempt(GAME_ID, `level-${level}`);
      if (preview.tries > 0) {
        // Already tried today: offer the retry choices (watch an ad, or Crumb Points) before the game starts.
        setPick({ level, send });
        return;
      }
      const result = await startAttempt(GAME_ID, `level-${level}`);
      attempt.current = result.attemptId;
      startedAt.current = Date.now();
      send({ type: 'start-approved', level });
    } catch (error) {
      send({ type: 'start-denied', error: error instanceof Error ? error.message : 'Something went wrong.' });
    }
  }

  /** Leaving a daily game that has started counts as a loss, so a try cannot be used to peek and then be taken back. */
  function leave() {
    if (attempt.current && !done.current) finish(firstLevel || 4, false, (Date.now() - startedAt.current) / 1000);
    else onExit();
  }

  function retryStarted(attemptId: string) {
    if (!pick) return;
    attempt.current = attemptId;
    startedAt.current = Date.now();
    pick.send({ type: 'start-approved', level: pick.level });
    setPick(null);
  }

  function retryCancelled() {
    pick?.send({ type: 'start-denied', error: 'No problem. Come back whenever you like.' });
    setPick(null);
  }

  return (
    <>
    <GameFrame
      src={src}
      title="Cookie Wall Race"
      progress={PROGRESS}
      onLeave={leave}
      onMessage={(message, send) => {
        if (message.type === 'request-start') return void approve(Number(message.level) || 4, send);
        if (message.type === 'finish') finish(Number(message.level) || 1, message.won === true, Number(message.seconds) || 0);
      }}
    />
    {pick && (
      <div className="game-overlay game-overlay--top" role="dialog" aria-modal="true" aria-label="Try again">
        <Card tone="warm" className="game-result">
          <h2 className="game-result__title">Try again?</h2>
          <RetryPicker gameId={GAME_ID} mode={`level-${pick.level}`} onStart={retryStarted} />
          <Button variant="secondary" onClick={retryCancelled}>
            Not now
          </Button>
        </Card>
      </div>
    )}
    </>
  );
}

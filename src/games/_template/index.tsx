import { useEffect, useRef, useState } from 'react';
import type { GameProps } from '../game.types';
import './template.css';

/**
 * A tiny working game to copy from: tap as many times as you can in 10 seconds.
 * It shows the whole contract AND two modes:
 *   - "practice": replay as much as you like (small points)
 *   - "daily": the daily challenge (points depend on the score)
 * Render the game, then call onFinish() ONCE with the result, including the mode.
 * It is NOT registered in src/games/registry.ts, so students never see it.
 * To start a real game: copy this folder, rename it, change GAME_ID, and register it.
 */
const GAME_ID = 'tap-test';
const ROUND_MS = 10_000;

type Mode = 'practice' | 'daily';

export default function TapTest({ onFinish, onExit }: GameProps) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [taps, setTaps] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(ROUND_MS);
  const tapCount = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    if (startedAt === null || mode === null) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, ROUND_MS - (Date.now() - startedAt));
      setRemaining(left);
      if (left === 0 && !finished.current) {
        finished.current = true; // report the result exactly once
        window.clearInterval(timer);
        onFinish({
          gameId: GAME_ID,
          mode,
          score: tapCount.current,
          durationMs: ROUND_MS,
          finishedAt: new Date().toISOString(),
        });
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [startedAt, mode, onFinish]);

  function tap() {
    if (startedAt === null) setStartedAt(Date.now());
    tapCount.current += 1;
    setTaps(tapCount.current);
  }

  if (mode === null) {
    return (
      <div className="tap-test">
        <p>Choose a mode</p>
        <button type="button" className="btn btn--secondary" onClick={() => setMode('practice')}>
          Practice
        </button>
        <button type="button" className="btn btn--primary" onClick={() => setMode('daily')}>
          Daily challenge
        </button>
        <button type="button" className="link-button" onClick={onExit}>
          Leave game
        </button>
      </div>
    );
  }

  return (
    <div className="tap-test">
      <p className="tap-test__time" aria-live="off">
        {startedAt === null ? 'Tap to start' : `${(remaining / 1000).toFixed(1)}s`}
      </p>
      <button type="button" className="tap-test__button" onClick={tap} aria-label="Tap">
        {taps}
      </button>
      <button type="button" className="link-button" onClick={onExit}>
        Leave game
      </button>
    </div>
  );
}

import { useRef, useState } from 'react';
import type { GameProps } from '../game.types';
import { GameFrame } from '../shared/GameFrame';
import { ModeChooser } from '../shared/ModeChooser';
import type { ChooserMode } from '../shared/ModeChooser';

const GAME_ID = 'cookie-wall';

/** Levels 1 to 3 are casual. Levels 4 and 5 are daily challenges: the first try is free, retries cost Crumb Points. */
const MODES: ChooserMode[] = [
  { id: 'level-1', label: 'Level 1: Crumb', description: 'Wanders around and rarely blocks you. A gentle start.' },
  { id: 'level-2', label: 'Level 2: Nibbler', description: 'Takes the shortest path and drops the odd wall.' },
  { id: 'level-3', label: 'Level 3: Snacker', description: 'Thinks two moves ahead. A solid casual opponent.' },
  { id: 'level-4', label: 'Level 4: Gourmet', daily: true, description: 'Daily challenge. Thinks three moves ahead and plays walls with purpose. Win to earn big points.' },
  { id: 'level-5', label: 'Level 5: Cookie Monster', daily: true, description: 'Daily challenge. Nearly impossible, and it learns from every loss. The biggest prize.' },
];

/** Cookie Wall Race: reach the far side first, building walls to slow the cookie monster. Page: public/games/cookie-wall/. */
export default function CookieWall({ onFinish, onExit }: GameProps) {
  const [session, setSession] = useState<{ mode: string; attemptId?: string } | null>(null);
  const done = useRef(false);
  const startedAt = useRef(0);

  if (!session) {
    return (
      <ModeChooser
        gameId={GAME_ID}
        modes={MODES}
        onStart={(mode, attemptId) => {
          startedAt.current = Date.now();
          done.current = false;
          setSession({ mode, attemptId });
        }}
      />
    );
  }

  function finish(won: boolean, seconds: number) {
    if (done.current || !session) return;
    done.current = true;
    onFinish({
      gameId: GAME_ID,
      mode: session.mode,
      score: won ? 1 : 0,
      durationMs: Math.max(0, Math.round(seconds * 1000)),
      finishedAt: new Date().toISOString(),
      attemptId: session.attemptId,
    });
  }

  /** Leaving a daily game counts as a loss, so a try cannot be used to peek and then be taken back. */
  function leave() {
    if (session?.attemptId) finish(false, (Date.now() - startedAt.current) / 1000);
    else onExit();
  }

  const level = session.mode.replace('level-', '');
  return (
    <GameFrame
      src={`/games/cookie-wall/index.html?embed=1&level=${level}`}
      title="Cookie Wall Race"
      onLeave={leave}
      onMessage={(message) => {
        if (message.type === 'exit') return leave();
        if (message.type === 'finish') finish(message.won === true, Number(message.seconds) || 0);
      }}
    />
  );
}

import { useRef, useState } from 'react';
import type { GameProps } from '../game.types';
import { GameFrame } from '../shared/GameFrame';
import { ModeChooser } from '../shared/ModeChooser';
import type { ChooserMode } from '../shared/ModeChooser';
import type { ProgressSpec } from '../shared/gameProgress';

const GAME_ID = 'crumbly';

/** Best scores and settings are kept in the database too. */
const PROGRESS: ProgressSpec = { gameId: GAME_ID, prefixes: ['crumbly'] };

const MODES: ChooserMode[] = [
  { id: 'classic', label: 'Classic', description: 'Play, unlock bonuses and earn Crumb Points.' },
  { id: 'daily', label: 'Daily Challenge', daily: true, description: 'A new puzzle every day.' },
];

/** Crumbly (the number-merging game). The game page lives in public/games/crumbly.html and reports each finished round. */
export default function Crumbly({ onFinish, onExit }: GameProps) {
  const [session, setSession] = useState<{ mode: string; attemptId?: string } | null>(null);
  const done = useRef(false);

  if (!session) return <ModeChooser gameId={GAME_ID} modes={MODES} onStart={(mode, attemptId) => setSession({ mode, attemptId })} />;

  return (
    <GameFrame
      src={`/games/crumbly.html?embed=1&mode=${session.mode}`}
      title="Crumbly"
      progress={PROGRESS}
      onLeave={onExit}
      onMessage={(message) => {
        if (message.type === 'exit') return onExit();
        if (message.type !== 'finish' || done.current) return;
        done.current = true;
        onFinish({
          gameId: GAME_ID,
          mode: session.mode,
          score: Math.max(0, Math.round(Number(message.score) || 0)),
          durationMs: Math.max(0, Math.round((Number(message.seconds) || 0) * 1000)),
          finishedAt: new Date().toISOString(),
          attemptId: session.attemptId,
        });
      }}
    />
  );
}

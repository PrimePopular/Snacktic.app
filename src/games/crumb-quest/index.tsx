import { useRef, useState } from 'react';
import { useAuth } from '../../features/authentication';
import { submitGameResult } from '../../features/points';
import { playCoin } from '../../services/sound';
import type { GameProps } from '../game.types';
import { GameFrame } from '../shared/GameFrame';
import { ModeChooser } from '../shared/ModeChooser';
import type { ChooserMode } from '../shared/ModeChooser';

const GAME_ID = 'crumb-quest';

/** Points for clearing each of the 10 Daily Quest levels. They add up to 150. Level 1 is easy, so it pays least. */
const QUEST_POINTS = [5, 8, 10, 12, 14, 16, 18, 20, 22, 25];
const questScore = (levels: number) => QUEST_POINTS.slice(0, Math.max(0, Math.min(QUEST_POINTS.length, levels))).reduce((a, b) => a + b, 0);

const MODES: ChooserMode[] = [
  { id: 'classic-bake', label: 'Classic Bake', description: 'Solve level after level at your own pace. Each level you clear can earn a few Crumb Points each day.' },
  { id: 'daily-quest', label: 'Daily Quest', daily: true, description: 'Ten levels against the cookie alarm. Every level you clear earns points, up to 150. Later levels pay more.' },
];

/** Crumb Quest (the word game). The game page lives in public/games/crumb-quest.html. */
export default function CrumbQuest({ onFinish, onExit }: GameProps) {
  const { status } = useAuth();
  const signedIn = status === 'signed-in';
  const [session, setSession] = useState<{ mode: string; attemptId?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const done = useRef(false);
  const levels = useRef(0);
  const startedAt = useRef(0);
  const levelStartedAt = useRef(0);

  if (!session) {
    return (
      <ModeChooser
        gameId={GAME_ID}
        modes={MODES}
        onStart={(mode, attemptId) => {
          if (mode === 'daily-quest') {
            // The server decides who may play today. Clear the game's own local one-try lock for this try.
            try {
              localStorage.removeItem('crumbquest-daily');
              localStorage.removeItem('crumbquest-progress-hard');
            } catch {
              /* storage unavailable: the game then uses its own lock */
            }
          }
          startedAt.current = Date.now();
          levelStartedAt.current = Date.now();
          levels.current = 0;
          done.current = false;
          setSession({ mode, attemptId });
        }}
      />
    );
  }

  function finishQuest(cleared: number) {
    if (done.current) return;
    done.current = true;
    onFinish({
      gameId: GAME_ID,
      mode: 'daily-quest',
      score: questScore(cleared),
      durationMs: Math.max(0, Date.now() - startedAt.current),
      finishedAt: new Date().toISOString(),
      attemptId: session?.attemptId,
    });
  }

  /** Leaving a Daily Quest keeps the levels already cleared. */
  function leave() {
    if (session?.mode === 'daily-quest' && levels.current > 0) finishQuest(levels.current);
    else onExit();
  }

  return (
    <GameFrame
      src={`/games/crumb-quest.html?embed=1&mode=${session.mode === 'daily-quest' ? 'daily' : 'classic'}`}
      title="Crumb Quest"
      notice={notice}
      onLeave={leave}
      onMessage={(message) => {
        if (message.type === 'exit') return leave();
        if (message.type === 'quest-level') {
          levels.current = Math.max(levels.current, Number(message.levels) || 0);
          if (message.finished === true) finishQuest(levels.current);
          return;
        }
        if (message.type === 'quest-over') return finishQuest(Math.max(0, Number(message.levels) || 0));
        if (message.type === 'classic-level' && session.mode === 'classic-bake') {
          const level = Math.max(1, Number(message.level) || 1);
          const now = Date.now();
          const durationMs = Math.max(1000, now - levelStartedAt.current);
          levelStartedAt.current = now;
          void submitGameResult({ gameId: GAME_ID, mode: 'classic-bake', score: level, durationMs, finishedAt: new Date(now).toISOString() }, signedIn).then((outcome) => {
            if (outcome.status === 'awarded' && outcome.points > 0) {
              playCoin();
              setNotice(`+${outcome.points} Crumb ${outcome.points === 1 ? 'Point' : 'Points'}`);
            } else if (outcome.status === 'queued' && outcome.why === 'guest') {
              setNotice('Create an account within 24 hours to claim points for these levels.');
            }
          });
        }
      }}
    />
  );
}

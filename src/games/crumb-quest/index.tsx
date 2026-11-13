import { useRef, useState } from 'react';
import { useAuth } from '../../features/authentication';
import { getBalance, listGameItems, spendGameItem, submitGameResult } from '../../features/points';
import { playCoin } from '../../services/sound';
import type { GameProps } from '../game.types';
import { GameFrame } from '../shared/GameFrame';
import type { SendToGame } from '../shared/GameFrame';
import { ModeChooser } from '../shared/ModeChooser';
import type { ChooserMode } from '../shared/ModeChooser';
import type { ProgressSpec } from '../shared/gameProgress';

const GAME_ID = 'crumb-quest';

/** Saved progress for the casual mode. The daily quest and the game's own local currency are never copied. */
const PROGRESS: ProgressSpec = {
  gameId: GAME_ID,
  prefixes: ['crumbquest-'],
  exclude: ['crumbquest-daily', 'crumbquest-progress-hard', 'crumbquest-score', 'crumbquest-start-bonus'],
};

/** The hint packs, in the order the game lists them. Prices live in the database (Admin, Game challenges). */
const HINT_ITEMS = ['hint-1', 'hint-2', 'hint-3', 'hint-4'];

/** Points for clearing each of the 10 Daily Quest levels. They add up to 150. Level 1 is easy, so it pays least. */
const QUEST_POINTS = [5, 8, 10, 12, 14, 16, 18, 20, 22, 25];
const questScore = (levels: number) => QUEST_POINTS.slice(0, Math.max(0, Math.min(QUEST_POINTS.length, levels))).reduce((a, b) => a + b, 0);

const MODES: ChooserMode[] = [
  { id: 'classic-bake', label: 'Classic Bake', description: 'Play, unlock bonuses and earn Crumb Points.' },
  { id: 'daily-quest', label: 'Daily Challenge', daily: true, description: 'Ten levels against the cookie alarm.' },
];

/** Crumb Quest (the word game). The game page lives in public/games/crumb-quest.html and uses the app's Crumb Points. */
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

  /** Tells the game the student's real Crumb Points and the hint prices, so it never keeps a balance of its own. */
  async function sendBalance(send: SendToGame) {
    const [points, items] = await Promise.all([
      signedIn ? getBalance().catch(() => 0) : Promise.resolve(0),
      listGameItems(GAME_ID).catch(() => []),
    ]);
    send({ type: 'balance', points, prices: HINT_ITEMS.map((id) => items.find((i) => i.item === id)?.price ?? 99999) });
  }

  function buyHint(pack: number, send: SendToGame) {
    const item = HINT_ITEMS[pack];
    if (!item) return send({ type: 'hint-result', ok: false, error: 'That pack is not available.' });
    if (!signedIn) return send({ type: 'hint-result', ok: false, error: 'Sign in to buy hints with Crumb Points.' });
    spendGameItem(GAME_ID, item)
      .then((result) => send({ type: 'hint-result', ok: true, qty: result.qty, points: result.balance }))
      .catch((error: unknown) => send({ type: 'hint-result', ok: false, error: error instanceof Error ? error.message : 'Something went wrong. You were not charged.' }));
  }

  return (
    <GameFrame
      src={`/games/crumb-quest.html?embed=1&mode=${session.mode === 'daily-quest' ? 'daily' : 'classic'}`}
      title="Crumb Quest"
      notice={notice}
      progress={session.mode === 'classic-bake' ? PROGRESS : undefined}
      onLoad={(send) => void sendBalance(send)}
      onLeave={leave}
      onMessage={(message, send) => {
        if (message.type === 'exit') return leave();
        if (message.type === 'buy-hint') return buyHint(Number(message.pack), send);
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
              void sendBalance(send);
            } else if (outcome.status === 'queued' && outcome.why === 'guest') {
              setNotice('Create an account within 24 hours to claim points for these levels.');
            }
          });
        }
      }}
    />
  );
}

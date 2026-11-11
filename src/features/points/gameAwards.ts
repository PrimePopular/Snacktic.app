/**
 * THE CENTRAL WAY GAMES PAY POINTS. Owned by the Rewards developer.
 *
 * A game never changes a balance. When a round ends, call submitGameResult(). The database checks the
 * result (possible score, plausible time, daily rules, no double payment) and pays or refuses.
 *
 *  - Signed-in student: the result is sent now.
 *  - Guest: the result is kept on the device for 24 hours. Signing up and signing in claims it.
 *  - Offline or network trouble: the result is kept and retried automatically.
 */
import { supabase } from '../../services/database';
import type { GameResult } from '../../games/game.types';
import { notifyPointsChanged } from './pointsService';

const QUEUE_KEY = 'snacktic.pendingResults';
const DAY_MS = 86_400_000;

export type AwardReason = 'daily_first' | 'replay' | 'cap_reached' | 'no_points' | 'already_recorded' | 'score_too_low';

export type AwardOutcome =
  | { status: 'awarded'; points: number; reason: AwardReason }
  | { status: 'queued'; why: 'guest' | 'offline' }
  | { status: 'rejected'; message: string };

interface Pending {
  clientId: string;
  gameId: string;
  mode?: string;
  score: number;
  durationMs: number;
  playedAt: string;
}

/* ------------------------------ the waiting list ----------------------------- */

function readQueue(): Pending[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - DAY_MS;
    // Results older than 24 hours can no longer be claimed, so they are dropped.
    return (parsed as Pending[]).filter((p) => p && Date.parse(p.playedAt) > cutoff);
  } catch {
    return [];
  }
}

function writeQueue(queue: Pending[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* storage unavailable: the result is simply not kept */
  }
}

export function pendingResultCount(): number {
  return readQueue().length;
}

/* ------------------------------ talking to the server ------------------------ */

type Attempt =
  | { kind: 'ok'; points: number; reason: AwardReason }
  | { kind: 'refused'; message: string }
  | { kind: 'network' };

/** Messages written in the database function that are safe and useful to show as they are. */
const SHOWABLE = [
  'That game is not giving points right now',
  'That result is too old to claim',
  'That score is not possible',
  'That result is not valid',
  'Sign in to earn points',
];

async function attempt(p: Pending): Promise<Attempt> {
  if (!supabase) return { kind: 'network' };
  const { data, error } = await supabase.rpc('award_game_points', {
    p_game_id: p.gameId,
    p_client_id: p.clientId,
    p_score: p.score,
    p_duration_ms: p.durationMs,
    p_played_at: p.playedAt,
    p_mode: p.mode ?? 'default',
  });
  if (error) {
    // P0001 is "the database function said no". Anything else is a connection problem.
    if (error.code === 'P0001') {
      const known = SHOWABLE.find((text) => error.message.includes(text));
      return { kind: 'refused', message: known ?? 'We could not add points for this result.' };
    }
    console.error('[points] award attempt', error.message);
    return { kind: 'network' };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { points: number; reason: AwardReason } | undefined;
  return { kind: 'ok', points: row?.points ?? 0, reason: row?.reason ?? 'no_points' };
}

/**
 * Call once when a round ends. Never throws.
 * @param signedIn whether the student has an account right now
 */
export async function submitGameResult(result: GameResult, signedIn: boolean): Promise<AwardOutcome> {
  const pending: Pending = {
    clientId: crypto.randomUUID(),
    gameId: result.gameId,
    mode: result.mode ?? 'default',
    score: result.score,
    durationMs: result.durationMs,
    playedAt: result.finishedAt,
  };

  if (!signedIn) {
    writeQueue([...readQueue(), pending]);
    return { status: 'queued', why: 'guest' };
  }

  const outcome = await attempt(pending);
  if (outcome.kind === 'ok') {
    if (outcome.points > 0) notifyPointsChanged();
    return { status: 'awarded', points: outcome.points, reason: outcome.reason };
  }
  if (outcome.kind === 'refused') return { status: 'rejected', message: outcome.message };
  writeQueue([...readQueue(), pending]);
  return { status: 'queued', why: 'offline' };
}

let flushing = false;

/**
 * Sends everything waiting (guest results after signing in, or results saved while offline).
 * Safe to call often. Returns how many results were paid and the total points.
 */
export async function flushPendingResults(): Promise<{ claimed: number; points: number }> {
  if (flushing) return { claimed: 0, points: 0 };
  flushing = true;
  let claimed = 0;
  let points = 0;
  try {
    let queue = readQueue();
    for (const item of [...queue]) {
      const outcome = await attempt(item);
      if (outcome.kind === 'network') break; // try again later
      queue = queue.filter((q) => q.clientId !== item.clientId);
      writeQueue(queue);
      if (outcome.kind === 'ok' && outcome.points > 0) {
        claimed += 1;
        points += outcome.points;
      }
    }
  } finally {
    flushing = false;
  }
  if (points > 0) notifyPointsChanged();
  return { claimed, points };
}

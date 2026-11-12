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

export type AwardReason = 'daily_first' | 'replay' | 'cap_reached' | 'no_points' | 'already_recorded' | 'score_too_low' | 'challenge' | 'milestone';

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
  'Your account is suspended',
  'Start the challenge first',
  'Not enough Crumb Points to try again',
  'That game has no daily challenge right now',
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
    clientId: result.attemptId ?? crypto.randomUUID(),
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

/* ------------------------------ daily challenge tries ------------------------ */

function friendly(message: string): Error {
  const known = SHOWABLE.find((text) => message.includes(text));
  if (!known) console.error('[points] attempt', message);
  return new Error(known ?? 'Something went wrong. Please try again.');
}

/** What the next try at a daily challenge would cost. Changes nothing. */
export async function previewAttempt(gameId: string, mode: string): Promise<{ daily: boolean; cost: number; tries: number }> {
  if (!supabase) throw new Error('The database is not connected yet.');
  const { data, error } = await supabase.rpc('preview_game_attempt', { p_game_id: gameId, p_mode: mode });
  if (error) throw friendly(error.message);
  const row = ((data ?? []) as { is_daily: boolean; cost: number; tries_today: number }[])[0];
  return { daily: Boolean(row?.is_daily), cost: row?.cost ?? 0, tries: row?.tries_today ?? 0 };
}

/**
 * Starts a try at a daily challenge. The first try each day is free; later tries cost Crumb Points,
 * taken here. Pass the returned attemptId as GameResult.attemptId when the round ends.
 */
export async function startAttempt(gameId: string, mode: string): Promise<{ attemptId: string; cost: number }> {
  if (!supabase) throw new Error('The database is not connected yet.');
  const { data, error } = await supabase.rpc('start_game_attempt', { p_game_id: gameId, p_mode: mode });
  if (error) throw friendly(error.message);
  const row = ((data ?? []) as { attempt_id: string; cost: number }[])[0];
  if (!row) throw new Error('Something went wrong. Please try again.');
  if (row.cost > 0) notifyPointsChanged();
  return { attemptId: row.attempt_id, cost: row.cost };
}

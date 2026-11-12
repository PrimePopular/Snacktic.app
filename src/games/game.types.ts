/**
 * THE GAME MODULE CONTRACT. Owned by the Foundation developer.
 *
 * Two kinds of play live in the Games section:
 *  1. Classic games: four permanent games that always have a slot (GameDefinition).
 *  2. Special events: limited-time, game-like campaigns such as Find a Friend. They have a
 *     start and end date, appear only while active, and are not part of the permanent list
 *     (SpecialEventDefinition).
 */
import type { ComponentType } from 'react';

/* ------------------------------ Classic games ------------------------------ */

export type ClassicSlot = 1 | 2 | 3 | 4;

export interface GameResult {
  gameId: string;
  /** The score as the game calculated it. The server re-validates before any points are awarded. */
  score: number;
  /** How long the session lasted, in milliseconds. Used by server-side plausibility checks. */
  durationMs: number;
  /** ISO timestamp of when the session ended. */
  finishedAt: string;
  /**
   * Which mode was played, for games with more than one (for example "classic" and "daily", or
   * "level-4"). Lowercase letters, numbers and dashes. The owner sets points per mode in the admin.
   * Leave it out for a game with a single mode.
   */
  mode?: string;
  /**
   * Daily challenges only: the id returned by startAttempt() when the student began the try. The result is
   * paid for that try, once.
   */
  attemptId?: string;
}

export interface GameProps {
  /** Call once when the game ends, with the final result. */
  onFinish: (result: GameResult) => void;
  /** Call if the player leaves mid-game. */
  onExit: () => void;
}

/** A mode shown on the game's card. The id must match the mode in the admin's game rules. */
export interface GameMode {
  id: string;
  label: string;
  /** Daily challenges are the hard, once-a-day versions. */
  dailyChallenge?: boolean;
}

export interface GameDefinition {
  /** URL-safe slug. Must match the folder name, e.g. "catch-crumbs". */
  id: string;
  /** Which of the four permanent positions this game fills. */
  slot: ClassicSlot;
  title: string;
  /** One line shown on the selection card. */
  summary: string;
  /** Plain-language instructions shown before play. */
  instructions: string;
  /** Typical play time, shown on the selection card. */
  estimatedSeconds: number;
  /** Optional: the modes this game offers, shown on its card (regular and daily challenge). */
  modes?: GameMode[];
  /** Lazy loader so a game's code is only downloaded when it is played. */
  load: () => Promise<{ default: ComponentType<GameProps> }>;
}

/* ----------------------------- Special events ------------------------------ */

export interface SpecialEventProps {
  /** Call if the player leaves the event screen. */
  onExit: () => void;
}

export interface SpecialEventDefinition {
  /** URL-safe slug. Must match the folder name under src/special-events/. */
  id: string;
  title: string;
  /** One line shown on the event card. */
  summary: string;
  /** ISO timestamps. The event is shown from startsAt until endsAt. */
  startsAt: string;
  endsAt: string;
  load: () => Promise<{ default: ComponentType<SpecialEventProps> }>;
}

import { supabase } from '../../services/database';

export interface SpeedOutcome {
  /** Crumb Points paid for this win (0 for an ordinary win that did not beat the best). */
  awarded: number;
}

/**
 * Reports a winning time to the database for a personal-best reward. The time is measured privately inside the game and is
 * never shown. The database decides everything: whether the time is plausible, whether it beats the saved best, and the
 * amount. Never throws: a problem here must not spoil the result screen.
 */
export async function recordSpeedWin(gameId: string, level: number, ms: number): Promise<SpeedOutcome> {
  if (!supabase || !(ms > 0)) return { awarded: 0 };
  try {
    const { data, error } = await supabase.rpc('record_speed_win', { p_game: gameId, p_level: level, p_ms: Math.round(ms) });
    if (error) return { awarded: 0 };
    const row = (Array.isArray(data) ? data[0] : data) as { awarded: number } | undefined;
    return { awarded: row?.awarded ?? 0 };
  } catch {
    return { awarded: 0 };
  }
}

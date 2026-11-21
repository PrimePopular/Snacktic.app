import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../authentication';
import { claimDaily, getDailyStatus } from '../points';
import type { DailyStatus } from '../points';
import './daily.css';

/**
 * The 7-day login reward. Each day in a row pays a little more; miss a day or finish day 7 and it starts again at day 1.
 * Two shapes. "bar" (Home): one slim line with a Claim button, shown only until today's reward is claimed, then it disappears so it
 * never takes up the screen. "full" (Profile): the whole 7-day view, to see the streak. If the database update (supabase/031) has not
 * been run, nothing shows.
 */
export function DailyReward({ variant = 'full' }: { variant?: 'bar' | 'full' }) {
  const auth = useAuth();
  const [status, setStatus] = useState<DailyStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  const load = useCallback(async () => setStatus(await getDailyStatus()), []);
  useEffect(() => {
    if (auth.status === 'signed-in') void load();
  }, [auth.status, load]);

  if (auth.status !== 'signed-in' || !status) return null;

  async function claim() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await claimDaily();
      setMessage(r.awarded > 0 ? `+${r.awarded} Crumb Points. See you tomorrow!` : 'Already claimed today.');
      await load();
      if (variant === 'bar') window.setTimeout(() => setGone(true), 2200);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  const { nextDay, claimedToday, amounts } = status;

  if (variant === 'bar') {
    // Home: only until today is claimed (and a moment after, to say well done).
    if (gone || (claimedToday && !message)) return null;
    return (
      <div className="daily-bar" role="status">
        <span>{message ?? `Daily reward ready: +${amounts[nextDay - 1]} Crumb Points`}</span>
        {!message && (
          <button type="button" className="daily-bar__btn" disabled={busy} onClick={() => void claim()}>
            {busy ? 'Claiming…' : 'Claim'}
          </button>
        )}
      </div>
    );
  }
  const tomorrow = amounts[nextDay % 7];
  return (
    <section className="daily" aria-label="Daily reward">
      <div className="daily__head">
        <h2>Daily reward</h2>
        <span className="text-xs">Log in every day: it grows for 7 days</span>
      </div>
      <ol className="daily__days">
        {amounts.map((amount, i) => {
          const day = i + 1;
          const done = claimedToday ? day <= nextDay : day < nextDay;
          const today = !claimedToday && day === nextDay;
          return (
            <li key={day} className={`daily__day${done ? ' daily__day--done' : ''}${today ? ' daily__day--today' : ''}`}>
              <span className="daily__label">Day {day}</span>
              <strong>{done ? '✓' : `+${amount}`}</strong>
            </li>
          );
        })}
      </ol>
      {claimedToday ? (
        <p className="daily__note">Claimed today. Come back tomorrow for +{tomorrow} Crumb Points.</p>
      ) : (
        <button type="button" className="daily__claim" disabled={busy} onClick={() => void claim()}>
          {busy ? 'Claiming…' : `Claim +${amounts[nextDay - 1]} Crumb Points`}
        </button>
      )}
      {message && (
        <p className="daily__note" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

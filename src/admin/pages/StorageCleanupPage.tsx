import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getCleanupSettings, runCleanupNow, saveCleanupSettings } from '../../features/cleanup';
import { purgeEndedEvents } from '../../features/events';
import type { CleanupResult } from '../../features/cleanup';
import { Button, Loading, TextField } from '../../shared/components';

const whole = (v: string, min: number, max: number) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max;

/** Storage cleanup, owner only: how long finished data is kept before it is removed automatically. */
export function StorageCleanupPage() {
  const [loaded, setLoaded] = useState(false);
  const [orders, setOrders] = useState('7');
  const [notes, setNotes] = useState('30');
  const [plays, setPlays] = useState('30');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getCleanupSettings()
      .then((s) => {
        setOrders(String(s.ordersDays));
        setNotes(String(s.notificationsDays));
        setPlays(String(s.playsDays));
      })
      .catch((err: unknown) => {
        console.error('[admin] cleanup', err);
        setError('Could not load the settings. Make sure supabase/017_cleanup_and_classic_rules.sql has been run.');
      })
      .finally(() => setLoaded(true));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!whole(orders, 1, 365) || !whole(notes, 1, 365) || !whole(plays, 2, 365)) return setError('Use whole numbers of days: 1 to 365 (game records at least 2).');
    setBusy(true);
    try {
      await saveCleanupSettings({ ordersDays: Number(orders), notificationsDays: Number(notes), playsDays: Number(plays) });
      setMessage('Saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  async function cleanNow() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const r: CleanupResult = await runCleanupNow();
      const events = await purgeEndedEvents();
      setMessage(`Done. Removed ${r.orders} finished orders, ${r.notifications} old messages, ${r.game_plays} old game records, ${r.game_attempts} old tries and ${events} ended events.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  if (!loaded) return <Loading label="Loading" />;

  return (
    <section aria-labelledby="sc-heading" className="ann">
      <h1 id="sc-heading">Storage cleanup</h1>
      <p className="text-secondary">
        Finished data removes itself so your free database lasts. Ended events are removed, with their pictures, whenever an admin opens the dashboard. Crumb Points history is never removed, so nobody loses points. Pictures are removed when you delete the item they belong to.
      </p>
      <form className="ann__form" onSubmit={(e) => void save(e)} noValidate>
        <TextField label="Remove handed-over or cancelled orders after (days)" type="number" inputMode="numeric" min={1} value={orders} onChange={(e) => setOrders(e.target.value)} hint="Pending orders are never removed." />
        <TextField label="Remove old messages after (days)" type="number" inputMode="numeric" min={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <TextField label="Remove old game records after (days)" type="number" inputMode="numeric" min={2} value={plays} onChange={(e) => setPlays(e.target.value)} hint="Only today's records are needed for daily limits." />
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-notice" role="status">{message}</p>}
        <div className="ann__actions">
          <Button type="submit" disabled={busy}>{busy ? 'Working…' : 'Save'}</Button>
          <Button variant="secondary" disabled={busy} onClick={() => void cleanNow()}>Clean up now</Button>
        </div>
      </form>
    </section>
  );
}

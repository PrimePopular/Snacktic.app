import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ownerOverview, ownerPayPrizes, ownerSetActive, ownerStartEvent, refreshLiveFindFriend } from '../../features/find-a-friend';
import type { FindFriendOverview } from '../../features/find-a-friend';
import { Button, Card, EmptyState, Loading, TextField } from '../../shared/components';

type LoadState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; events: FindFriendOverview[] };

interface FormState {
  name: string;
  points: string;
  first: string;
  second: string;
  third: string;
  endDate: string;
}

const emptyForm: FormState = { name: 'Find a Friend', points: '5', first: '0', second: '0', third: '0', endDate: '' };
const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function whole(value: string, max: number): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
}

/** Find a Friend, owner only: start an event, switch it on or off, pay the leaderboard prizes. */
export function FindFriendAdminPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState({ kind: 'ready', events: await ownerOverview() });
    } catch (err) {
      console.error('[admin] find a friend', err);
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setMessage(await action());
      setShowForm(false);
      await load();
      refreshLiveFindFriend();
    } catch (err) {
      console.error('[admin] find a friend', err);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  function handleStart(event: FormEvent) {
    event.preventDefault();
    const points = whole(form.points, 100);
    const first = whole(form.first, 1000);
    const second = whole(form.second, 1000);
    const third = whole(form.third, 1000);
    if (points === null) return setError('Points per find must be a whole number from 0 to 100.');
    if (first === null || second === null || third === null) return setError('Prizes must be whole numbers from 0 to 1000.');
    if (!form.endDate) return setError('Choose the last day of the event.');
    const endsAt = new Date(`${form.endDate}T23:59:59`);
    if (endsAt.getTime() <= Date.now()) return setError('The last day must be today or later.');
    const hasLive = state.kind === 'ready' && state.events.some((e) => e.live);
    if (hasLive && !window.confirm('An event is live right now. Starting a new one switches it off. Continue?')) return;
    void run(async () => {
      await ownerStartEvent({ name: form.name, pointsPerScan: points, prizeFirst: first, prizeSecond: second, prizeThird: third, endsAt: endsAt.toISOString() });
      return 'The event is live. Students will see the tag now.';
    });
  }

  return (
    <section aria-labelledby="ff-admin-heading" className="ann">
      <div className="ann__head">
        <div>
          <h1 id="ff-admin-heading">Find a Friend</h1>
          <p className="text-secondary">Start the event, set the points for each friend found, switch it off or on, and pay the prizes at the end.</p>
        </div>
        <Button onClick={() => { setError(null); setShowForm(true); }}>Start an event</Button>
      </div>

      {message && <p className="form-notice" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {showForm && (
        <form className="ann__form" onSubmit={handleStart} noValidate>
          <TextField label="Event name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
          <TextField label="Crumb Points for each friend found" type="number" inputMode="numeric" min={0} max={100} value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} hint="0 to 100. The student who scans earns this. You can start a new event later with a different number." />
          <fieldset className="form-group">
            <legend>Leaderboard prizes (optional)</legend>
            <TextField label="First place" type="number" inputMode="numeric" min={0} max={1000} value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })} />
            <TextField label="Second place" type="number" inputMode="numeric" min={0} max={1000} value={form.second} onChange={(e) => setForm({ ...form, second: e.target.value })} />
            <TextField label="Third place" type="number" inputMode="numeric" min={0} max={1000} value={form.third} onChange={(e) => setForm({ ...form, third: e.target.value })} hint="You pay these yourself with the Pay prizes button when the event is over." />
          </fieldset>
          <TextField label="Last day" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} hint="The event stops at the end of this day." />
          <div className="ann__actions">
            <Button type="submit" disabled={busy}>{busy ? 'Starting…' : 'Start now'}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {state.kind === 'loading' && <Loading label="Loading events" />}
      {state.kind === 'error' && (
        <EmptyState title="We couldn't load events" action={<Button onClick={() => void load()}>Try again</Button>}>
          {state.message}. Make sure supabase/012_find_a_friend_and_notifications.sql has been run.
        </EmptyState>
      )}
      {state.kind === 'ready' && state.events.length === 0 && !showForm && (
        <EmptyState title="No events yet" action={<Button onClick={() => setShowForm(true)}>Start the first event</Button>}>
          When you start one, a tag appears on every screen of the app.
        </EmptyState>
      )}
      {state.kind === 'ready' && state.events.length > 0 && (
        <ul className="ann__list">
          {state.events.map((e) => {
            const ended = Date.parse(e.endsAt) <= Date.now();
            const hasPrizes = e.prizeFirst + e.prizeSecond + e.prizeThird > 0;
            return (
              <li key={e.id}>
                <Card as="article" className="ann__item">
                  <div className="ann__meta">
                    {e.live && <span className="badge">Live</span>}
                    {!e.live && e.active && ended && <span className="badge badge--minor">Ended</span>}
                    {!e.live && !e.active && <span className="badge badge--minor">Switched off</span>}
                  </div>
                  <h2>{e.name}</h2>
                  <p className="text-secondary text-small">
                    Until {dateFormat.format(new Date(e.endsAt))} · {e.pointsPerScan} points per find · {e.players} joined · {e.scans} friends found
                  </p>
                  {hasPrizes && (
                    <p className="text-secondary text-small">
                      Prizes: {e.prizeFirst} / {e.prizeSecond} / {e.prizeThird} {e.prizesPaid ? '(paid)' : '(not paid yet)'}
                    </p>
                  )}
                  <div className="ann__actions">
                    {!ended && (
                      <Button variant="secondary" disabled={busy} onClick={() => void run(async () => { await ownerSetActive(e.id, !e.active); return e.active ? 'Switched off.' : 'Switched on.'; })}>
                        {e.active ? 'Switch off' : 'Switch on'}
                      </Button>
                    )}
                    {hasPrizes && !e.prizesPaid && (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm('Pay the prizes to the current top three? This can only be done once.')) {
                            void run(async () => `Paid ${await ownerPayPrizes(e.id)} students.`);
                          }
                        }}
                      >
                        Pay prizes
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

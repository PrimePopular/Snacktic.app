import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { adminAdjustPoints, adminSaveGiftLimits, getGiftLimits } from '../../features/points';
import { Button, TextField } from '../../shared/components';

/** Owner only: give or take points, and the limits on gifts between students. */
export function PointsAdminPage() {
  const [adjUser, setAdjUser] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjNote, setAdjNote] = useState('');
  const [maxCount, setMaxCount] = useState('');
  const [maxPoints, setMaxPoints] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getGiftLimits()
      .then((l) => {
        setMaxCount(String(l.maxCount));
        setMaxPoints(String(l.maxPoints));
      })
      .catch((e) => console.error('[admin] limits', e));
  }, []);

  async function adjust(event: FormEvent) {
    event.preventDefault();
    const amount = Number(adjAmount);
    if (!adjUser.trim()) return setMessage({ kind: 'error', text: 'Enter the nickname.' });
    if (!Number.isInteger(amount) || amount === 0) return setMessage({ kind: 'error', text: 'Enter a whole number, positive to give points or negative to take them.' });
    setBusy(true);
    setMessage(null);
    try {
      await adminAdjustPoints(adjUser, amount, adjNote);
      setMessage({ kind: 'ok', text: `${amount > 0 ? 'Gave' : 'Took'} ${Math.abs(amount)} points ${amount > 0 ? 'to' : 'from'} ${adjUser.trim()}.` });
      setAdjUser('');
      setAdjAmount('');
      setAdjNote('');
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Something went wrong.' });
    }
    setBusy(false);
  }

  async function saveLimits(event: FormEvent) {
    event.preventDefault();
    const count = Number(maxCount);
    const points = Number(maxPoints);
    if (!Number.isInteger(count) || count < 0 || !Number.isInteger(points) || points < 0) {
      return setMessage({ kind: 'error', text: 'Both limits must be whole numbers, 0 or more.' });
    }
    setBusy(true);
    setMessage(null);
    try {
      await adminSaveGiftLimits({ maxCount: count, maxPoints: points });
      setMessage({ kind: 'ok', text: 'Gift limits saved.' });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Something went wrong.' });
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby="pt-heading" className="ann">
      <div>
        <h1 id="pt-heading">Points and limits</h1>
        <p className="text-secondary">Owner only. Helper admins cannot change anyone's points.</p>
      </div>

      {message && (
        <p className={message.kind === 'ok' ? 'form-notice' : 'form-error'} role={message.kind === 'ok' ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}

      <h2>Gifts between students</h2>
      <p className="text-secondary text-small">Limits how much one student can receive from friends in a day, so people cannot pool points to buy rewards.</p>
      <form className="ann__form" onSubmit={saveLimits} noValidate>
        <TextField label="Most gifts one student can receive per day" type="number" inputMode="numeric" min={0} value={maxCount} onChange={(e) => setMaxCount(e.target.value)} />
        <TextField label="Most points one student can receive per day" type="number" inputMode="numeric" min={0} value={maxPoints} onChange={(e) => setMaxPoints(e.target.value)} hint="A gift that would go over this is refused, and the sender is told how many points the friend can still receive." />
        <Button type="submit" disabled={busy}>
          Save limits
        </Button>
      </form>

      <h2>Give or take points</h2>
      <form className="ann__form" onSubmit={adjust} noValidate>
        <TextField label="Nickname" value={adjUser} onChange={(e) => setAdjUser(e.target.value)} autoCapitalize="none" autoComplete="off" />
        <TextField label="Points" type="number" inputMode="numeric" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} hint="Positive gives points, negative takes them away." />
        <TextField label="Note" value={adjNote} onChange={(e) => setAdjNote(e.target.value)} hint="Optional. The student sees it in their activity." maxLength={80} />
        <Button type="submit" disabled={busy}>
          Apply
        </Button>
      </form>
    </section>
  );
}

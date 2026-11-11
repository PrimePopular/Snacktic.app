import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getBalance, getGiftLimits, giftPoints } from '../../features/points';
import type { GiftLimits } from '../../features/points';
import { playCoin } from '../../services/sound';
import { Button, Card, TextField } from '../../shared/components';

/** Send Crumb Points to a friend by nickname. Each student can only receive a limited amount per day. */
export function SendPoints() {
  const [balance, setBalance] = useState<number | null>(null);
  const [limits, setLimits] = useState<GiftLimits | null>(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [b, l] = await Promise.all([getBalance(), getGiftLimits()]);
      setBalance(b);
      setLimits(l);
    } catch (e) {
      console.error('[profile] points', e);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const points = Number(amount);
    if (!recipient.trim()) return setError("Enter your friend's nickname.");
    if (!Number.isInteger(points) || points < 1) return setError('Enter a whole number of points, at least 1.');
    setBusy(true);
    try {
      await giftPoints(recipient, points);
      playCoin();
      setNotice(`Sent ${points} ${points === 1 ? 'point' : 'points'} to ${recipient.trim()}.`);
      setRecipient('');
      setAmount('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  return (
    <Card className="account-section">
      <h3>Send points to a friend</h3>
      <p className="text-secondary text-small">
        You have <strong>{balance === null ? '…' : balance.toLocaleString()}</strong> Crumb Points.
        {limits && ` Each person can receive up to ${limits.maxCount} gifts and ${limits.maxPoints} points a day.`}
      </p>
      <form className="gift-form" onSubmit={handleSubmit} noValidate>
        <TextField label="Friend's nickname" value={recipient} onChange={(e) => setRecipient(e.target.value)} autoComplete="off" autoCapitalize="none" />
        <TextField label="Points" type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="form-notice" role="status">
            {notice}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          Send points
        </Button>
      </form>
    </Card>
  );
}

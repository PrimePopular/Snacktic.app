import { useEffect, useState } from 'react';
import { DEFAULT_REWARD_SETTINGS, getRewardSettings, saveRewardSettings } from '../../features/points';
import { Button, Card, TextField } from '../../shared/components';

/** The owner sets the welcome bonus for new accounts and the seven daily login amounts. */
export function RewardSettingsCard() {
  const [bonus, setBonus] = useState(String(DEFAULT_REWARD_SETTINGS.signupBonus));
  const [days, setDays] = useState(DEFAULT_REWARD_SETTINGS.dailyLogin.map(String));
  const [seconds, setSeconds] = useState(String(DEFAULT_REWARD_SETTINGS.eventViewSeconds));
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getRewardSettings(true).then((s) => {
      setBonus(String(s.signupBonus));
      setDays(s.dailyLogin.map(String));
      setSeconds(String(s.eventViewSeconds));
    });
  }, []);

  async function save() {
    const b = Number(bonus);
    const d = days.map(Number);
    const sec = Number(seconds);
    if (!Number.isInteger(sec) || sec < 1 || sec > 60) return setNote({ ok: false, text: 'Seconds must be a whole number from 1 to 60.' });
    if (!Number.isInteger(b) || b < 0 || b > 1000 || d.some((v) => !Number.isInteger(v) || v < 0 || v > 1000)) {
      return setNote({ ok: false, text: 'Use whole numbers from 0 to 1000.' });
    }
    setBusy(true);
    setNote(null);
    try {
      await saveRewardSettings({ signupBonus: b, dailyLogin: d, eventViewSeconds: sec });
      setNote({ ok: true, text: 'Saved. New sign-ups and the next daily claims use these amounts.' });
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? `${e.message}. Has supabase/031 been run?` : 'Something went wrong.' });
    }
    setBusy(false);
  }

  const total = days.reduce((n, v) => n + (Number(v) || 0), 0);
  return (
    <Card as="section" className="ann__item">
      <h2>Welcome bonus and daily login rewards</h2>
      <TextField label="Crumb Points for signing up" type="number" inputMode="numeric" min={0} max={1000} value={bonus} onChange={(e) => setBonus(e.target.value)} hint="Paid once to every new account when their email is confirmed (Google sign-ups straight away). Set 0 to turn it off." />
      <TextField label="Seconds to look at an event to earn its points" type="number" inputMode="numeric" min={1} max={60} value={seconds} onChange={(e) => setSeconds(e.target.value)} hint="The points themselves are set on each event (Admin, Events)." />
      <p className="text-small">Daily login reward, day by day. It grows over 7 days, then starts again. Missing a day starts again at day 1. Total for a full week: {total}.</p>
      {days.map((value, i) => (
        <TextField key={i} label={`Day ${i + 1}`} type="number" inputMode="numeric" min={0} max={1000} value={value} onChange={(e) => setDays(days.map((d, j) => (j === i ? e.target.value : d)))} />
      ))}
      {note && (
        <p className={note.ok ? 'form-notice' : 'form-error'} role={note.ok ? 'status' : 'alert'}>
          {note.text}
        </p>
      )}
      <Button disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save'}
      </Button>
    </Card>
  );
}

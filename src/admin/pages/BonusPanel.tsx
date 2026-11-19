import { useCallback, useEffect, useState } from 'react';
import { adminBonusStats, adminSaveBonusSettings, BONUS_SECTIONS, getBonusStatus } from '../../features/bonus';
import type { BonusStat } from '../../features/bonus';
import { Button, Card, CheckboxField, TextField } from '../../shared/components';

const sectionNames: Record<string, string> = { home: 'Home', discover: 'Discover', games: 'Games', rewards: 'Rewards' };

/** Bonus Rewards rules (who, how long, how often, where) and the numbers: views, clicks and claims for each offer. */
export function BonusPanel() {
  const [enabled, setEnabled] = useState(true);
  const [days, setDays] = useState('7');
  const [newEvery, setNewEvery] = useState('4');
  const [othersEvery, setOthersEvery] = useState('12');
  const [sections, setSections] = useState<string[]>([...BONUS_SECTIONS]);
  const [stats, setStats] = useState<BonusStat[]>([]);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const status = await getBonusStatus(true);
    setEnabled(status.enabled);
    setDays(String(status.eligibilityDays));
    setNewEvery(String(status.newUserEvery));
    setOthersEvery(String(status.othersEvery));
    setSections(status.sections);
    setStats(await adminBonusStats().catch(() => []));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const d = Number(days);
    const n = Number(newEvery);
    const o = Number(othersEvery);
    if (![d, n, o].every((v) => Number.isInteger(v) && v >= 1)) return setNote({ ok: false, text: 'Use whole numbers, at least 1.' });
    if (d > 365) return setNote({ ok: false, text: 'Eligibility can be at most 365 days.' });
    setBusy(true);
    setNote(null);
    try {
      await adminSaveBonusSettings({ enabled, eligibilityDays: d, newUserEvery: n, othersEvery: o, sections });
      setNote({ ok: true, text: 'Bonus settings saved.' });
    } catch (error) {
      setNote({ ok: false, text: error instanceof Error ? `${error.message}. Has supabase/022 been run?` : 'Something went wrong.' });
    }
    setBusy(false);
  }

  return (
    <details className="ann__item">
      <summary>
        <strong>Bonus Rewards: rules and numbers</strong>
      </summary>
      <Card as="div" className="ann__item">
        <p className="text-secondary text-small">
          To make a Bonus Reward, add or edit an item below and switch on "Bonus Reward". The item's normal price is shown crossed out; the bonus price is what new members pay.
        </p>
        <CheckboxField checked={enabled} onChange={(e) => setEnabled(e.target.checked)}>
          Promote Bonus Rewards (turn off to pause every offer)
        </CheckboxField>
        <TextField label="Who is a new member? (days since they registered)" type="number" inputMode="numeric" min={1} value={days} onChange={(e) => setDays(e.target.value)} hint="Only accounts newer than this can claim a Bonus Reward. The database checks it." />
        <TextField label="How often new members see an offer (1 in how many cards)" type="number" inputMode="numeric" min={1} value={newEvery} onChange={(e) => setNewEvery(e.target.value)} hint="A smaller number means more often." />
        <TextField label="How often everyone else sees an offer (1 in how many cards)" type="number" inputMode="numeric" min={1} value={othersEvery} onChange={(e) => setOthersEvery(e.target.value)} />
        <fieldset>
          <legend className="text-small">Where offers may appear</legend>
          {BONUS_SECTIONS.map((s) => (
            <CheckboxField key={s} checked={sections.includes(s)} onChange={(e) => setSections(e.target.checked ? [...sections, s] : sections.filter((x) => x !== s))}>
              {sectionNames[s]}
            </CheckboxField>
          ))}
        </fieldset>
        {note && (
          <p className={note.ok ? 'form-notice' : 'form-error'} role={note.ok ? 'status' : 'alert'}>
            {note.text}
          </p>
        )}
        <Button disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save bonus settings'}
        </Button>

        <h3>Views, clicks and claims</h3>
        {stats.length === 0 ? (
          <p className="text-secondary text-small">No Bonus Rewards yet.</p>
        ) : (
          <ul className="activity-list">
            {stats.map((s) => (
              <li key={s.rewardId} className="activity-row">
                <span>{s.name}</span>
                <span className="text-xs text-secondary">
                  {s.views} views · {s.clicks} clicks · {s.claims} claimed
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </details>
  );
}

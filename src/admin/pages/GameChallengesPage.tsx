import { useCallback, useEffect, useState } from 'react';
import { adminListExtras, adminSetMilestones, adminSetRetryCost } from '../../features/points';
import type { ExtraRule, Milestone } from '../../features/points';
import { Button, Card, EmptyState, Loading, TextAreaField, TextField } from '../../shared/components';

const toText = (rows: Milestone[]) => rows.map((m) => `${m.score}: ${m.points}`).join('\n');

function parse(text: string): Milestone[] | null {
  const rows: Milestone[] = [];
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const match = /^(\d+)\s*[:,\s]\s*(\d+)$/.exec(line);
    if (!match) return null;
    rows.push({ score: Number(match[1]), points: Number(match[2]) });
  }
  return rows.length <= 20 && rows.every((r) => r.score > 0) ? rows : null;
}

function RuleCard({ rule, onSaved }: { rule: ExtraRule; onSaved: () => void }) {
  const [cost, setCost] = useState(String(rule.retryCost));
  const [text, setText] = useState(toText(rule.milestones));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      if (rule.isDaily) {
        const n = Number(cost);
        if (!Number.isInteger(n) || n < 0 || n > 1000) throw new Error('The retry cost must be a whole number from 0 to 1000.');
        await adminSetRetryCost(rule.gameId, rule.mode, n);
      }
      if (rule.isMilestones) {
        const rows = parse(text);
        if (!rows) throw new Error('Write one milestone per line, like 5000: 10 (score, then points). Up to 20 lines.');
        await adminSetMilestones(rule.gameId, rule.mode, rows);
      }
      setMessage('Saved.');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  return (
    <Card as="article" className="ann__item">
      <h2>{rule.label}</h2>
      {rule.isDaily && (
        <TextField label="Cost to try again (Crumb Points)" type="number" inputMode="numeric" min={0} max={1000} value={cost} onChange={(e) => setCost(e.target.value)} hint="The first try each day is free. Every try after that costs this." />
      )}
      {rule.isMilestones && (
        <TextAreaField label="Score milestones" value={text} onChange={(e) => setText(e.target.value)} rows={5} hint="One per line: score, then points. Each milestone pays once per student, ever. Example: 5000: 10" />
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-notice" role="status">{message}</p>}
      <div className="ann__actions">
        <Button disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</Button>
      </div>
    </Card>
  );
}

/** Game challenges, owner only: retry cost for daily challenges and score milestones. Other amounts are in Game points. */
export function GameChallengesPage() {
  const [rules, setRules] = useState<ExtraRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRules(await adminListExtras());
    } catch (err) {
      console.error('[admin] game challenges', err);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section aria-labelledby="gc-heading" className="ann">
      <h1 id="gc-heading">Game challenges</h1>
      <p className="text-secondary">Retry costs for daily challenges, and score milestones for classic play. Points per score, daily limits and the rest are in Game points.</p>
      {error && (
        <EmptyState title="We couldn't load game challenges" action={<Button onClick={() => void load()}>Try again</Button>}>
          {error}. Make sure supabase/014_game_challenges.sql has been run.
        </EmptyState>
      )}
      {!rules && !error && <Loading label="Loading" />}
      {rules && rules.length === 0 && <EmptyState title="Nothing to set yet">Games with a daily challenge or milestones will show up here.</EmptyState>}
      {rules && rules.length > 0 && (
        <ul className="ann__list">
          {rules.map((rule) => (
            <li key={`${rule.gameId}/${rule.mode}`}>
              <RuleCard rule={rule} onSaved={() => void load()} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

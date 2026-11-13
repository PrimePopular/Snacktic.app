import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { adminListGameRules, adminSaveGameRule, getTimezone, setTimezone } from '../../features/points';
import type { AwardType, GameRule } from '../../features/points';
import { classicGames } from '../../games/registry';
import { Button, Card, CheckboxField, EmptyState, Loading, SelectField, TextField } from '../../shared/components';

type LoadState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; rules: GameRule[]; timezone: string };

interface FormState {
  gameId: string;
  mode: string;
  modeLabel: string;
  isDaily: boolean;
  title: string;
  active: boolean;
  awardType: AwardType;
  first: string;
  replay: string;
  perScore: string;
  maxRound: string;
  replayPercent: string;
  minScore: string;
  cap: string;
  maxScore: string;
  minSeconds: string;
  maxSeconds: string;
}

const emptyForm: FormState = {
  gameId: '',
  mode: 'default',
  modeLabel: '',
  isDaily: false,
  title: '',
  active: true,
  awardType: 'fixed',
  first: '',
  replay: '',
  perScore: '',
  maxRound: '',
  replayPercent: '100',
  minScore: '0',
  cap: '',
  maxScore: '',
  minSeconds: '',
  maxSeconds: '',
};

const zones: string[] = (() => {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  return supported.includes('UTC') ? supported : ['UTC', ...supported];
})();

const whole = (value: string) => value.trim() !== '' && Number.isInteger(Number(value)) && Number(value) >= 0;

function describe(r: GameRule): string {
  const pay =
    r.awardType === 'fixed'
      ? `First round ${r.dailyFirstAward}, replay ${r.replayAward}`
      : `${r.pointsPerScore} per score point, max ${r.maxRoundAward} a round, replays ${r.replayPercent}%`;
  return `${pay} · Cap ${r.dailyCap}/day${r.minScore ? ` · Needs score ${r.minScore}+` : ''} ${r.awardType === 'fixed' ? '' : `· Max score ${r.maxScore} `}· Round ${r.minDurationMs / 1000}s to ${r.maxDurationMs / 1000}s`;
}

/** Owner only: what each game and mode pays, the limits that stop cheating, and when a day resets. */
export function GamesAdminPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<'new' | GameRule | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [zoneInput, setZoneInput] = useState('');

  const load = useCallback(async () => {
    try {
      const [rules, timezone] = await Promise.all([adminListGameRules(), getTimezone()]);
      setZoneInput(timezone);
      setState({ kind: 'ready', rules, timezone });
    } catch (error) {
      console.error('[admin] games', error);
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<void>, success: string): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await load();
      setMessage({ kind: 'ok', text: success });
      setBusy(false);
      return true;
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Something went wrong.' });
      setBusy(false);
      return false;
    }
  }

  function openForm(target: 'new' | GameRule) {
    setFormError(null);
    setForm(
      target === 'new'
        ? emptyForm
        : {
            gameId: target.gameId,
            mode: target.mode,
            modeLabel: target.modeLabel,
            isDaily: target.isDailyChallenge,
            title: target.title,
            active: target.active,
            awardType: target.awardType,
            first: String(target.dailyFirstAward),
            replay: String(target.replayAward),
            perScore: String(target.pointsPerScore),
            maxRound: String(target.maxRoundAward),
            replayPercent: String(target.replayPercent),
            minScore: String(target.minScore),
            cap: String(target.dailyCap),
            maxScore: String(target.maxScore),
            minSeconds: String(target.minDurationMs / 1000),
            maxSeconds: String(target.maxDurationMs / 1000),
          },
    );
    setEditing(target);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!/^[a-z0-9-]{2,40}$/.test(form.gameId)) return setFormError("The game id uses lowercase letters, numbers and dashes, 2 to 40 characters. It must match the game's folder name.");
    if (!/^[a-z0-9-]{1,30}$/.test(form.mode)) return setFormError('The mode id uses lowercase letters, numbers and dashes. Use "default" if the game has one mode.');
    if (!form.title.trim()) return setFormError('Enter a title.');
    const byScore = form.awardType === 'by_score';
    const perScore = Number(form.perScore);
    if (byScore) {
      if (!(perScore > 0) || !whole(form.maxRound) || Number(form.maxRound) < 1) return setFormError('For score-based points, enter points per score point (above 0) and the most one round can pay (1 or more).');
      if (!whole(form.replayPercent) || Number(form.replayPercent) > 100) return setFormError('Replays pay a whole percentage from 0 to 100.');
    } else if (!whole(form.first) || !whole(form.replay)) {
      return setFormError('Enter whole numbers for the first-round points and the replay points.');
    }
    if (![form.cap, form.maxScore, form.minScore].every(whole) || Number(form.maxScore) < 1) return setFormError('The daily cap, minimum score and maximum score must be whole numbers. The maximum score must be at least 1.');
    const minMs = Math.round(Number(form.minSeconds || 0) * 1000);
    const maxMs = Math.round(Number(form.maxSeconds || 0) * 1000);
    if (!(minMs >= 0) || !(maxMs > 0) || maxMs < minMs) return setFormError('Enter the shortest and longest realistic round in seconds. The longest must be above zero and not below the shortest.');
    setFormError(null);
    const ok = await run(
      () =>
        adminSaveGameRule(
          {
            gameId: form.gameId,
            mode: form.mode,
            modeLabel: form.modeLabel,
            isDailyChallenge: form.isDaily,
            title: form.title,
            active: form.active,
            awardType: form.awardType,
            dailyFirstAward: byScore ? 0 : Number(form.first),
            replayAward: byScore ? 0 : Number(form.replay),
            pointsPerScore: byScore ? perScore : 0,
            maxRoundAward: byScore ? Number(form.maxRound) : 0,
            replayPercent: byScore ? Number(form.replayPercent) : 100,
            minScore: Number(form.minScore),
            dailyCap: Number(form.cap),
            maxScore: Number(form.maxScore),
            minDurationMs: minMs,
            maxDurationMs: maxMs,
          },
          editing === 'new',
        ),
      'Saved.',
    );
    if (ok) setEditing(null);
  }

  function saveZone(event: FormEvent) {
    event.preventDefault();
    if (!zones.includes(zoneInput)) return setMessage({ kind: 'error', text: 'Choose a time zone from the list, for example Africa/Lagos or Europe/London.' });
    void run(() => setTimezone(zoneInput), 'Time zone saved.');
  }

  if (state.kind === 'loading') return <Loading label="Loading game rules" />;
  if (state.kind === 'error') {
    return (
      <EmptyState title="We couldn't load game rules" action={<Button onClick={() => void load()}>Try again</Button>}>
        {state.message}. Make sure the latest database updates (008 and 009) have been run and that you are signed in as the owner.
      </EmptyState>
    );
  }

  const registered = classicGames.map((g) => g.id);
  const editingExisting = editing !== null && editing !== 'new';

  return (
    <section aria-labelledby="gm-heading" className="ann">
      <div>
        <h1 id="gm-heading">Game points</h1>
        <p className="text-secondary">
          Nothing is paid until you add a rule. A rule is one game in one mode, for example <strong>tap-test</strong> in the <strong>daily</strong> mode.
          Easy games can pay less and hard ones more. A mode can pay a fixed amount, or an amount that grows with the score.
        </p>
      </div>

      {message && (
        <p className={message.kind === 'ok' ? 'form-notice' : 'form-error'} role={message.kind === 'ok' ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}

      <form className="team__add" onSubmit={saveZone} noValidate>
        <TextField label="Time zone for the daily reset" value={zoneInput} onChange={(e) => setZoneInput(e.target.value)} list="zone-list" hint="A new day starts at midnight in this time zone. Start typing, for example Africa/Lagos." autoComplete="off" />
        <datalist id="zone-list">
          {zones.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        <Button type="submit" disabled={busy || zoneInput === state.timezone}>
          Save time zone
        </Button>
      </form>

      <div className="ann__head">
        <h2>Game rules</h2>
        {!editing && <Button onClick={() => openForm('new')}>Add a game rule</Button>}
      </div>

      {editing && (
        <form className="ann__form" onSubmit={save} noValidate>
          <TextField
            label="Game id"
            value={form.gameId}
            onChange={(e) => setForm({ ...form, gameId: e.target.value.toLowerCase() })}
            list="game-ids"
            disabled={editingExisting}
            hint={registered.length ? `Registered games: ${registered.join(', ')}. It must match the game's folder name.` : "It must match the game's folder name, for example catch-crumbs."}
            autoCapitalize="none"
            autoComplete="off"
          />
          <datalist id="game-ids">
            {registered.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
          <TextField label="Title (shown in students' activity)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} />
          <fieldset className="form-group">
            <legend>Mode</legend>
            <TextField label="Mode id" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value.toLowerCase() })} disabled={editingExisting} hint='What the game reports, for example "classic", "daily" or "level-4". Use "default" if the game has only one mode.' autoCapitalize="none" autoComplete="off" />
            <TextField label="Mode name (optional)" value={form.modeLabel} onChange={(e) => setForm({ ...form, modeLabel: e.target.value })} maxLength={40} hint="Shown next to the title in students' activity." />
            <CheckboxField checked={form.isDaily} onChange={(e) => setForm({ ...form, isDaily: e.target.checked })}>
              This is a daily challenge
            </CheckboxField>
          </fieldset>

          <fieldset className="form-group">
            <legend>Points</legend>
            <SelectField label="How points are worked out" value={form.awardType} onChange={(e) => setForm({ ...form, awardType: e.target.value as AwardType })}>
              <option value="fixed">A fixed amount</option>
              <option value="by_score">Depends on the score</option>
              <option value="milestones">Score milestones (each pays once)</option>
            </SelectField>
            {form.awardType === 'milestones' ? (
              <p className="text-secondary text-small">The score thresholds and their points are set in Game challenges. The daily cap below still applies.</p>
            ) : form.awardType === 'fixed' ? (
              <>
                <TextField label="First completed round of the day" type="number" inputMode="numeric" min={0} value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })} />
                <TextField label="Each replay after that" type="number" inputMode="numeric" min={0} value={form.replay} onChange={(e) => setForm({ ...form, replay: e.target.value })} />
              </>
            ) : (
              <>
                <TextField label="Points per score point" type="number" inputMode="decimal" step="0.001" min={0} value={form.perScore} onChange={(e) => setForm({ ...form, perScore: e.target.value })} hint="For example 0.5 means a score of 40 pays 20 points." />
                <TextField label="Most one round can pay" type="number" inputMode="numeric" min={1} value={form.maxRound} onChange={(e) => setForm({ ...form, maxRound: e.target.value })} />
                <TextField label="Replays pay this % of a first round" type="number" inputMode="numeric" min={0} max={100} value={form.replayPercent} onChange={(e) => setForm({ ...form, replayPercent: e.target.value })} hint="100 means replays pay the same. 0 means only the first round of the day pays." />
              </>
            )}
            <TextField label="Score needed to earn anything" type="number" inputMode="numeric" min={0} value={form.minScore} onChange={(e) => setForm({ ...form, minScore: e.target.value })} hint="For a win-or-lose game, use 1 so losing pays nothing and does not use up the daily bonus." />
            <TextField label="Most one student can earn from this mode per day" type="number" inputMode="numeric" min={0} value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} />
          </fieldset>

          <fieldset className="form-group">
            <legend>Cheat limits (from the game's SCORING.md)</legend>
            {form.awardType !== 'fixed' && (
              <TextField label="Highest possible score" type="number" inputMode="numeric" min={1} value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} hint="Any score above this is refused." />
            )}
            <TextField label="Shortest realistic round (seconds)" type="number" inputMode="decimal" min={0} value={form.minSeconds} onChange={(e) => setForm({ ...form, minSeconds: e.target.value })} />
            <TextField label="Longest realistic round (seconds)" type="number" inputMode="decimal" min={0} value={form.maxSeconds} onChange={(e) => setForm({ ...form, maxSeconds: e.target.value })} />
          </fieldset>
          <CheckboxField checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}>
            Paying points
          </CheckboxField>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="ann__actions">
            <Button type="submit" disabled={busy}>Save</Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      )}

      {state.rules.length === 0 && !editing ? (
        <p className="text-secondary">No game rules yet. Add one for each game and mode once the game is registered.</p>
      ) : (
        <ul className="ann__list">
          {state.rules.map((r) => (
            <li key={`${r.gameId}:${r.mode}`}>
              <Card as="article" className="ann__item">
                <div className="ann__meta">
                  <span className="badge badge--medium">{r.gameId}</span>
                  {r.mode !== 'default' && <span className="badge">{r.modeLabel || r.mode}</span>}
                  {r.isDailyChallenge && <span className="badge badge--small">Daily challenge</span>}
                  {!r.active && <span className="badge badge--minor">Not paying</span>}
                </div>
                <h3>{r.title}</h3>
                <p className="text-secondary text-small">{describe(r)}</p>
                <div className="ann__actions">
                  <Button variant="secondary" disabled={busy} onClick={() => openForm(r)}>Edit</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

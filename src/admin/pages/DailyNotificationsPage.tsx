import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { deleteSchedule, getTimezone, kindLabels, listSchedules, saveSchedule, saveTimezone } from '../../features/push';
import type { Repeat, Schedule, ScheduleKind } from '../../features/push';
import { Button, Card, CheckboxField, EmptyState, Loading, SelectField, TextAreaField, TextField } from '../../shared/components';

const blank: Schedule = { id: '', kind: 'custom', title: '', body: '', link: '', sendTime: '12:00', repeat: 'daily', startDate: '', endDate: '', validMinutes: 30, enabled: true };
const repeatLabels: Record<Repeat, string> = { daily: 'Every day', weekdays: 'Monday to Friday', weekends: 'Saturday and Sunday' };

function zoneIsValid(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Daily notifications, owner only: what is sent to students' phones, and exactly when. */
export function DailyNotificationsPage() {
  const [list, setList] = useState<Schedule[] | null>(null);
  const [zone, setZone] = useState('Africa/Lagos');
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await listSchedules());
      setZone(await getTimezone().catch(() => 'Africa/Lagos'));
    } catch (err) {
      console.error('[admin] schedules', err);
      setError('Could not load the schedule. Make sure supabase/020_scheduled_notifications.sql has been run.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setError(null);
    if (editing.title.trim().length < 1) return setError('Add a title.');
    if (!/^\d{2}:\d{2}$/.test(editing.sendTime)) return setError('Choose a time.');
    if (!(editing.validMinutes >= 5 && editing.validMinutes <= 720)) return setError('"Valid for" must be between 5 and 720 minutes.');
    if (editing.link.trim() && !/^\/[a-z0-9/_-]*$/.test(editing.link.trim()) && !/^https:\/\//i.test(editing.link.trim())) {
      return setError('A link is either a screen like /games or a full address starting with https://');
    }
    if (editing.kind === 'prayer' && editing.enabled && !/^https:\/\//i.test(editing.link.trim())) return setError('The prayer reminder needs the school prayer link (https://...).');
    if (editing.kind !== 'weather' && editing.body.trim().length < 1) return setError('Add a message.');
    void run(() => saveSchedule(editing), 'Saved.');
  }

  if (editing) {
    const set = (patch: Partial<Schedule>) => setEditing({ ...editing, ...patch });
    return (
      <section aria-labelledby="dn-heading" className="ann">
        <h1 id="dn-heading">{editing.id ? 'Edit notification' : 'New notification'}</h1>
        <form className="ann__form" onSubmit={handleSave} noValidate>
          {!editing.id && (
            <SelectField label="What is it?" value={editing.kind} onChange={(e) => set({ kind: e.target.value as ScheduleKind })}>
              {(Object.keys(kindLabels) as ScheduleKind[]).map((k) => (
                <option key={k} value={k}>
                  {kindLabels[k]}
                </option>
              ))}
            </SelectField>
          )}
          <TextField label="Title" value={editing.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} />
          <TextAreaField
            label="Message"
            value={editing.body}
            onChange={(e) => set({ body: e.target.value })}
            maxLength={300}
            hint={editing.kind === 'weather' ? 'Leave empty. The weather report is written automatically for each student\'s own place, with advice (umbrella, light clothes).' : undefined}
          />
          <TextField
            label={editing.kind === 'prayer' ? 'Prayer link' : 'Opens (optional)'}
            value={editing.link}
            onChange={(e) => set({ link: e.target.value })}
            autoCapitalize="none"
            hint={editing.kind === 'prayer' ? 'The school website page for prayers (https://...). Tapping the notification opens it.' : 'A screen in the app like /games or /rewards, or a website starting with https://. Empty opens the app.'}
          />
          <TextField label="Time" type="time" value={editing.sendTime} onChange={(e) => set({ sendTime: e.target.value })} hint="In the time zone set at the top of the list." />
          <SelectField label="Repeat" value={editing.repeat} onChange={(e) => set({ repeat: e.target.value as Repeat })}>
            {(Object.keys(repeatLabels) as Repeat[]).map((r) => (
              <option key={r} value={r}>
                {repeatLabels[r]}
              </option>
            ))}
          </SelectField>
          <TextField label="Starts on (optional)" type="date" value={editing.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          <TextField label="Ends on (optional)" type="date" value={editing.endDate} onChange={(e) => set({ endDate: e.target.value })} />
          <TextField label="Valid for (minutes)" type="number" inputMode="numeric" min={5} max={720} value={String(editing.validMinutes)} onChange={(e) => set({ validMinutes: Number(e.target.value) })} hint="After this long it is no longer delivered, for example to a phone that was off. Also the time allowed to reach everyone, so keep it at 30 or more." />
          <CheckboxField checked={editing.enabled} onChange={(e) => set({ enabled: e.target.checked })}>
            Switched on
          </CheckboxField>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="ann__actions">
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section aria-labelledby="dn-heading" className="ann">
      <div className="ann__head">
        <div>
          <h1 id="dn-heading">Daily notifications</h1>
          <p className="text-secondary">What students get on their phones, and when. Students choose which kinds they want in Profile.</p>
        </div>
        <Button onClick={() => { setError(null); setEditing({ ...blank }); }}>New</Button>
      </div>

      <Card className="ann__item">
        <TextField label="Time zone" value={zone} onChange={(e) => setZone(e.target.value)} hint="Nigeria is Africa/Lagos. All times below use this." autoCapitalize="none" />
        <div className="ann__actions">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (!zoneIsValid(zone.trim())) return setError('That time zone is not recognised. Nigeria is Africa/Lagos.');
              void run(() => saveTimezone(zone), 'Time zone saved.');
            }}
          >
            Save time zone
          </Button>
        </div>
      </Card>

      {message && <p className="form-notice" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!list && !error && <Loading label="Loading" />}
      {list && list.length === 0 && <EmptyState title="Nothing scheduled">Add a notification and choose when it is sent.</EmptyState>}
      <ul className="ann__list">
        {(list ?? []).map((s) => (
          <li key={s.id}>
            <Card as="article" className="ann__item">
              <div className="ann__meta">
                <span className={s.enabled ? 'badge' : 'badge badge--minor'}>{s.enabled ? 'On' : 'Off'}</span>
                <span className="badge badge--minor">{kindLabels[s.kind]}</span>
              </div>
              <h2>{s.title}</h2>
              <p className="text-secondary text-small">
                {s.sendTime} · {repeatLabels[s.repeat]} · valid for {s.validMinutes} minutes
                {s.startDate ? ` · from ${s.startDate}` : ''}
                {s.endDate ? ` · until ${s.endDate}` : ''}
              </p>
              {s.kind === 'weather' && !s.body && <p className="text-secondary text-small">Message: written automatically for each student's place.</p>}
              <div className="ann__actions">
                <Button variant="secondary" disabled={busy} onClick={() => { setError(null); setEditing(s); }}>Edit</Button>
                <Button variant="secondary" disabled={busy} onClick={() => void run(() => saveSchedule({ ...s, enabled: !s.enabled }), s.enabled ? 'Switched off.' : 'Switched on.')}>
                  {s.enabled ? 'Switch off' : 'Switch on'}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm(`Delete "${s.title}"?`)) void run(() => deleteSchedule(s.id), 'Deleted.'); }}>
                  Delete
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

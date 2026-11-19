import { useCallback, useEffect, useId, useState } from 'react';
import { listPointSources, listStudentPoints, listStudentTrail, sourceLabel } from '../../features/points';
import type { PointsEntry, PointsSort, SourceTotal, StudentPoints } from '../../features/points';
import { Button, Card, EmptyState, Loading, Modal, SelectField, TextField } from '../../shared/components';

const PAGE = 25;
const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Where every Crumb Point comes from. Built from the transaction records, so a strange balance can be traced to the exact
 * entries that made it. Rows that earned a lot in the last 24 hours are flagged so cheating stands out.
 */
export function PointsAnalysisPage() {
  const [days, setDays] = useState('30');
  const [sources, setSources] = useState<SourceTotal[] | null>(null);
  const [students, setStudents] = useState<StudentPoints[] | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<PointsSort>('earned_24h');
  const [offset, setOffset] = useState(0);
  const [flagAt, setFlagAt] = useState('40');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<StudentPoints | null>(null);
  const [trail, setTrail] = useState<PointsEntry[] | null>(null);
  const titleId = useId();

  const loadSources = useCallback(async () => {
    try {
      setSources(await listPointSources(Number(days)));
    } catch (e) {
      setError(e instanceof Error ? `${e.message}. Has supabase/024 been run?` : 'Something went wrong.');
    }
  }, [days]);

  const loadStudents = useCallback(async () => {
    try {
      setStudents(await listStudentPoints(query, sort, offset, PAGE));
    } catch (e) {
      setError(e instanceof Error ? `${e.message}. Has supabase/024 been run?` : 'Something went wrong.');
    }
  }, [query, sort, offset]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);
  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  async function openStudent(student: StudentPoints) {
    setOpen(student);
    setTrail(null);
    try {
      setTrail(await listStudentTrail(student.userId));
    } catch {
      setTrail([]);
    }
  }

  const totalEarned = sources?.reduce((n, s) => n + s.earned, 0) ?? 0;
  const totalSpent = sources?.reduce((n, s) => n + s.spent, 0) ?? 0;
  const flag = Number(flagAt) > 0 ? Number(flagAt) : Infinity;

  return (
    <section aria-labelledby="pa-heading">
      <h1 id="pa-heading">Points analysis</h1>
      <p className="text-secondary">See where Crumb Points come from, who is earning a lot, and every transaction behind a balance. Only the nickname is shown.</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <h2>Where points come from and go</h2>
      <SelectField label="Period" value={days} onChange={(e) => setDays(e.target.value)}>
        <option value="1">Last 24 hours</option>
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
        <option value="365">Last year</option>
      </SelectField>
      {!sources ? (
        <Loading label="Loading" />
      ) : sources.length === 0 ? (
        <EmptyState title="No points activity yet">Nothing was earned or spent in this period.</EmptyState>
      ) : (
        <Card as="div">
          <p>
            <strong>{totalEarned.toLocaleString()}</strong> earned · <strong>{totalSpent.toLocaleString()}</strong> spent in this period
          </p>
          <ul className="activity-list">
            {sources.map((s) => (
              <li key={s.kind} className="activity-row">
                <span>{sourceLabel(s.kind)}</span>
                <span className="text-xs text-secondary">
                  {s.earned > 0 && `+${s.earned.toLocaleString()} `}
                  {s.spent > 0 && `−${s.spent.toLocaleString()} `}· {s.entries.toLocaleString()} entries · {s.students.toLocaleString()} students
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <h2>Students</h2>
      <TextField label="Find a nickname" value={search} onChange={(e) => setSearch(e.target.value)} />
      <Button
        variant="secondary"
        onClick={() => {
          setOffset(0);
          setQuery(search.trim());
        }}
      >
        Search
      </Button>
      <SelectField label="Sort by" value={sort} onChange={(e) => { setOffset(0); setSort(e.target.value as PointsSort); }}>
        <option value="earned_24h">Earned in the last 24 hours</option>
        <option value="balance">Current balance</option>
        <option value="earned">Earned in total</option>
        <option value="recent">Most recent activity</option>
      </SelectField>
      <TextField label="Flag anyone who earned at least this many points in 24 hours" type="number" inputMode="numeric" min={1} value={flagAt} onChange={(e) => setFlagAt(e.target.value)} hint="Flagged rows are marked so you can look at them first." />

      {!students ? (
        <Loading label="Loading students" />
      ) : students.length === 0 ? (
        <EmptyState title="No students found">Try a different nickname.</EmptyState>
      ) : (
        <ul className="activity-list">
          {students.map((s) => (
            <li key={s.userId} className="activity-row">
              <button type="button" className="link-button" onClick={() => void openStudent(s)}>
                {s.earned24h >= flag ? '⚠ ' : ''}
                {s.username}
              </button>
              <span className="text-xs text-secondary">
                Balance {s.balance.toLocaleString()} · earned {s.earned.toLocaleString()} · spent {s.spent.toLocaleString()} · last 24h +{s.earned24h.toLocaleString()}
                {s.lastActivity ? ` · last active ${when(s.lastActivity)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="game-result__actions">
        <Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
          Previous
        </Button>
        <Button variant="secondary" disabled={!students || students.length < PAGE} onClick={() => setOffset(offset + PAGE)}>
          Next
        </Button>
      </div>

      <Modal open={open !== null} onClose={() => setOpen(null)} labelledBy={titleId}>
        {open && (
          <div className="admin-menu">
            <h2 id={titleId}>{open.username}</h2>
            <p>
              Balance <strong>{open.balance.toLocaleString()}</strong> · earned {open.earned.toLocaleString()} · spent {open.spent.toLocaleString()}
            </p>
            {!trail ? (
              <Loading label="Loading transactions" />
            ) : trail.length === 0 ? (
              <p className="text-secondary">No transactions.</p>
            ) : (
              <ul className="activity-list">
                {trail.map((t, i) => (
                  <li key={`${t.createdAt}-${i}`} className="activity-row">
                    <span>
                      <strong>{t.amount > 0 ? `+${t.amount}` : t.amount}</strong> · {sourceLabel(t.kind)}
                    </span>
                    <span className="text-xs text-secondary">
                      {when(t.createdAt)}
                      {t.note ? ` · ${t.note}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Close
            </Button>
          </div>
        )}
      </Modal>
    </section>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/database';
import { Button, EmptyState, Loading, TextField } from '../../shared/components';
import type { StudentRow } from '../admin.types';
import { downloadFile, studentsToCsv, studentsToText, todayStamp } from '../export';

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function formatDate(iso: string | null): string {
  return iso ? dateFormat.format(new Date(iso)) : 'Never';
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rows: StudentRow[] };

/** Owner only. The database refuses this request for anyone else, even if the page were reached. */
export function StudentsPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    setState({ kind: 'loading' });
    try {
      const { data, error } = await client.rpc('admin_list_students');
      if (error) {
        console.error('[admin] students', error.message);
        setState({
          kind: 'error',
          message: error.message.includes('admin_list_students')
            ? 'The database update is missing. Run supabase/003_owner_and_students.sql in Supabase.'
            : error.message.includes('Owner only')
              ? 'Only the owner can see this page.'
              : `Could not load students: ${error.message}`,
        });
        return;
      }
      const rows: StudentRow[] = (data ?? []).map(
        (r: {
          id: string;
          username: string;
          full_name: string | null;
          email: string;
          phone: string | null;
          suspended: boolean | null;
          joined_at: string;
          last_sign_in_at: string | null;
          role: string;
        }) => ({
          id: r.id,
          username: r.username,
          fullName: r.full_name ?? '',
          email: r.email,
          phone: r.phone ?? '',
          suspended: Boolean(r.suspended),
          joinedAt: r.joined_at,
          lastSignInAt: r.last_sign_in_at,
          role: r.role,
        }),
      );
      setState({ kind: 'ready', rows });
    } catch (error) {
      console.error('[admin] students', error);
      setState({ kind: 'error', message: "Can't reach the database. Check your connection." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setSuspended(row: StudentRow, value: boolean) {
    const client = supabase;
    if (!client) return;
    setBusyId(row.id);
    setActionError(null);
    try {
      const { error } = await client.rpc('owner_set_suspended', { p_user: row.id, p_suspended: value });
      if (error) setActionError(error.message);
      else await load();
    } catch (error) {
      console.error('[admin] suspend', error);
      setActionError("Can't reach the database. Check your connection.");
    }
    setBusyId(null);
  }

  const rows = state.kind === 'ready' ? state.rows : [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => `${r.username} ${r.fullName} ${r.email} ${r.phone}`.toLowerCase().includes(needle));
  }, [rows, query]);

  if (state.kind === 'loading') return <Loading label="Loading students" />;

  if (state.kind === 'error') {
    return (
      <EmptyState title="We couldn't load the students" action={<Button onClick={() => void load()}>Try again</Button>}>
        {state.message}
      </EmptyState>
    );
  }

  return (
    <section aria-labelledby="students-heading" className="students">
      <div className="students__head">
        <div>
          <h1 id="students-heading">Students</h1>
          <p className="text-secondary">
            {rows.length} {rows.length === 1 ? 'account' : 'accounts'}
            {query.trim() && ` · ${filtered.length} shown`}
          </p>
        </div>
        <div className="students__actions">
          <Button
            variant="secondary"
            disabled={filtered.length === 0}
            onClick={() => downloadFile(`snacktic-students-${todayStamp()}.csv`, studentsToCsv(filtered), 'text/csv', true)}
          >
            Export CSV (Excel)
          </Button>
          <Button
            variant="secondary"
            disabled={filtered.length === 0}
            onClick={() =>
              downloadFile(`snacktic-student-emails-${todayStamp()}.txt`, studentsToText(filtered), 'text/plain')
            }
          >
            Export emails (text)
          </Button>
        </div>
      </div>

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      <TextField
        label="Search"
        type="search"
        placeholder="Name, nickname, email or number"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p className="students__none text-secondary">
          {rows.length === 0 ? 'Nobody has signed up yet.' : 'No one matches that search.'}
        </p>
      ) : (
        <ul className="student-list">
          {filtered.map((row) => (
            <li key={row.id} className="student-card">
              <p className="student-card__name">
                {row.username}
                {row.role !== 'student' && <span className="badge badge--small">{row.role}</span>}
                {row.suspended && <span className="badge badge--minor badge--small">Suspended</span>}
              </p>
              {row.fullName && <p>{row.fullName}</p>}
              <p className="student-card__email">{row.email}</p>
              {row.phone && <p className="student-card__email">WhatsApp {row.phone}</p>}
              <p className="student-card__meta">
                Joined {formatDate(row.joinedAt)} · Last sign-in {formatDate(row.lastSignInAt)}
              </p>
              {row.role === 'student' && (
                <div className="ann__actions">
                  {row.suspended ? (
                    <Button variant="secondary" disabled={busyId === row.id} onClick={() => void setSuspended(row, false)}>
                      Restore account
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      disabled={busyId === row.id}
                      onClick={() => {
                        if (window.confirm(`Suspend ${row.username}? They won't be able to earn, send or spend points.`)) void setSuspended(row, true);
                      }}
                    >
                      Suspend
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

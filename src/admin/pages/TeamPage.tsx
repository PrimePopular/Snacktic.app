import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../services/database';
import { Button, EmptyState, Loading, TextField } from '../../shared/components';
import type { StudentRow } from '../admin.types';

type LoadState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; team: StudentRow[] };

interface Row {
  id: string;
  username: string;
  full_name: string | null;
  email: string;
  joined_at: string;
  last_sign_in_at: string | null;
  role: string;
}

/** Owner only. Give or take away helper-admin access by email. The database enforces who may do this. */
export function TeamPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    setState({ kind: 'loading' });
    try {
      const { data, error } = await client.rpc('admin_list_students');
      if (error) {
        console.error('[admin] team', error.message);
        setState({ kind: 'error', message: 'Could not load the team. Make sure the latest database updates have been run.' });
        return;
      }
      const team = ((data ?? []) as Row[])
        .filter((r) => r.role !== 'student')
        .map((r) => ({
          id: r.id,
          username: r.username,
          fullName: r.full_name ?? '',
          email: r.email,
          phone: '',
          suspended: false,
          joinedAt: r.joined_at,
          lastSignInAt: r.last_sign_in_at,
          role: r.role,
        }));
      setState({ kind: 'ready', team });
    } catch (error) {
      console.error('[admin] team', error);
      setState({ kind: 'error', message: "Can't reach the database. Check your connection." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setRole(targetEmail: string, role: 'admin' | 'student') {
    const client = supabase;
    if (!client) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await client.rpc('owner_set_role', { p_email: targetEmail, p_role: role });
      if (error) {
        console.error('[admin] set role', error.message);
        setMessage({ kind: 'error', text: error.message });
      } else {
        setMessage({
          kind: 'ok',
          text: role === 'admin' ? `${data} is now a helper admin.` : `${data} no longer has admin access.`,
        });
        if (role === 'admin') setEmail('');
        await load();
      }
    } catch (error) {
      console.error('[admin] set role', error);
      setMessage({ kind: 'error', text: "Can't reach the database. Check your connection." });
    }
    setBusy(false);
  }

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setMessage({ kind: 'error', text: 'Enter a valid email address.' });
      return;
    }
    void setRole(email.trim(), 'admin');
  }

  return (
    <section aria-labelledby="team-heading" className="team">
      <div>
        <h1 id="team-heading">Team</h1>
        <p className="text-secondary">
          Helper admins can manage announcements and events. They cannot see students or change points.
        </p>
      </div>

      <form className="team__add" onSubmit={handleAdd} noValidate>
        <TextField
          label="Give admin access"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="They must already have a Snacktic account. Type the email they signed up with."
          autoComplete="off"
        />
        <Button type="submit" disabled={busy || !email.trim()}>
          Make admin
        </Button>
      </form>

      {message && (
        <p className={message.kind === 'ok' ? 'form-notice' : 'form-error'} role={message.kind === 'ok' ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}

      {state.kind === 'loading' && <Loading label="Loading team" />}
      {state.kind === 'error' && (
        <EmptyState title="We couldn't load the team" action={<Button onClick={() => void load()}>Try again</Button>}>
          {state.message}
        </EmptyState>
      )}
      {state.kind === 'ready' && (
        <ul className="team__list">
          {state.team.map((member) => (
            <li key={member.id} className="team__member">
              <div>
                <p className="team__name">
                  {member.username} <span className="badge badge--small">{member.role}</span>
                </p>
                <p className="text-secondary text-small">{member.email}</p>
              </div>
              {member.role === 'admin' && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Remove admin access for ${member.username}?`)) void setRole(member.email, 'student');
                  }}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

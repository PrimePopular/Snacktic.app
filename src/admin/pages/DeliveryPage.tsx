import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  adminAddLocation,
  adminDeleteLocation,
  adminDeleteRequest,
  adminListLocations,
  adminListRequests,
  adminSetLocationActive,
  adminSetRequestStatus,
} from '../../features/delivery';
import type { DeliveryLocation, DeliveryRequest } from '../../features/delivery';
import { Button, Card, Loading, TextField } from '../../shared/components';

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

/** Delivery places, owner only: where students can order to, and the places they have asked for. */
export function DeliveryPage() {
  const [locations, setLocations] = useState<DeliveryLocation[] | null>(null);
  const [requests, setRequests] = useState<DeliveryRequest[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLocations(await adminListLocations());
      setRequests(await adminListRequests().catch(() => []));
    } catch (err) {
      console.error('[admin] delivery', err);
      setError('Could not load delivery places. Make sure supabase/019_delivery_referrals_orders.sql has been run.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  function add(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) return setError('Type the name of the place.');
    void run(async () => {
      await adminAddLocation(name);
      setName('');
    });
  }

  if (!locations && !error) return <Loading label="Loading delivery places" />;

  return (
    <section aria-labelledby="dl-heading" className="ann">
      <h1 id="dl-heading">Delivery places</h1>
      <p className="text-secondary">
        Students can only order physical rewards for a place that is switched on here. The database checks this too, so it cannot be bypassed.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <ul className="ann__list">
        {(locations ?? []).map((l) => (
          <li key={l.id}>
            <Card as="article" className="ann__item">
              <div className="ann__meta">
                <span className={l.active ? 'badge' : 'badge badge--minor'}>{l.active ? 'On' : 'Off'}</span>
              </div>
              <h2>{l.name}</h2>
              <div className="ann__actions">
                <Button variant="secondary" disabled={busy} onClick={() => void run(() => adminSetLocationActive(l.id, !l.active))}>
                  {l.active ? 'Switch off' : 'Switch on'}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Remove "${l.name}"? Old orders keep their place.`)) void run(() => adminDeleteLocation(l.id));
                  }}
                >
                  Remove
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <form className="ann__form" onSubmit={add} noValidate>
        <TextField label="Add a delivery place" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} hint="For example the name of another school or area." />
        <div className="ann__actions">
          <Button type="submit" disabled={busy}>
            Add place
          </Button>
        </div>
      </form>

      <h2>Places students asked for</h2>
      {requests.length === 0 ? (
        <p className="text-secondary">No requests yet.</p>
      ) : (
        <ul className="ann__list">
          {requests.map((r) => (
            <li key={r.id}>
              <Card as="article" className="ann__item">
                <div className="ann__meta">
                  <span className={r.status === 'new' ? 'badge' : 'badge badge--minor'}>{r.status}</span>
                  <span className="text-secondary text-small">{dateFormat.format(new Date(r.createdAt))}</span>
                </div>
                <h3>{r.place}</h3>
                {r.note && <p className="text-secondary text-small">{r.note}</p>}
                <div className="ann__actions">
                  <Button variant="secondary" disabled={busy} onClick={() => void run(() => adminSetRequestStatus(r.id, 'added'))}>
                    Mark as added
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => void run(() => adminSetRequestStatus(r.id, 'declined'))}>
                    Decline
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={() => void run(() => adminDeleteRequest(r.id))}>
                    Delete
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { QrCode } from '../../features/find-a-friend/QrCode';
import { createTreasure, deleteTreasure, listFinders, listTreasure, setTreasureActive, treasureLink, updateTreasure } from '../../features/treasure';
import type { TreasureCode } from '../../features/treasure';
import { Button, Card, EmptyState, Loading, TextAreaField, TextField } from '../../shared/components';

const when = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** A printable card: the QR code, the code's name and how to use it. Printed one per card, ready to cut out and paste up. */
function PrintCard({ code, link }: { code: TreasureCode; link: string }) {
  return (
    <div className="treasure-print__card">
      <h2>Snacktic Treasure</h2>
      <QrCode value={link} label={`QR code for ${code.name}`} />
      <p>
        <strong>{code.name}</strong>
      </p>
      <p>Scan with your phone camera or in the Snacktic app to win Crumb Points. The first {code.maxScans} people to find it win!</p>
    </div>
  );
}

/**
 * Treasure Hunt (owner only). Make a code, choose the points and how many people can claim it, print the QR code and paste it
 * somewhere. When that many people have scanned it, it stops working. The numbers update as people find them.
 */
export function TreasureAdminPage() {
  const [codes, setCodes] = useState<TreasureCode[] | null>(null);
  const [editing, setEditing] = useState<'new' | TreasureCode | null>(null);
  const [name, setName] = useState('');
  const [hint, setHint] = useState('');
  const [points, setPoints] = useState('20');
  const [maxScans, setMaxScans] = useState('10');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [finders, setFinders] = useState<{ id: string; list: { username: string; foundAt: string; points: number }[] } | null>(null);
  const [printing, setPrinting] = useState<{ code: TreasureCode; link: string }[] | null>(null);

  const load = useCallback(async () => {
    try {
      setCodes(await listTreasure());
    } catch (e) {
      setCodes([]);
      setMessage({ ok: false, text: e instanceof Error ? `${e.message}. Has supabase/032 been run?` : 'Something went wrong.' });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  function openForm(code: TreasureCode | 'new') {
    setMessage(null);
    if (code === 'new') {
      setName('');
      setHint('');
      setPoints('20');
      setMaxScans('10');
    } else {
      setName(code.name);
      setHint(code.hint);
      setPoints(String(code.points));
      setMaxScans(String(code.maxScans));
    }
    setEditing(code);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const p = Number(points);
    const m = Number(maxScans);
    if (!name.trim()) return setMessage({ ok: false, text: 'Give the code a name, for example "Library door".' });
    if (!Number.isInteger(p) || p < 1 || p > 10000) return setMessage({ ok: false, text: 'Points must be a whole number from 1 to 10000.' });
    if (!Number.isInteger(m) || m < 1 || m > 100000) return setMessage({ ok: false, text: 'The limit must be a whole number from 1 to 100000.' });
    setBusy(true);
    setMessage(null);
    try {
      if (editing && editing !== 'new') await updateTreasure(editing.id, { name, hint, points: p, maxScans: m });
      else await createTreasure({ name, hint, points: p, maxScans: m });
      setEditing(null);
      await load();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' });
    }
    setBusy(false);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await load();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' });
    }
    setBusy(false);
  }

  async function print(list: TreasureCode[]) {
    const withLinks = await Promise.all(list.map(async (code) => ({ code, link: await treasureLink(code.token) })));
    setPrinting(withLinks);
    // Give the QR pictures a moment to draw before the print window opens.
    window.setTimeout(() => {
      window.print();
    }, 700);
  }

  if (printing) {
    return (
      <section className="treasure-print" aria-label="Printable treasure codes">
        <div className="treasure-print__bar">
          <Button onClick={() => window.print()}>Print</Button>
          <Button variant="secondary" onClick={() => setPrinting(null)}>
            Back
          </Button>
        </div>
        <div className="treasure-print__sheet">
          {printing.map(({ code, link }) => (
            <PrintCard key={code.id} code={code} link={link} />
          ))}
        </div>
      </section>
    );
  }

  if (editing) {
    return (
      <section aria-labelledby="th-heading" className="ann">
        <h1 id="th-heading">{editing === 'new' ? 'New treasure code' : 'Edit treasure code'}</h1>
        <form className="ann__form" onSubmit={(e) => void save(e)} noValidate>
          <TextField label="Name (only you see this)" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} hint='A label so you remember where you put it, for example "Library door".' />
          <TextAreaField label="Hint (optional)" value={hint} maxLength={200} onChange={(e) => setHint(e.target.value)} />
          <TextField label="Crumb Points it pays" type="number" inputMode="numeric" min={1} value={points} onChange={(e) => setPoints(e.target.value)} hint="You choose. Each person who finds it gets this many." />
          <TextField label="How many people can claim it" type="number" inputMode="numeric" min={1} value={maxScans} onChange={(e) => setMaxScans(e.target.value)} hint="After this many different people have scanned it, the code stops working and shows 'Too late'." />
          {message && (
            <p className={message.ok ? 'form-notice' : 'form-error'} role={message.ok ? 'status' : 'alert'}>
              {message.text}
            </p>
          )}
          <div className="ann__actions">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section aria-labelledby="th-heading" className="ann">
      <div className="ann__head">
        <div>
          <h1 id="th-heading">Treasure Hunt</h1>
          <p className="text-secondary">Make a code, choose the points and how many people can claim it, then print the QR code and paste it up. Once that many people have scanned it, it stops working.</p>
        </div>
        <Button onClick={() => openForm('new')}>New code</Button>
      </div>
      {message && (
        <p className={message.ok ? 'form-notice' : 'form-error'} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}
      {codes && codes.length > 0 && (
        <Button variant="secondary" onClick={() => void print(codes.filter((c) => c.active))}>
          Print all active codes
        </Button>
      )}
      {!codes ? (
        <Loading label="Loading codes" />
      ) : codes.length === 0 ? (
        <EmptyState title="No treasure codes yet" action={<Button onClick={() => openForm('new')}>Make the first one</Button>}>
          Each code becomes a QR code you print and hide around campus.
        </EmptyState>
      ) : (
        <ul className="ann__list">
          {codes.map((c) => {
            const full = c.scans >= c.maxScans;
            return (
              <li key={c.id}>
                <Card as="article" className="ann__item">
                  <div className="ann__meta">
                    <span className={full ? 'badge badge--minor' : c.active ? 'badge' : 'badge badge--minor'}>{full ? 'Fully claimed' : c.active ? 'Live' : 'Off'}</span>
                    <span className="text-xs text-secondary">
                      {c.points} points each · {c.scans} of {c.maxScans} claimed
                    </span>
                  </div>
                  <h2>{c.name}</h2>
                  {c.hint && <p className="text-secondary text-small">{c.hint}</p>}
                  <div className="ann__actions">
                    <Button variant="secondary" disabled={busy} onClick={() => void print([c])}>
                      Print QR
                    </Button>
                    <Button variant="secondary" disabled={busy} onClick={() => openForm(c)}>
                      Edit
                    </Button>
                    <Button variant="secondary" disabled={busy} onClick={() => void run(() => setTreasureActive(c.id, !c.active))}>
                      {c.active ? 'Turn off' : 'Turn on'}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          setFinders(finders?.id === c.id ? null : { id: c.id, list: await listFinders(c.id) });
                        })
                      }
                    >
                      Who found it
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm('Delete this code? Anyone who scans the printed QR will see "not recognised".')) void run(() => deleteTreasure(c.id));
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                  {finders?.id === c.id && (
                    <ul className="activity-list">
                      {finders.list.length === 0 ? (
                        <li className="text-secondary text-small">Nobody yet.</li>
                      ) : (
                        finders.list.map((f, i) => (
                          <li key={`${f.username}-${i}`} className="activity-row">
                            <span>{f.username}</span>
                            <span className="text-xs text-secondary">
                              {when.format(new Date(f.foundAt))} · +{f.points}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

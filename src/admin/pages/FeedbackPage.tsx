import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../features/authentication';
import {
  adminDeleteFeedback,
  adminListFeedback,
  adminSetFeedbackStatus,
  categoryLabels,
  getSupportContacts,
  saveSupportContacts,
  statusLabels,
} from '../../features/support';
import type { FeedbackItem, FeedbackStatus } from '../../features/support';
import { pictureUrl } from '../../services/pictures';
import { Button, Card, EmptyState, Loading, SelectField, TextField } from '../../shared/components';

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const STATUSES = Object.keys(statusLabels) as FeedbackStatus[];

/** Support contacts (owner only): what students see on the Support page. */
function ContactsCard() {
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getSupportContacts().then((c) => {
      setEmail(c.email);
      setWhatsapp(c.whatsapp);
    });
  }, []);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await saveSupportContacts({ email, whatsapp });
      setMessage('Saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  return (
    <Card className="ann__item">
      <h2>Support contacts</h2>
      <TextField label="Support email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField label="WhatsApp number" type="tel" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} hint="With the country code and no plus sign, for example 2349033000131." />
      {message && <p className="text-small" role="status">{message}</p>}
      <div className="ann__actions">
        <Button disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</Button>
      </div>
    </Card>
  );
}

/** Feedback: reports and ideas from students and visitors. Owner and helper admins. */
export function FeedbackPage() {
  const { profile } = useAuth();
  const owner = profile?.role === 'owner';
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [filter, setFilter] = useState<'all' | FeedbackStatus>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await adminListFeedback());
    } catch (err) {
      console.error('[admin] feedback', err);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(item: FeedbackItem, status: FeedbackStatus) {
    try {
      await adminSetFeedbackStatus(item.id, status);
      setItems((list) => list?.map((i) => (i.id === item.id ? { ...i, status } : i)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  async function remove(item: FeedbackItem) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    try {
      await adminDeleteFeedback(item);
      setItems((list) => list?.filter((i) => i.id !== item.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  const shown = (items ?? []).filter((i) => filter === 'all' || i.status === filter);

  return (
    <section aria-labelledby="fb-heading" className="ann">
      <h1 id="fb-heading">Feedback</h1>
      <p className="text-secondary">Bug reports, feature requests and ideas. You also get a message in the bell for each new one.</p>
      {owner && <ContactsCard />}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <SelectField label="Show" value={filter} onChange={(e) => setFilter(e.target.value as 'all' | FeedbackStatus)}>
        <option value="all">Everything</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {statusLabels[s]}
          </option>
        ))}
      </SelectField>
      {!items && !error && <Loading label="Loading feedback" />}
      {items && shown.length === 0 && (
        <EmptyState title="Nothing here">Reports and ideas from students will show up here.</EmptyState>
      )}
      <ul className="ann__list">
        {shown.map((item) => (
          <li key={item.id}>
            <Card as="article" className="ann__item">
              <div className="ann__meta">
                <span className="badge">{categoryLabels[item.category]}</span>
                <span className="badge badge--minor">{statusLabels[item.status]}</span>
                <span className="text-secondary text-small">
                  {item.from} · {dateFormat.format(new Date(item.createdAt))}
                </span>
              </div>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              {item.expected && <p className="text-small"><strong>Expected:</strong> {item.expected}</p>}
              {item.actual && <p className="text-small"><strong>Happened:</strong> {item.actual}</p>}
              {item.contact && <p className="text-small"><strong>Reply to:</strong> {item.contact}</p>}
              <p className="text-secondary text-xs">
                {item.device} · version {item.appVersion || 'unknown'}
                <br />
                {item.browser}
              </p>
              {item.screenshotPath && (
                <a href={pictureUrl(item.screenshotPath)} target="_blank" rel="noopener noreferrer">
                  <img className="picture-thumb" src={pictureUrl(item.screenshotPath)} alt="Screenshot sent with the report" loading="lazy" />
                </a>
              )}
              <SelectField label="Status" value={item.status} onChange={(e) => void setStatus(item, e.target.value as FeedbackStatus)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s]}
                  </option>
                ))}
              </SelectField>
              {owner && (
                <div className="ann__actions">
                  <Button variant="ghost" onClick={() => void remove(item)}>
                    Delete
                  </Button>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

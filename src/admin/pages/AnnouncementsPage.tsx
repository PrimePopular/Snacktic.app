import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  createAnnouncement,
  deleteAnnouncement,
  levelHelp,
  levelLabels,
  listAllAnnouncements,
  setAnnouncementPublished,
  updateAnnouncement,
} from '../../features/announcements';
import type { Announcement, AnnouncementLevel } from '../../features/announcements';
import { pictureUrl } from '../../services/pictures';
import { Button, Card, CheckboxField, EmptyState, Loading, SelectField, TextAreaField, TextField } from '../../shared/components';
import { PictureField } from '../components/PictureField';
import { usePictureEditor } from '../usePictureEditor';

type LoadState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; items: Announcement[] };

interface FormState {
  title: string;
  body: string;
  level: AnnouncementLevel;
  expires: string; // value for <input type="datetime-local">, or ''
  published: boolean;
}

const emptyForm: FormState = { title: '', body: '', level: 'medium', expires: '', published: true };

/** ISO timestamp -> value for a datetime-local input, in the browser's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const dateTimeFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Create, edit, hide and delete announcements. Open to the owner and helper admins. */
export function AnnouncementsPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [editing, setEditing] = useState<'new' | Announcement | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const picture = usePictureEditor();

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'ready', items: await listAllAnnouncements() });
    } catch (error) {
      console.error('[admin] announcements', error);
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startNew() {
    setForm(emptyForm);
    picture.reset(null);
    setTitleError(null);
    setMessage(null);
    setEditing('new');
  }

  function startEdit(item: Announcement) {
    setForm({
      title: item.title,
      body: item.body,
      level: item.level,
      expires: toLocalInput(item.expiresAt),
      published: item.published,
    });
    picture.reset(item.imagePath);
    setTitleError(null);
    setMessage(null);
    setEditing(item);
  }

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setEditing(null);
      await load();
      setMessage(success);
    } catch (error) {
      console.error('[admin] announcements', error);
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    const title = form.title.trim();
    if (title.length < 1 || title.length > 120) {
      setTitleError('Enter a title (up to 120 characters).');
      return;
    }
    setTitleError(null);
    const input = {
      title,
      body: form.body,
      level: form.level,
      imagePath: picture.imagePath,
      published: form.published,
      expiresAt: form.expires ? new Date(form.expires).toISOString() : null,
    };
    if (editing === 'new') {
      void run(async () => {
        await createAnnouncement(input);
        await picture.commit();
      }, 'Published.');
    } else if (editing) {
      const id = editing.id;
      void run(async () => {
        await updateAnnouncement(id, input);
        await picture.commit();
      }, 'Updated.');
    }
  }

  if (editing) {
    return (
      <section aria-labelledby="ann-heading" className="ann">
        <h1 id="ann-heading">{editing === 'new' ? 'New news item' : 'Edit news item'}</h1>
        <form className="ann__form" onSubmit={handleSave} noValidate>
          <TextField
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            error={titleError}
            maxLength={120}
          />
          <TextAreaField
            label="Message"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            hint="Optional. Keep it short."
          />
          <SelectField
            label="Level"
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value as AnnouncementLevel })}
            hint={levelHelp[form.level]}
          >
            {(Object.keys(levelLabels) as AnnouncementLevel[]).map((level) => (
              <option key={level} value={level}>
                {levelLabels[level]}
              </option>
            ))}
          </SelectField>
          <PictureField imagePath={picture.imagePath} uploading={picture.uploading} error={picture.error} onPick={(file) => void picture.pick(file)} onRemove={() => void picture.remove()} />
          <TextField
            label="Disappears on"
            type="datetime-local"
            value={form.expires}
            onChange={(e) => setForm({ ...form, expires: e.target.value })}
            hint="Optional. Leave empty to keep it up until you hide or delete it."
          />
          <CheckboxField checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })}>
            Visible in the app
          </CheckboxField>
          {message && (
            <p className="form-error" role="alert">
              {message}
            </p>
          )}
          <div className="ann__actions">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                void picture.discard();
                setEditing(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section aria-labelledby="ann-heading" className="ann">
      <div className="ann__head">
        <div>
          <h1 id="ann-heading">News &amp; announcements</h1>
          <p className="text-secondary">This is the News tab students see in Discover. Major items also show as a slim bar at the top of Home.</p>
        </div>
        <Button onClick={startNew}>New news item</Button>
      </div>

      {message && (
        <p className="form-notice" role="status">
          {message}
        </p>
      )}

      {state.kind === 'loading' && <Loading label="Loading announcements" />}
      {state.kind === 'error' && (
        <EmptyState title="We couldn't load announcements" action={<Button onClick={() => void load()}>Try again</Button>}>
          {state.message}
        </EmptyState>
      )}
      {state.kind === 'ready' && state.items.length === 0 && (
        <EmptyState title="No news yet" action={<Button onClick={startNew}>Write the first one</Button>}>
          What you publish here shows up in the News tab of Discover.
        </EmptyState>
      )}
      {state.kind === 'ready' && state.items.length > 0 && (
        <ul className="ann__list">
          {state.items.map((item) => {
            const expired = item.expiresAt ? Date.parse(item.expiresAt) <= Date.now() : false;
            return (
              <li key={item.id}>
                <Card as="article" className="ann__item">
                  <div className="ann__meta">
                    <span className={`badge ${item.level === 'major' ? '' : `badge--${item.level}`}`.trim()}>
                      {levelLabels[item.level]}
                    </span>
                    {!item.published && <span className="badge badge--minor">Hidden</span>}
                    {expired && <span className="badge badge--minor">Expired</span>}
                    {item.expiresAt && !expired && (
                      <span className="text-xs text-secondary">Until {dateTimeFormat.format(new Date(item.expiresAt))}</span>
                    )}
                  </div>
                  {item.imagePath && <img className="picture-thumb" src={pictureUrl(item.imagePath)} alt="" loading="lazy" />}
                  <h2>{item.title}</h2>
                  {item.body && <p className="text-secondary">{item.body}</p>}
                  <div className="ann__actions">
                    <Button variant="secondary" disabled={busy} onClick={() => startEdit(item)}>
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void run(() => setAnnouncementPublished(item.id, !item.published), item.published ? 'Hidden.' : 'Visible again.')}
                    >
                      {item.published ? 'Hide' : 'Show'}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete "${item.title}"? This cannot be undone.`)) {
                          void run(() => deleteAnnouncement(item), 'Deleted.');
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

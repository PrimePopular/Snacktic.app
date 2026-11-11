import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  createCategory,
  createEvent,
  deleteEvent,
  listAllEvents,
  listCategories,
  setEventPublished,
  updateEvent,
} from '../../features/events';
import type { EventCategory, EventItem } from '../../features/events';
import { pictureUrl } from '../../services/pictures';
import { Button, Card, CheckboxField, EmptyState, Loading, TextAreaField, TextField } from '../../shared/components';
import { safeLink } from '../../shared/url';
import { CategoryPicker } from '../components/CategoryPicker';
import { PictureField } from '../components/PictureField';
import { usePictureEditor } from '../usePictureEditor';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; events: EventItem[]; categories: EventCategory[] };

interface FormState {
  name: string;
  description: string;
  categoryId: string; // '' or a category number
  starts: string; // datetime-local value
  ends: string;
  locationText: string;
  contactName: string;
  contactPhone: string;
  contactLink: string;
  published: boolean;
}

const emptyForm: FormState = {
  name: '',
  description: '',
  categoryId: '',
  starts: '',
  ends: '',
  locationText: '',
  contactName: '',
  contactPhone: '',
  contactLink: '',
  published: true,
};

type Errors = { name?: string; starts?: string; ends?: string; contactPhone?: string; contactLink?: string };

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const whenFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Create, edit, hide and delete events: picture, category number and who to contact. Owner and helper admins. */
export function EventsPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [editing, setEditing] = useState<'new' | EventItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const picture = usePictureEditor();

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const [events, categories] = await Promise.all([listAllEvents(), listCategories('event')]);
      setState({ kind: 'ready', events, categories });
    } catch (error) {
      console.error('[admin] events', error);
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openForm(target: 'new' | EventItem) {
    setErrors({});
    setMessage(null);
    if (target === 'new') {
      setForm(emptyForm);
      picture.reset(null);
    } else {
      setForm({
        name: target.name,
        description: target.description,
        categoryId: target.categoryId === null ? '' : String(target.categoryId),
        starts: toLocalInput(target.startsAt),
        ends: toLocalInput(target.expiresAt),
        locationText: target.locationText,
        contactName: target.contactName,
        contactPhone: target.contactPhone,
        contactLink: target.contactLink,
        published: target.published,
      });
      picture.reset(target.imagePath);
    }
    setEditing(target);
  }

  async function closeForm() {
    await picture.discard();
    setEditing(null);
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
      console.error('[admin] events', error);
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  async function addCategory(name: string) {
    await createCategory(name, 'event');
    const categories = await listCategories('event');
    setState((current) => (current.kind === 'ready' ? { ...current, categories } : current));
    const created = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (created) setForm((f) => ({ ...f, categoryId: String(created.id) }));
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    const name = form.name.trim();
    if (name.length < 1 || name.length > 120) next.name = 'Enter a name (up to 120 characters).';
    if (!form.starts) next.starts = 'Choose when it starts.';
    if (!form.ends) next.ends = 'Choose when it ends. It disappears from the app after this.';
    if (form.starts && form.ends && new Date(form.ends) <= new Date(form.starts)) next.ends = 'The end must be after the start.';
    if (form.contactLink.trim() && !safeLink(form.contactLink)) next.contactLink = 'Enter a full link that starts with https://';
    if (!/^[0-9+()\-\s]{0,25}$/.test(form.contactPhone)) next.contactPhone = 'Use numbers only (spaces, + and brackets are fine).';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input = {
      name,
      description: form.description,
      categoryId: form.categoryId === '' ? null : Number(form.categoryId),
      startsAt: new Date(form.starts).toISOString(),
      expiresAt: new Date(form.ends).toISOString(),
      locationText: form.locationText,
      imagePath: picture.imagePath,
      contactName: form.contactName,
      contactPhone: form.contactPhone,
      contactLink: form.contactLink,
      published: form.published,
    };

    const saving = editing;
    void run(async () => {
      if (saving === 'new') await createEvent(input);
      else if (saving) await updateEvent(saving.id, input);
      await picture.commit();
    }, saving === 'new' ? 'Event published.' : 'Event updated.');
  }

  if (editing) {
    const categories = state.kind === 'ready' ? state.categories : [];

    return (
      <section aria-labelledby="events-heading" className="ann">
        <h1 id="events-heading">{editing === 'new' ? 'New event' : 'Edit event'}</h1>
        <form className="ann__form" onSubmit={handleSave} noValidate>
          <TextField label="Event name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} maxLength={120} />
          <TextAreaField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} hint="Optional. What should people know?" />
          <CategoryPicker label="Category" categories={categories} value={form.categoryId} onChange={(v) => setForm({ ...form, categoryId: v })} onAdd={addCategory} />
          <TextField label="Starts" type="datetime-local" value={form.starts} onChange={(e) => setForm({ ...form, starts: e.target.value })} error={errors.starts} />
          <TextField label="Ends (disappears after this)" type="datetime-local" value={form.ends} onChange={(e) => setForm({ ...form, ends: e.target.value })} error={errors.ends} />
          <TextField label="Where" value={form.locationText} onChange={(e) => setForm({ ...form, locationText: e.target.value })} hint="Optional. For example: Student corner kiosk." />

          <fieldset className="form-group">
            <legend>Who to contact (optional)</legend>
            <p className="field__hint">Students see these as buttons they can tap for more information.</p>
            <TextField label="Contact name" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} maxLength={60} hint="For example: Chidi, event organiser." />
            <TextField
              label="Message link"
              type="url"
              inputMode="url"
              value={form.contactLink}
              onChange={(e) => setForm({ ...form, contactLink: e.target.value })}
              error={errors.contactLink}
              hint="A WhatsApp link or any web link. WhatsApp links look like https://wa.me/ followed by the number with country code, no plus or spaces."
            />
            <TextField label="Phone number" type="tel" inputMode="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} error={errors.contactPhone} hint="Students can tap it to call." maxLength={25} />
          </fieldset>

          <PictureField imagePath={picture.imagePath} uploading={picture.uploading} error={picture.error} onPick={(file) => void picture.pick(file)} onRemove={() => void picture.remove()} />

          <CheckboxField checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })}>
            Visible in the app
          </CheckboxField>

          {message && (
            <p className="form-error" role="alert">
              {message}
            </p>
          )}
          <div className="ann__actions">
            <Button type="submit" disabled={busy || picture.uploading}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void closeForm()}>
              Cancel
            </Button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section aria-labelledby="events-heading" className="ann">
      <div className="ann__head">
        <div>
          <h1 id="events-heading">Events</h1>
          <p className="text-secondary">Events appear in Discover and on Home until their end time.</p>
        </div>
        <Button onClick={() => openForm('new')}>New event</Button>
      </div>

      {message && (
        <p className="form-notice" role="status">
          {message}
        </p>
      )}

      {state.kind === 'loading' && <Loading label="Loading events" />}
      {state.kind === 'error' && (
        <EmptyState title="We couldn't load events" action={<Button onClick={() => void load()}>Try again</Button>}>
          {state.message}
        </EmptyState>
      )}
      {state.kind === 'ready' && state.events.length === 0 && (
        <EmptyState title="No events yet" action={<Button onClick={() => openForm('new')}>Add the first event</Button>}>
          Events you add here show up in students' Discover tab and Home feed.
        </EmptyState>
      )}
      {state.kind === 'ready' && state.events.length > 0 && (
        <ul className="ann__list">
          {state.events.map((item) => {
            const ended = Date.parse(item.expiresAt) <= Date.now();
            const category = state.categories.find((c) => c.id === item.categoryId);
            return (
              <li key={item.id}>
                <Card as="article" className="ann__item">
                  <div className="ann__meta">
                    {category && <span className="badge">{category.name}</span>}
                    {!item.published && <span className="badge badge--minor">Hidden</span>}
                    {ended && <span className="badge badge--minor">Ended</span>}
                    <span className="text-xs text-secondary">{whenFormat.format(new Date(item.startsAt))}</span>
                  </div>
                  {item.imagePath && <img className="picture-thumb" src={pictureUrl(item.imagePath)} alt="" loading="lazy" />}
                  <h2>{item.name}</h2>
                  {item.locationText && <p className="text-secondary text-small">{item.locationText}</p>}
                  <div className="ann__actions">
                    <Button variant="secondary" disabled={busy} onClick={() => openForm(item)}>Edit</Button>
                    <Button variant="secondary" disabled={busy} onClick={() => void run(() => setEventPublished(item.id, !item.published), item.published ? 'Hidden.' : 'Visible again.')}>
                      {item.published ? 'Hide' : 'Show'}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete "${item.name}"? This cannot be undone.`)) void run(() => deleteEvent(item), 'Deleted.');
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

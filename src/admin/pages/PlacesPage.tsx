import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createCategory, listCategories } from '../../features/events';
import type { EventCategory } from '../../features/events';
import { createPlace, deletePlace, listAllPlaces, setPlacePublished, updatePlace } from '../../features/places';
import type { Place } from '../../features/places';
import { pictureUrl } from '../../services/pictures';
import { Button, Card, CheckboxField, EmptyState, Loading, TextAreaField, TextField } from '../../shared/components';
import { safeLink } from '../../shared/url';
import { CategoryPicker } from '../components/CategoryPicker';
import { PictureField } from '../components/PictureField';
import { usePictureEditor } from '../usePictureEditor';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; places: Place[]; categories: EventCategory[] };

interface FormState {
  name: string;
  description: string;
  categoryId: string;
  address: string;
  link: string;
  phone: string;
  latitude: string;
  longitude: string;
  published: boolean;
}

const emptyForm: FormState = { name: '', description: '', categoryId: '', address: '', link: '', phone: '', latitude: '', longitude: '', published: true };
type Errors = { name?: string; link?: string; phone?: string; position?: string };

/** Places to try: food spots, hangouts, trips. Owner and helper admins. */
export function PlacesPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [editing, setEditing] = useState<'new' | Place | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const picture = usePictureEditor();

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const [places, categories] = await Promise.all([listAllPlaces(), listCategories('place')]);
      setState({ kind: 'ready', places, categories });
    } catch (error) {
      console.error('[admin] places', error);
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openForm(target: 'new' | Place) {
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
        address: target.address,
        link: target.link,
        phone: target.phone,
        latitude: target.latitude === null ? '' : String(target.latitude),
        longitude: target.longitude === null ? '' : String(target.longitude),
        published: target.published,
      });
      picture.reset(target.imagePath);
    }
    setEditing(target);
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
      console.error('[admin] places', error);
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  async function addCategory(name: string) {
    await createCategory(name, 'place');
    const categories = await listCategories('place');
    setState((current) => (current.kind === 'ready' ? { ...current, categories } : current));
    const created = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (created) setForm((f) => ({ ...f, categoryId: String(created.id) }));
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setErrors((e) => ({ ...e, position: 'This browser cannot find your location.' }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((f) => ({ ...f, latitude: position.coords.latitude.toFixed(6), longitude: position.coords.longitude.toFixed(6) }));
        setErrors((e) => ({ ...e, position: undefined }));
      },
      () => setErrors((e) => ({ ...e, position: 'Could not get your location. Allow location access, or type the numbers.' })),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    const name = form.name.trim();
    if (name.length < 1 || name.length > 120) next.name = 'Enter a name (up to 120 characters).';
    if (form.link.trim() && !safeLink(form.link)) next.link = 'Enter a full link that starts with https://';
    if (!/^[0-9+()\-\s]{0,25}$/.test(form.phone)) next.phone = 'Use numbers only (spaces, + and brackets are fine).';
    const hasLat = form.latitude.trim() !== '';
    const hasLon = form.longitude.trim() !== '';
    const lat = Number(form.latitude);
    const lon = Number(form.longitude);
    if (hasLat !== hasLon) next.position = 'Enter both the latitude and the longitude, or leave both empty.';
    else if (hasLat && (!(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180))) next.position = 'Latitude is between -90 and 90, longitude between -180 and 180.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input = {
      name,
      description: form.description,
      categoryId: form.categoryId === '' ? null : Number(form.categoryId),
      address: form.address,
      imagePath: picture.imagePath,
      link: form.link,
      phone: form.phone,
      latitude: hasLat ? lat : null,
      longitude: hasLon ? lon : null,
      published: form.published,
    };
    const saving = editing;
    void run(async () => {
      if (saving === 'new') await createPlace(input);
      else if (saving) await updatePlace(saving.id, input);
      await picture.commit();
    }, saving === 'new' ? 'Place added.' : 'Place updated.');
  }

  if (editing) {
    const categories = state.kind === 'ready' ? state.categories : [];
    return (
      <section aria-labelledby="places-heading" className="ann">
        <h1 id="places-heading">{editing === 'new' ? 'New place' : 'Edit place'}</h1>
        <form className="ann__form" onSubmit={handleSave} noValidate>
          <TextField label="Place name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} maxLength={120} />
          <TextAreaField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} hint="Optional. Why should students go?" />
          <CategoryPicker label="Category" categories={categories} value={form.categoryId} onChange={(v) => setForm({ ...form, categoryId: v })} onAdd={addCategory} />
          <TextField label="Where" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} hint="Optional. An address or a description of how to find it." />
          <fieldset className="form-group">
            <legend>Links and contact (optional)</legend>
            <TextField label="Link" type="url" inputMode="url" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} error={errors.link} hint="A Google Maps link, website or WhatsApp link." />
            <TextField label="Phone number" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} maxLength={25} />
          </fieldset>
          <fieldset className="form-group">
            <legend>Map position (optional)</legend>
            <p className="field__hint">Shows a map on the place's page. Standing at the place? Tap the button. Otherwise, in Google Maps press and hold on the spot and copy the two numbers shown.</p>
            <div className="ann__actions">
              <Button variant="secondary" onClick={useMyLocation}>Use my current location</Button>
            </div>
            <TextField label="Latitude" type="number" inputMode="decimal" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            <TextField label="Longitude" type="number" inputMode="decimal" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} error={errors.position} />
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
    <section aria-labelledby="places-heading" className="ann">
      <div className="ann__head">
        <div>
          <h1 id="places-heading">Places</h1>
          <p className="text-secondary">Things to try: food spots, hangouts, trips. They appear in Discover and in the Home feed.</p>
        </div>
        <Button onClick={() => openForm('new')}>New place</Button>
      </div>

      {message && (
        <p className="form-notice" role="status">
          {message}
        </p>
      )}

      {state.kind === 'loading' && <Loading label="Loading places" />}
      {state.kind === 'error' && (
        <EmptyState title="We couldn't load places" action={<Button onClick={() => void load()}>Try again</Button>}>
          {state.message}. Make sure supabase/007_places.sql has been run.
        </EmptyState>
      )}
      {state.kind === 'ready' && state.places.length === 0 && (
        <EmptyState title="No places yet" action={<Button onClick={() => openForm('new')}>Add the first place</Button>}>
          Add spots students would love to discover.
        </EmptyState>
      )}
      {state.kind === 'ready' && state.places.length > 0 && (
        <ul className="ann__list">
          {state.places.map((item) => {
            const category = state.categories.find((c) => c.id === item.categoryId);
            return (
              <li key={item.id}>
                <Card as="article" className="ann__item">
                  <div className="ann__meta">
                    {category && <span className="badge">{category.name}</span>}
                    {!item.published && <span className="badge badge--minor">Hidden</span>}
                  </div>
                  {item.imagePath && <img className="picture-thumb" src={pictureUrl(item.imagePath)} alt="" loading="lazy" />}
                  <h2>{item.name}</h2>
                  {item.address && <p className="text-secondary text-small">{item.address}</p>}
                  <div className="ann__actions">
                    <Button variant="secondary" disabled={busy} onClick={() => openForm(item)}>Edit</Button>
                    <Button variant="secondary" disabled={busy} onClick={() => void run(() => setPlacePublished(item.id, !item.published), item.published ? 'Hidden.' : 'Visible again.')}>
                      {item.published ? 'Hide' : 'Show'}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete "${item.name}"? This cannot be undone.`)) void run(() => deletePlace(item), 'Deleted.');
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

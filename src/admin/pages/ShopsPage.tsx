import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  createShop,
  createShopProduct,
  deleteShop,
  deleteShopProduct,
  listAllShops,
  setShopPublished,
  updateShop,
  updateShopProduct,
} from '../../features/shops';
import type { Shop, ShopProduct } from '../../features/shops';
import { pictureUrl } from '../../services/pictures';
import { Button, Card, CheckboxField, EmptyState, Loading, TextAreaField, TextField } from '../../shared/components';
import { PictureField } from '../components/PictureField';
import { usePictureEditor } from '../usePictureEditor';

type LoadState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; shops: Shop[] };

interface FormState {
  name: string;
  description: string;
  address: string;
  openingHours: string;
  phone: string;
  latitude: string;
  longitude: string;
  published: boolean;
}

const emptyForm: FormState = { name: '', description: '', address: '', openingHours: '', phone: '', latitude: '', longitude: '', published: true };
type Errors = { name?: string; phone?: string; position?: string };

interface ProductsEditorProps {
  shop: Shop;
  onChanged: () => Promise<void>;
}

/** The partner products one shop carries: add, edit, hide and delete. */
function ProductsEditor({ shop, onChanged }: ProductsEditorProps) {
  const [editing, setEditing] = useState<'new' | ShopProduct | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [published, setPublished] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const picture = usePictureEditor();

  function open(target: 'new' | ShopProduct) {
    setError(null);
    if (target === 'new') {
      setName('');
      setDescription('');
      setPublished(true);
      picture.reset(null);
    } else {
      setName(target.name);
      setDescription(target.description);
      setPublished(target.published);
      picture.reset(target.imagePath);
    }
    setEditing(target);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setEditing(null);
      await onChanged();
    } catch (err) {
      console.error('[admin] shop products', err);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 1 || name.trim().length > 120) return setError('Enter a product name (up to 120 characters).');
    const input = { name, description, imagePath: picture.imagePath, published };
    const saving = editing;
    void run(async () => {
      if (saving === 'new') await createShopProduct(shop.id, input);
      else if (saving) await updateShopProduct(saving.id, input);
      await picture.commit();
    });
  }

  if (editing) {
    return (
      <form className="ann__form" onSubmit={save} noValidate>
        <h3>{editing === 'new' ? 'New product' : 'Edit product'}</h3>
        <TextField label="Product name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <TextAreaField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} hint="Optional." />
        <PictureField imagePath={picture.imagePath} uploading={picture.uploading} error={picture.error} onPick={(file) => void picture.pick(file)} onRemove={() => void picture.remove()} />
        <CheckboxField checked={published} onChange={(e) => setPublished(e.target.checked)}>
          Visible in the app
        </CheckboxField>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="ann__actions">
          <Button type="submit" disabled={busy || picture.uploading}>
            {busy ? 'Saving…' : 'Save product'}
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
    );
  }

  return (
    <div>
      <h3>Products at this shop</h3>
      {shop.products.length === 0 && <p className="text-secondary text-small">None yet. Add the products people pay to have shown here.</p>}
      <ul className="ann__list">
        {shop.products.map((p) => (
          <li key={p.id}>
            <div className="ann__meta">
              <strong>{p.name}</strong>
              {!p.published && <span className="badge badge--minor">Hidden</span>}
            </div>
            {p.imagePath && <img className="picture-thumb" src={pictureUrl(p.imagePath)} alt="" loading="lazy" />}
            <div className="ann__actions">
              <Button variant="secondary" disabled={busy} onClick={() => open(p)}>Edit</Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Delete "${p.name}"?`)) void run(() => deleteShopProduct(p));
                }}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button variant="secondary" onClick={() => open('new')}>Add a product</Button>
    </div>
  );
}

/** Shops around campus and the partner products they carry. Owner and helper admins. */
export function ShopsPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [editing, setEditing] = useState<'new' | Shop | null>(null);
  const [openProducts, setOpenProducts] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const picture = usePictureEditor();

  const load = useCallback(async () => {
    try {
      setState({ kind: 'ready', shops: await listAllShops() });
    } catch (error) {
      console.error('[admin] shops', error);
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openForm(target: 'new' | Shop) {
    setErrors({});
    setMessage(null);
    if (target === 'new') {
      setForm(emptyForm);
      picture.reset(null);
    } else {
      setForm({
        name: target.name,
        description: target.description,
        address: target.address,
        openingHours: target.openingHours,
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
      console.error('[admin] shops', error);
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    }
    setBusy(false);
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
      imagePath: picture.imagePath,
      address: form.address,
      latitude: hasLat ? lat : null,
      longitude: hasLon ? lon : null,
      phone: form.phone,
      openingHours: form.openingHours,
      published: form.published,
    };
    const saving = editing;
    void run(async () => {
      if (saving === 'new') await createShop(input);
      else if (saving) await updateShop(saving.id, input);
      await picture.commit();
    }, saving === 'new' ? 'Shop added. You can now add its products.' : 'Shop updated.');
  }

  if (editing) {
    return (
      <section aria-labelledby="shops-heading" className="ann">
        <h1 id="shops-heading">{editing === 'new' ? 'New shop' : 'Edit shop'}</h1>
        <form className="ann__form" onSubmit={handleSave} noValidate>
          <TextField label="Shop name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} maxLength={120} />
          <TextAreaField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} hint="Optional." />
          <TextField label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} hint="Optional. Students tap it to open the shop in Google Maps, so a clear address or name works best." />
          <TextField label="Opening hours" value={form.openingHours} onChange={(e) => setForm({ ...form, openingHours: e.target.value })} maxLength={200} hint="Optional. For example: Mon to Sat, 8am to 8pm." />
          <TextField label="Phone or WhatsApp number" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} maxLength={25} hint="Optional." />
          <fieldset className="form-group">
            <legend>Exact position (optional)</legend>
            <p className="field__hint">Makes the Google Maps button exact and lets students sort shops by distance. Standing at the shop? Tap the button. Otherwise, in Google Maps press and hold on the spot and copy the two numbers shown.</p>
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
    <section aria-labelledby="shops-heading" className="ann">
      <div className="ann__head">
        <div>
          <h1 id="shops-heading">Shops</h1>
          <p className="text-secondary">Shops around campus. Add the partner products a shop carries and they show on its page in Discover.</p>
        </div>
        <Button onClick={() => openForm('new')}>New shop</Button>
      </div>

      {message && (
        <p className="form-notice" role="status">
          {message}
        </p>
      )}

      {state.kind === 'loading' && <Loading label="Loading shops" />}
      {state.kind === 'error' && (
        <EmptyState title="We couldn't load shops" action={<Button onClick={() => void load()}>Try again</Button>}>
          {state.message}. Make sure supabase/011_shops_and_ads.sql has been run.
        </EmptyState>
      )}
      {state.kind === 'ready' && state.shops.length === 0 && (
        <EmptyState title="No shops yet" action={<Button onClick={() => openForm('new')}>Add the first shop</Button>}>
          Add the shops students can find around campus.
        </EmptyState>
      )}
      {state.kind === 'ready' && state.shops.length > 0 && (
        <ul className="ann__list">
          {state.shops.map((item) => (
            <li key={item.id}>
              <Card as="article" className="ann__item">
                <div className="ann__meta">
                  {!item.published && <span className="badge badge--minor">Hidden</span>}
                  <span className="text-secondary text-small">{item.products.length} products</span>
                </div>
                {item.imagePath && <img className="picture-thumb" src={pictureUrl(item.imagePath)} alt="" loading="lazy" />}
                <h2>{item.name}</h2>
                {item.address && <p className="text-secondary text-small">{item.address}</p>}
                <div className="ann__actions">
                  <Button variant="secondary" disabled={busy} onClick={() => openForm(item)}>Edit</Button>
                  <Button variant="secondary" disabled={busy} onClick={() => setOpenProducts(openProducts === item.id ? null : item.id)}>
                    {openProducts === item.id ? 'Hide products' : 'Products'}
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => void run(() => setShopPublished(item.id, !item.published), item.published ? 'Hidden.' : 'Visible again.')}>
                    {item.published ? 'Hide' : 'Show'}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Delete "${item.name}" and its products? This cannot be undone.`)) void run(() => deleteShop(item), 'Deleted.');
                    }}
                  >
                    Delete
                  </Button>
                </div>
                {openProducts === item.id && <ProductsEditor shop={item} onChanged={load} />}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

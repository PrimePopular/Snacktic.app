import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createAd, deleteAd, listAllAds, ownerAdViewers, setAdPublished, updateAd } from '../../features/ads';
import type { Ad } from '../../features/ads';
import { pictureUrl } from '../../services/pictures';
import { Button, Card, CheckboxField, EmptyState, Loading, TextAreaField, TextField } from '../../shared/components';
import { safeLink } from '../../shared/url';
import { PictureField } from '../components/PictureField';
import { usePictureEditor } from '../usePictureEditor';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; ads: Ad[]; viewers: Record<string, number> };

interface FormState {
  advertiser: string;
  title: string;
  body: string;
  link: string;
  points: string;
  endDate: string;
  published: boolean;
}

const emptyForm: FormState = { advertiser: '', title: '', body: '', link: '', points: '1', endDate: '', published: true };
type Errors = { title?: string; link?: string; points?: string };

/** yyyy-mm-dd of a stored time, in the admin's own time zone. */
function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** An ad runs until the end of its last day. */
function fromDateInput(value: string): string | null {
  return value ? new Date(`${value}T23:59:59`).toISOString() : null;
}

/** Ads: owner only. They show in feeds tagged "Ad", and each student earns the points once per ad. */
export function AdsPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [editing, setEditing] = useState<'new' | Ad | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const picture = usePictureEditor();

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const ads = await listAllAds();
      const viewers = await ownerAdViewers().catch(() => ({}) as Record<string, number>);
      setState({ kind: 'ready', ads, viewers });
    } catch (error) {
      console.error('[admin] ads', error);
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openForm(target: 'new' | Ad) {
    setErrors({});
    setMessage(null);
    if (target === 'new') {
      setForm(emptyForm);
      picture.reset(null);
    } else {
      setForm({
        advertiser: target.advertiser,
        title: target.title,
        body: target.body,
        link: target.link,
        points: String(target.points),
        endDate: toDateInput(target.endsAt),
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
      console.error('[admin] ads', error);
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    const title = form.title.trim();
    const points = Number(form.points);
    if (title.length < 1 || title.length > 120) next.title = 'Enter a title (up to 120 characters).';
    if (form.link.trim() && !safeLink(form.link)) next.link = 'Enter a full link that starts with https://';
    if (!Number.isInteger(points) || points < 0 || points > 5) next.points = 'Enter a whole number from 0 to 5.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input = {
      advertiser: form.advertiser,
      title,
      body: form.body,
      imagePath: picture.imagePath,
      link: form.link,
      points,
      endsAt: fromDateInput(form.endDate),
      published: form.published,
    };
    const saving = editing;
    void run(async () => {
      if (saving === 'new') await createAd(input);
      else if (saving) await updateAd(saving.id, input);
      await picture.commit();
    }, saving === 'new' ? 'Ad added.' : 'Ad updated.');
  }

  if (editing) {
    return (
      <section aria-labelledby="ads-heading" className="ann">
        <h1 id="ads-heading">{editing === 'new' ? 'New ad' : 'Edit ad'}</h1>
        <form className="ann__form" onSubmit={handleSave} noValidate>
          <TextField label="Advertiser" value={form.advertiser} onChange={(e) => setForm({ ...form, advertiser: e.target.value })} maxLength={80} hint="Optional. Who is paying for it." />
          <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title} maxLength={120} />
          <TextAreaField label="Message" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} hint="Optional. Keep it short (up to 400 characters)." maxLength={400} />
          <TextField label="Link" type="url" inputMode="url" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} error={errors.link} hint="Optional. A website or WhatsApp link the button opens." />
          <TextField label="Crumb Points for seeing it" type="number" inputMode="numeric" min={0} max={5} step={1} value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} error={errors.points} hint="0 to 5. Each student earns this once per ad." />
          <TextField label="Last day it runs" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} hint="Optional. Leave empty to run until you hide it." />
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
    <section aria-labelledby="ads-heading" className="ann">
      <div className="ann__head">
        <div>
          <h1 id="ads-heading">Ads</h1>
          <p className="text-secondary">Paid placements. They appear in the Home feed tagged "Ad", never back to back and never as the first two cards.</p>
        </div>
        <Button onClick={() => openForm('new')}>New ad</Button>
      </div>

      {message && (
        <p className="form-notice" role="status">
          {message}
        </p>
      )}

      {state.kind === 'loading' && <Loading label="Loading ads" />}
      {state.kind === 'error' && (
        <EmptyState title="We couldn't load ads" action={<Button onClick={() => void load()}>Try again</Button>}>
          {state.message}. Make sure supabase/011_shops_and_ads.sql has been run.
        </EmptyState>
      )}
      {state.kind === 'ready' && state.ads.length === 0 && (
        <EmptyState title="No ads yet" action={<Button onClick={() => openForm('new')}>Add the first ad</Button>}>
          Ads you add will show up in the Home feed.
        </EmptyState>
      )}
      {state.kind === 'ready' && state.ads.length > 0 && (
        <ul className="ann__list">
          {state.ads.map((item) => {
            const finished = item.endsAt !== null && Date.parse(item.endsAt) <= Date.now();
            return (
              <li key={item.id}>
                <Card as="article" className="ann__item">
                  <div className="ann__meta">
                    <span className="badge">{item.points} {item.points === 1 ? 'point' : 'points'}</span>
                    {!item.published && <span className="badge badge--minor">Hidden</span>}
                    {finished && <span className="badge badge--minor">Finished</span>}
                    <span className="text-secondary text-small">{state.viewers[item.id] ?? 0} students saw it</span>
                  </div>
                  {item.imagePath && <img className="picture-thumb" src={pictureUrl(item.imagePath)} alt="" loading="lazy" />}
                  <h2>{item.title}</h2>
                  {item.advertiser && <p className="text-secondary text-small">{item.advertiser}</p>}
                  <div className="ann__actions">
                    <Button variant="secondary" disabled={busy} onClick={() => openForm(item)}>Edit</Button>
                    <Button variant="secondary" disabled={busy} onClick={() => void run(() => setAdPublished(item.id, !item.published), item.published ? 'Hidden.' : 'Visible again.')}>
                      {item.published ? 'Hide' : 'Show'}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete "${item.title}"? This cannot be undone.`)) void run(() => deleteAd(item), 'Deleted.');
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

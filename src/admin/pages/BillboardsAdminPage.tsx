import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  adminListBillboards,
  createBillboard,
  deleteBillboard,
  layoutLabels,
  MIN_VISIBLE_DAYS,
  setBillboardFeatured,
  setBillboardStatus,
  updateBillboard,
} from '../../features/billboards';
import type { BillboardLayout, BillboardPost, BillboardStatus } from '../../features/billboards';
import { pictureUrl, removePicture, uploadPicture } from '../../services/pictures';
import { Button, Card, CheckboxField, EmptyState, Loading, SelectField, TextAreaField, TextField } from '../../shared/components';

interface FormState {
  layout: BillboardLayout;
  title: string;
  body: string;
  images: string[];
  videoUrl: string;
  linkUrl: string;
  linkLabel: string;
  featured: boolean;
  status: BillboardStatus;
  publishAt: string;
  expiresAt: string;
}

const toLocalInput = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const blank = (): FormState => ({ layout: 'text', title: '', body: '', images: [], videoUrl: '', linkUrl: '', linkLabel: '', featured: false, status: 'published', publishAt: toLocalInput(new Date().toISOString()), expiresAt: '' });
const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const wantsImages = (l: BillboardLayout) => l === 'image' || l === 'gallery';

/**
 * Create, edit, feature, archive and delete Billboard posts. Open to the owner and helper admins. A post stays visible at least
 * 30 days, so an end date must be at least 30 days after it goes live (the database checks this too).
 */
export function BillboardsAdminPage() {
  const [posts, setPosts] = useState<BillboardPost[] | null>(null);
  const [editing, setEditing] = useState<'new' | BillboardPost | null>(null);
  const [form, setForm] = useState<FormState>(blank());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const uploaded = useRef<string[]>([]);

  const load = useCallback(async () => {
    try {
      setPosts(await adminListBillboards());
    } catch (e) {
      setPosts([]);
      setMessage({ ok: false, text: e instanceof Error ? `${e.message}. Has supabase/026 been run?` : 'Something went wrong.' });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  function startNew() {
    uploaded.current = [];
    setForm(blank());
    setMessage(null);
    setEditing('new');
  }
  function startEdit(p: BillboardPost) {
    uploaded.current = [];
    setForm({ layout: p.layout, title: p.title, body: p.body, images: p.images, videoUrl: p.videoUrl ?? '', linkUrl: p.linkUrl ?? '', linkLabel: p.linkLabel, featured: p.featured, status: p.status, publishAt: toLocalInput(p.publishAt), expiresAt: toLocalInput(p.expiresAt) });
    setMessage(null);
    setEditing(p);
  }
  async function cancel() {
    await Promise.all(uploaded.current.map((path) => removePicture(path).catch(() => undefined)));
    uploaded.current = [];
    setEditing(null);
  }

  async function addPictures(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    const room = (form.layout === 'image' ? 1 : 10) - form.images.length;
    setUploading(true);
    setMessage(null);
    try {
      const added: string[] = [];
      for (const file of files.slice(0, Math.max(0, room))) {
        const path = await uploadPicture(file);
        uploaded.current.push(path);
        added.push(path);
      }
      setForm((f) => ({ ...f, images: [...f.images, ...added] }));
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Could not upload that picture.' });
    }
    setUploading(false);
  }
  async function dropPicture(path: string) {
    if (uploaded.current.includes(path)) {
      await removePicture(path).catch(() => undefined);
      uploaded.current = uploaded.current.filter((p) => p !== path);
    }
    setForm((f) => ({ ...f, images: f.images.filter((p) => p !== path) }));
  }

  async function run(action: () => Promise<void>, ok: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setEditing(null);
      await load();
      setMessage({ ok: true, text: ok });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' });
    }
    setBusy(false);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const publish = new Date(form.publishAt || Date.now());
    if (Number.isNaN(publish.getTime())) return setMessage({ ok: false, text: 'The publish time is not valid.' });
    let expires: Date | null = null;
    if (form.expiresAt) {
      expires = new Date(form.expiresAt);
      if (Number.isNaN(expires.getTime())) return setMessage({ ok: false, text: 'The end time is not valid.' });
      if (expires.getTime() < publish.getTime() + MIN_VISIBLE_DAYS * 86_400_000) return setMessage({ ok: false, text: `Every post stays visible at least ${MIN_VISIBLE_DAYS} days. Pick an end date ${MIN_VISIBLE_DAYS} or more days after it goes live, or leave it empty.` });
    }
    const hasContent = form.title.trim() || form.body.trim() || form.images.length > 0 || form.videoUrl.trim() || form.linkUrl.trim();
    if (!hasContent) return setMessage({ ok: false, text: 'Add something to the post: text, a picture, a video or a link.' });
    if (form.layout === 'video' && !/^https?:\/\//i.test(form.videoUrl.trim())) return setMessage({ ok: false, text: 'A video post needs a link that starts with https://.' });
    if (form.linkUrl.trim() && !/^https?:\/\//i.test(form.linkUrl.trim())) return setMessage({ ok: false, text: 'The link must start with https://.' });
    const input = {
      layout: form.layout,
      title: form.title,
      body: form.body,
      images: wantsImages(form.layout) ? form.images : [],
      videoUrl: form.layout === 'video' ? form.videoUrl.trim() : null,
      linkUrl: form.linkUrl.trim() || null,
      linkLabel: form.linkLabel,
      featured: form.featured,
      status: form.status,
      publishAt: publish.toISOString(),
      expiresAt: expires ? expires.toISOString() : null,
    };
    const old = editing !== 'new' && editing ? editing : null;
    void run(async () => {
      if (old) {
        await updateBillboard(old.id, input);
        // Pictures taken out of a saved post are removed from storage now that the save worked.
        await Promise.all(old.images.filter((p) => !input.images.includes(p)).map((p) => removePicture(p).catch(() => undefined)));
      } else await createBillboard(input);
      uploaded.current = [];
    }, old ? 'Updated.' : 'Posted.');
  }

  if (editing) {
    return (
      <section aria-labelledby="bb-heading" className="ann">
        <h1 id="bb-heading">{editing === 'new' ? 'New Billboard post' : 'Edit Billboard post'}</h1>
        <form className="ann__form" onSubmit={save} noValidate>
          <SelectField label="Layout" value={form.layout} onChange={(e) => setForm({ ...form, layout: e.target.value as BillboardLayout })}>
            {(Object.keys(layoutLabels) as BillboardLayout[]).map((l) => (
              <option key={l} value={l}>
                {layoutLabels[l]}
              </option>
            ))}
          </SelectField>
          <TextField label="Title (optional)" value={form.title} maxLength={140} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextAreaField label={form.layout === 'quote' ? 'The quote or story' : 'Text (optional)'} value={form.body} maxLength={2000} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          {wantsImages(form.layout) && (
            <div className="field">
              <span className="field__label">{form.layout === 'image' ? 'Picture' : 'Pictures (up to 10, in order)'}</span>
              <div className="ann__actions">
                {form.images.map((path) => (
                  <span key={path}>
                    <img className="picture-thumb" src={pictureUrl(path)} alt="" />
                    <Button variant="ghost" disabled={uploading} onClick={() => void dropPicture(path)}>
                      Remove
                    </Button>
                  </span>
                ))}
              </div>
              <label className="btn btn--secondary picture-pick">
                {uploading ? 'Uploading…' : 'Add pictures'}
                <input type="file" accept="image/*" multiple={form.layout === 'gallery'} onChange={(e) => void addPictures(e)} disabled={uploading || (form.layout === 'image' && form.images.length >= 1)} className="visually-hidden" />
              </label>
              <p className="field__hint">Pictures are shrunk automatically so the feed loads fast.</p>
            </div>
          )}
          {form.layout === 'video' && <TextField label="Video link" type="url" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} hint="A YouTube link, or a direct .mp4 link. YouTube opens in YouTube." />}
          <TextField label="Link (optional)" type="url" value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} hint="Shown as a link card under the post." />
          {form.linkUrl.trim() && <TextField label="Link button text" value={form.linkLabel} maxLength={60} onChange={(e) => setForm({ ...form, linkLabel: e.target.value })} hint="For example: Listen now." />}
          <CheckboxField checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })}>
            Featured: pinned to the top, and may also show on Home
          </CheckboxField>
          <SelectField label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BillboardStatus })}>
            <option value="published">Published</option>
            <option value="draft">Draft (not shown)</option>
            <option value="archived">Archived (not shown)</option>
          </SelectField>
          <TextField label="Goes live" type="datetime-local" value={form.publishAt} onChange={(e) => setForm({ ...form, publishAt: e.target.value })} hint="Set a later time to schedule it." />
          <TextField label="Ends (optional)" type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} hint={`Leave empty to keep it up. If you set one, it must be at least ${MIN_VISIBLE_DAYS} days after it goes live.`} />
          {message && (
            <p className={message.ok ? 'form-notice' : 'form-error'} role={message.ok ? 'status' : 'alert'}>
              {message.text}
            </p>
          )}
          <div className="ann__actions">
            <Button type="submit" disabled={busy || uploading}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void cancel()}>
              Cancel
            </Button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section aria-labelledby="bb-heading" className="ann">
      <div className="ann__head">
        <div>
          <h1 id="bb-heading">Billboards</h1>
          <p className="text-secondary">The free discovery feed: music, creators, stories, recommendations and more. Not ads, not events. Every post stays up at least {MIN_VISIBLE_DAYS} days.</p>
        </div>
        <Button onClick={startNew}>New post</Button>
      </div>
      {message && (
        <p className={message.ok ? 'form-notice' : 'form-error'} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}
      {!posts ? (
        <Loading label="Loading posts" />
      ) : posts.length === 0 ? (
        <EmptyState title="No Billboard posts yet" action={<Button onClick={startNew}>Write the first one</Button>}>
          Posts you publish show up in the Billboards tab.
        </EmptyState>
      ) : (
        <ul className="ann__list">
          {posts.map((p) => {
            const live = p.status === 'published' && new Date(p.publishAt).getTime() <= Date.now() && (!p.expiresAt || new Date(p.expiresAt).getTime() > Date.now());
            return (
              <li key={p.id}>
                <Card as="article" className="ann__item">
                  <div className="ann__meta">
                    <span className="badge">{layoutLabels[p.layout]}</span>
                    <span className={live ? 'badge' : 'badge badge--minor'}>{live ? 'Live' : p.status === 'published' ? (new Date(p.publishAt).getTime() > Date.now() ? 'Scheduled' : 'Ended') : p.status === 'draft' ? 'Draft' : 'Archived'}</span>
                    {p.featured && <span className="badge badge--medium">Featured</span>}
                    <span className="text-xs text-secondary">{dateFmt.format(new Date(p.publishAt))}</span>
                  </div>
                  {p.images[0] && <img className="picture-thumb" src={pictureUrl(p.images[0])} alt="" loading="lazy" />}
                  <h2>{p.title || p.body.slice(0, 60) || layoutLabels[p.layout]}</h2>
                  <div className="ann__actions">
                    <Button variant="secondary" disabled={busy} onClick={() => startEdit(p)}>
                      Edit
                    </Button>
                    <Button variant="secondary" disabled={busy} onClick={() => void run(() => setBillboardFeatured(p.id, !p.featured), p.featured ? 'Unfeatured.' : 'Featured.')}>
                      {p.featured ? 'Unfeature' : 'Feature'}
                    </Button>
                    <Button variant="secondary" disabled={busy} onClick={() => void run(() => setBillboardStatus(p.id, p.status === 'archived' ? 'published' : 'archived'), p.status === 'archived' ? 'Restored.' : 'Archived.')}>
                      {p.status === 'archived' ? 'Restore' : 'Archive'}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm('Delete this post? This cannot be undone.')) void run(() => deleteBillboard(p), 'Deleted.');
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

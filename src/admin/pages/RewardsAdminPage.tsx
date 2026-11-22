import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth, isOwnerRole } from '../../features/authentication';
import { adminDeleteRedemption, adminDeleteReward, adminGetRewardFile, adminListRedemptions, adminListRewards, adminSaveReward, adminSetRedemptionStatus, listRewardCategories, productTypeLabels } from '../../features/points';
import type { AdminRedemption, ProductType, Reward, RewardCategory } from '../../features/points';
import { pictureUrl } from '../../services/pictures';
import { Button, Card, CheckboxField, EmptyState, Loading, SelectField, TextAreaField, TextField } from '../../shared/components';
import { whatsappLink } from '../../shared/phone';
import { PictureField } from '../components/PictureField';
import { BonusPanel } from './BonusPanel';
import { RewardCategoriesPanel } from './RewardCategoriesPanel';
import { usePictureEditor } from '../usePictureEditor';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rewards: Reward[]; orders: AdminRedemption[] };

interface RewardForm {
  name: string;
  description: string;
  cost: string;
  stock: string;
  kind: 'physical' | 'digital';
  fileUrl: string;
  active: boolean;
  isBonus: boolean;
  bonusCost: string;
  bonusEnds: string;
  bonusLimit: string;
  productType: ProductType;
  discountMode: 'none' | '50' | '80' | '90' | 'custom';
  discountCustom: string;
  discountStart: string;
  discountEnd: string;
  perUserLimit: string;
  categoryId: string;
}

const emptyReward: RewardForm = { name: '', description: '', cost: '', stock: '', kind: 'physical', fileUrl: '', active: true, isBonus: false, bonusCost: '', bonusEnds: '', bonusLimit: '1', productType: 'item', discountMode: 'none', discountCustom: '', discountStart: '', discountEnd: '', perUserLimit: '', categoryId: '' };

/** An ISO time as the text a datetime-local box wants (in the admin's own time zone). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Reward items (with pictures) and the orders students place. Owner and helper admins. */
export function RewardsAdminPage() {
  const auth = useAuth();
  const owner = auth.profile ? isOwnerRole(auth.profile.role) : false;
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<'new' | Reward | null>(null);
  const [form, setForm] = useState<RewardForm>(emptyReward);
  const [categories, setCategories] = useState<RewardCategory[]>([]);
  const loadCategories = useCallback(() => {
    void listRewardCategories().then(setCategories);
  }, []);
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);
  const [formError, setFormError] = useState<string | null>(null);
  const picture = usePictureEditor();

  const load = useCallback(async () => {
    try {
      const [rewards, orders] = await Promise.all([adminListRewards(), adminListRedemptions()]);
      setState({ kind: 'ready', rewards, orders });
    } catch (error) {
      console.error('[admin] rewards', error);
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<void>, success: string): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await load();
      setMessage({ kind: 'ok', text: success });
      setBusy(false);
      return true;
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Something went wrong.' });
      setBusy(false);
      return false;
    }
  }

  function openForm(target: 'new' | Reward) {
    setFormError(null);
    if (target === 'new') {
      setForm(emptyReward);
      picture.reset(null);
    } else {
      setForm({ name: target.name, description: target.description, cost: String(target.costPoints), stock: target.stock === null ? '' : String(target.stock), kind: target.kind, fileUrl: '', active: target.active, isBonus: target.isBonus, bonusCost: target.bonusCost === null ? '' : String(target.bonusCost), bonusEnds: toLocalInput(target.bonusEndsAt), bonusLimit: String(target.bonusLimitPerUser), productType: target.productType, discountMode: target.discountPercent === null ? 'none' : [50, 80, 90].includes(target.discountPercent) ? (String(target.discountPercent) as '50' | '80' | '90') : 'custom', discountCustom: target.discountPercent !== null && ![50, 80, 90].includes(target.discountPercent) ? String(target.discountPercent) : '', discountStart: toLocalInput(target.discountStartsAt), discountEnd: toLocalInput(target.discountEndsAt), perUserLimit: target.perUserLimit === null ? '' : String(target.perUserLimit), categoryId: target.categoryId ?? '' });
      if (target.kind === 'digital') void adminGetRewardFile(target.id).then((url) => setForm((f) => ({ ...f, fileUrl: url }))).catch(() => undefined);
      picture.reset(target.imagePath);
    }
    setEditing(target);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const cost = Number(form.cost);
    if (!form.name.trim()) return setFormError('Enter a name.');
    if (!Number.isInteger(cost) || cost < 1) return setFormError('The cost must be a whole number of points, at least 1.');
    const stock = form.stock.trim() === '' ? null : Number(form.stock);
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) return setFormError('How many are in stock must be a whole number, or empty for unlimited.');
    if (form.kind === 'digital' && form.active && !/^https?:\/\//i.test(form.fileUrl.trim())) return setFormError('A digital item needs a link to the file, starting with https://');
    let bonusCost: number | null = null;
    let bonusLimit = 1;
    let bonusEndsAt: string | null = null;
    if (form.isBonus) {
      bonusCost = Number(form.bonusCost);
      bonusLimit = Number(form.bonusLimit || '1');
      if (!Number.isInteger(bonusCost) || bonusCost < 1) return setFormError('The bonus price must be a whole number of points, at least 1.');
      if (bonusCost >= cost) return setFormError('The bonus price must be lower than the normal price, so it is a real offer.');
      if (!Number.isInteger(bonusLimit) || bonusLimit < 1) return setFormError('How many each person can claim must be at least 1.');
      if (form.bonusEnds) {
        const when = new Date(form.bonusEnds);
        if (Number.isNaN(when.getTime())) return setFormError('The end time is not a valid date.');
        bonusEndsAt = when.toISOString();
      }
    }
    // Store settings: discount percent with dates, limit per person, category and product type.
    let discountPercent: number | null = null;
    if (!form.isBonus && form.discountMode !== 'none') {
      discountPercent = form.discountMode === 'custom' ? Number(form.discountCustom) : Number(form.discountMode);
      if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 99) return setFormError('A discount must be a whole percent from 1 to 99.');
    }
    const discountStartsAt = form.discountStart ? new Date(form.discountStart) : null;
    const discountEndsAt = form.discountEnd ? new Date(form.discountEnd) : null;
    if ((discountStartsAt && Number.isNaN(discountStartsAt.getTime())) || (discountEndsAt && Number.isNaN(discountEndsAt.getTime()))) return setFormError('A discount date is not valid.');
    if (discountStartsAt && discountEndsAt && discountEndsAt <= discountStartsAt) return setFormError('The discount must end after it starts.');
    const perUserLimit = form.perUserLimit.trim() ? Number(form.perUserLimit) : null;
    if (perUserLimit !== null && (!Number.isInteger(perUserLimit) || perUserLimit < 1)) return setFormError('The limit per person must be a whole number, at least 1.');
    const productType: ProductType = form.kind === 'physical' ? 'item' : form.productType === 'item' ? 'ebook' : form.productType;
    const store = { productType, discountPercent, discountStartsAt: discountStartsAt ? discountStartsAt.toISOString() : null, discountEndsAt: discountEndsAt ? discountEndsAt.toISOString() : null, perUserLimit, categoryId: form.categoryId || null };
    const original = editing && editing !== 'new' ? editing : null;
    const defaultType: ProductType = form.kind === 'physical' ? 'item' : 'ebook';
    const storeUsed = productType !== defaultType || discountPercent !== null || perUserLimit !== null || store.categoryId !== null;
    const storeHad = original ? original.discountPercent !== null || original.perUserLimit !== null || original.categoryId !== null || original.productType !== (original.kind === 'physical' ? 'item' : 'ebook') : false;
    setFormError(null);
    const id = editing && editing !== 'new' ? editing.id : null;
    const ok = await run(async () => {
      await adminSaveReward(id, { name: form.name, description: form.description, costPoints: cost, active: form.active, imagePath: picture.imagePath, stock, kind: form.kind, fileUrl: form.kind === 'digital' ? form.fileUrl.trim() : '', bonus: { isBonus: form.isBonus, bonusCost, bonusEndsAt, bonusLimitPerUser: bonusLimit }, ...(storeUsed || storeHad ? { store } : {}) });
      await picture.commit();
    }, id ? 'Reward updated.' : 'Reward added.');
    if (ok) setEditing(null);
  }

  if (state.kind === 'loading') return <Loading label="Loading rewards" />;
  if (state.kind === 'error') {
    return (
      <EmptyState title="We couldn't load rewards" action={<Button onClick={() => void load()}>Try again</Button>}>
        {state.message}. Make sure the latest database updates (supabase/010) have been run.
      </EmptyState>
    );
  }

  const pending = state.orders.filter((o) => o.status === 'pending');
  const past = state.orders.filter((o) => o.status !== 'pending').slice(0, 10);

  if (editing) {
    return (
      <section aria-labelledby="rw-heading" className="ann">
        <h1 id="rw-heading">{editing === 'new' ? 'New reward' : 'Edit reward'}</h1>
        <form className="ann__form" onSubmit={save} noValidate>
          <TextField label="Item name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
          <TextAreaField label="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} hint="Optional. One or two lines about the item." />
          <TextField label={form.isBonus ? 'Normal price in points (shown crossed out)' : 'Price in points'} type="number" inputMode="numeric" min={1} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          <SelectField label="What is it?" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'physical' | 'digital' })}>
            <option value="physical">A physical item (handed over in school)</option>
            <option value="digital">A digital item such as an ebook (delivered at once)</option>
          </SelectField>
          {form.kind === 'digital' && (
            <TextField label="Link to the file" type="url" inputMode="url" autoCapitalize="none" value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} hint="Paste a link to the PDF, for example from Google Drive (sharing: anyone with the link). Students only get it after buying." />
          )}
          <TextField label="How many are in stock" type="number" inputMode="numeric" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} hint="Leave empty for unlimited. When it reaches 0 the item shows as sold out. Cancelling an order puts one back." />
          <CheckboxField checked={form.isBonus} onChange={(e) => setForm({ ...form, isBonus: e.target.checked })}>
            Bonus Reward: a special low price for new members
          </CheckboxField>
          {form.isBonus && (
            <>
              <TextField label="Bonus price in points" type="number" inputMode="numeric" min={1} value={form.bonusCost} onChange={(e) => setForm({ ...form, bonusCost: e.target.value })} hint="What a new member pays. Must be lower than the normal price." />
              <TextField label="Offer ends (optional)" type="datetime-local" value={form.bonusEnds} onChange={(e) => setForm({ ...form, bonusEnds: e.target.value })} hint="Leave empty to keep it going until you switch it off or it sells out." />
              <TextField label="How many each person can claim" type="number" inputMode="numeric" min={1} value={form.bonusLimit} onChange={(e) => setForm({ ...form, bonusLimit: e.target.value })} />
              <p className="text-secondary text-small">Use "How many are in stock" above for a limited quantity. Who counts as a new member is set in the Bonus settings on the Rewards page.</p>
            </>
          )}
          {form.kind === 'digital' && (
            <SelectField label="What kind of digital product" value={form.productType === 'item' ? 'ebook' : form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value as ProductType })}>
              {(Object.keys(productTypeLabels) as ProductType[]).filter((k) => k !== 'item').map((k) => (
                <option key={k} value={k}>
                  {productTypeLabels[k]}
                </option>
              ))}
            </SelectField>
          )}
          {categories.length > 0 && (
            <SelectField label="Category" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
          )}
          {!form.isBonus && (
            <>
              <SelectField label="Discount" value={form.discountMode} onChange={(e) => setForm({ ...form, discountMode: e.target.value as RewardForm['discountMode'] })}>
                <option value="none">No discount</option>
                <option value="50">50% off</option>
                <option value="80">80% off</option>
                <option value="90">90% off</option>
                <option value="custom">Custom percent</option>
              </SelectField>
              {form.discountMode === 'custom' && <TextField label="Percent off" type="number" inputMode="numeric" min={1} max={99} value={form.discountCustom} onChange={(e) => setForm({ ...form, discountCustom: e.target.value })} />}
              {form.discountMode !== 'none' && (
                <>
                  <TextField label="Discount starts (optional)" type="datetime-local" value={form.discountStart} onChange={(e) => setForm({ ...form, discountStart: e.target.value })} hint="Leave empty to start straight away." />
                  <TextField label="Discount ends (optional)" type="datetime-local" value={form.discountEnd} onChange={(e) => setForm({ ...form, discountEnd: e.target.value })} hint="Leave empty to keep it until you change it." />
                </>
              )}
            </>
          )}
          <TextField label="Most times one person can get this (optional)" type="number" inputMode="numeric" min={1} value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} hint="Leave empty for no limit. Use stock above for a limited total." />
          <PictureField imagePath={picture.imagePath} uploading={picture.uploading} error={picture.error} onPick={(file) => void picture.pick(file)} onRemove={() => void picture.remove()} />
          <CheckboxField checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}>
            Available to students
          </CheckboxField>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
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
    <section aria-labelledby="rw-heading" className="ann">
      <div>
        <h1 id="rw-heading">Rewards and orders</h1>
        <p className="text-secondary">Upload items students can get with their points, and handle the orders they place.</p>
      </div>

      {message && (
        <p className={message.kind === 'ok' ? 'form-notice' : 'form-error'} role={message.kind === 'ok' ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}

      <h2>Orders to deliver ({pending.length})</h2>
      {pending.length === 0 ? (
        <p className="text-secondary">Nothing waiting. When a student gets a reward, the order shows up here with a way to reach them.</p>
      ) : (
        <ul className="ann__list">
          {pending.map((o) => {
            const link = whatsappLink(o.phone);
            return (
              <li key={o.id}>
                <Card as="article" className="ann__item">
                  <h3>{o.rewardName}</h3>
                  <p className="text-secondary text-small">
                    {o.username} · {o.pointsCost} pts · {dateFormat.format(new Date(o.createdAt))}
                  </p>
                  <p className="text-small">WhatsApp {o.phone || 'not given'} · {o.email}</p>
                  {o.deliveryPlace && <p className="text-small"><strong>Deliver to:</strong> {o.deliveryPlace}</p>}
                  <div className="ann__actions">
                    {link && (
                      <a className="btn btn--primary" href={link} target="_blank" rel="noopener noreferrer">
                        Message on WhatsApp
                      </a>
                    )}
                    <Button variant="secondary" disabled={busy} onClick={() => void run(() => adminSetRedemptionStatus(o.id, 'fulfilled'), 'Marked as handed over.')}>
                      Handed over
                    </Button>
                    {owner && (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Cancel and refund ${o.pointsCost} points to ${o.username}?`)) void run(() => adminSetRedemptionStatus(o.id, 'cancelled'), 'Cancelled and refunded.');
                        }}
                      >
                        Cancel and refund
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {past.length > 0 && (
        <details>
          <summary>Recent handled orders</summary>
          <ul className="activity-list">
            {past.map((o) => (
              <li key={o.id} className="activity-row">
                <span>
                  {o.rewardName} · {o.username}
                </span>
                <span className="text-xs text-secondary">{o.status}</span>
                {owner && (
                  <Button variant="ghost" disabled={busy} onClick={() => void run(() => adminDeleteRedemption(o.id), 'Order removed.')}>
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <BonusPanel />
      <RewardCategoriesPanel categories={categories} onChange={loadCategories} />

      <div className="ann__head">
        <h2>Reward items</h2>
        <Button onClick={() => openForm('new')}>Add an item</Button>
      </div>
      {state.rewards.length === 0 ? (
        <p className="text-secondary">No items yet. Add the first one so students have something to spend points on.</p>
      ) : (
        <ul className="ann__list">
          {state.rewards.map((reward) => (
            <li key={reward.id}>
              <Card as="article" className="ann__item">
                <div className="ann__meta">
                  <span className="badge badge--medium">{reward.isBonus && reward.bonusCost !== null ? `${reward.bonusCost} pts (was ${reward.costPoints})` : `${reward.costPoints} pts`}</span>
                  {reward.isBonus && <span className="badge">Bonus</span>}
                  {!reward.active && <span className="badge badge--minor">Hidden</span>}
                  {reward.kind === 'digital' && <span className="badge">Digital</span>}
                  {reward.stock !== null && <span className="badge badge--minor">{reward.stock === 0 ? 'Sold out' : `${reward.stock} left`}</span>}
                </div>
                {reward.imagePath && <img className="picture-thumb" src={pictureUrl(reward.imagePath)} alt="" loading="lazy" />}
                <h3>{reward.name}</h3>
                {reward.description && <p className="text-secondary text-small">{reward.description}</p>}
                <div className="ann__actions">
                  <Button variant="secondary" disabled={busy} onClick={() => openForm(reward)}>
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => adminSaveReward(reward.id, { name: reward.name, description: reward.description, costPoints: reward.costPoints, active: !reward.active, imagePath: reward.imagePath, stock: reward.stock }),
                        reward.active ? 'Hidden from students.' : 'Available again.',
                      )
                    }
                  >
                    {reward.active ? 'Hide' : 'Show'}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Delete "${reward.name}"? This cannot be undone.`)) void run(() => adminDeleteReward(reward), 'Deleted.');
                    }}
                  >
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

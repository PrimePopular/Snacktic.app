import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth, isOwnerRole } from '../../features/authentication';
import { adminListRedemptions, adminListRewards, adminSaveReward, adminSetRedemptionStatus } from '../../features/points';
import type { AdminRedemption, Reward } from '../../features/points';
import { pictureUrl } from '../../services/pictures';
import { Button, Card, CheckboxField, EmptyState, Loading, TextAreaField, TextField } from '../../shared/components';
import { PictureField } from '../components/PictureField';
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
  active: boolean;
}

const emptyReward: RewardForm = { name: '', description: '', cost: '', stock: '', active: true };
const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** A WhatsApp chat link from a phone number. WhatsApp needs the country code (for example 234 for Nigeria). */
function whatsappLink(phone: string): string | null {
  const digits = phone.replace(/\D/g, '').replace(/^00/, '');
  return digits.length >= 7 ? `https://wa.me/${digits}` : null;
}

/** Reward items (with pictures) and the orders students place. Owner and helper admins. */
export function RewardsAdminPage() {
  const auth = useAuth();
  const owner = auth.profile ? isOwnerRole(auth.profile.role) : false;
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<'new' | Reward | null>(null);
  const [form, setForm] = useState<RewardForm>(emptyReward);
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
      setForm({ name: target.name, description: target.description, cost: String(target.costPoints), stock: target.stock === null ? '' : String(target.stock), active: target.active });
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
    setFormError(null);
    const id = editing && editing !== 'new' ? editing.id : null;
    const ok = await run(async () => {
      await adminSaveReward(id, { name: form.name, description: form.description, costPoints: cost, active: form.active, imagePath: picture.imagePath, stock });
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
          <TextField label="Price in points" type="number" inputMode="numeric" min={1} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          <TextField label="How many are in stock" type="number" inputMode="numeric" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} hint="Leave empty for unlimited. When it reaches 0 the item shows as sold out. Cancelling an order puts one back." />
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
                  {o.phone && /^\s*0/.test(o.phone) && <p className="text-xs text-secondary">The number starts with 0. WhatsApp needs the country code, so the chat button may not open.</p>}
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
              </li>
            ))}
          </ul>
        </details>
      )}

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
                  <span className="badge badge--medium">{reward.costPoints} pts</span>
                  {!reward.active && <span className="badge badge--minor">Hidden</span>}
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
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

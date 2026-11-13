import { useCallback, useEffect, useId, useState } from 'react';
import { useAuth } from '../../features/authentication';
import { validatePhone } from '../../features/authentication/validation';
import { CardArt } from '../../features/feed';
import { getBalance, kindLabels, listHistory, listMyRedemptions, listRewards, redeemReward } from '../../features/points';
import type { PointsTransaction, Redemption, Reward } from '../../features/points';
import { pictureUrl } from '../../services/pictures';
import { playCoin } from '../../services/sound';
import { Button, EmptyState, Loading, Modal, PageHeader, TextField } from '../../shared/components';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; balance: number; history: PointsTransaction[]; rewards: Reward[]; redemptions: Redemption[] };

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const statusLabel: Record<Redemption['status'], string> = {
  pending: 'Waiting for the team to contact you',
  fulfilled: 'Handed over',
  cancelled: 'Cancelled and refunded',
};

/** The signed-in Rewards screen: your points, the reward shop, your orders and your activity. */
export function RewardsDashboard() {
  const auth = useAuth();
  const profile = auth.profile;
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [notice, setNotice] = useState<string | null>(null);
  const [buying, setBuying] = useState<Reward | null>(null);
  const [phone, setPhone] = useState('');
  const [buyError, setBuyError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const buyTitleId = useId();

  const load = useCallback(async () => {
    try {
      const [balance, history, rewards, redemptions] = await Promise.all([getBalance(), listHistory(), listRewards(), listMyRedemptions()]);
      setState({ kind: 'ready', balance, history, rewards, redemptions });
    } catch (error) {
      console.error('[rewards]', error);
      setState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startBuying(reward: Reward) {
    setNotice(null);
    setBuyError(null);
    setPhone(profile?.phone ?? '');
    setBuying(reward);
  }

  async function confirmBuying() {
    if (!buying) return;
    setBuyError(null);
    const needsPhone = !profile?.phone;
    if (needsPhone) {
      const problem = validatePhone(phone, true);
      if (problem) return setBuyError(problem);
    }
    setBusy(true);
    try {
      if (needsPhone) {
        const saved = await auth.updateDetails({ phone: phone.trim() });
        if (!saved.ok) {
          setBuyError(saved.message);
          setBusy(false);
          return;
        }
      }
      await redeemReward(buying.id);
      playCoin();
      setNotice(`Order placed for "${buying.name}"! A Snacktic agent will message you on WhatsApp to arrange delivery.`);
      setBuying(null);
      await load();
    } catch (error) {
      setBuyError(error instanceof Error ? error.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  if (state.kind === 'loading') return <Loading label="Loading your rewards" />;

  if (state.kind === 'error') {
    return (
      <>
        <PageHeader title="Rewards" />
        <EmptyState title="We couldn't load your rewards" action={<Button onClick={() => void load()}>Try again</Button>}>
          Check your connection and try again. If this keeps happening, the latest database updates may not have been run.
        </EmptyState>
      </>
    );
  }

  const { balance, history, rewards, redemptions } = state;

  return (
    <>
      <section className="balance-hero" aria-label="Your Crumb Points">
        <p className="balance-hero__label">Your Crumb Points</p>
        <p className="balance-hero__number" aria-live="polite">
          {balance.toLocaleString()}
        </p>
        <p className="balance-hero__hint">Earn points from games and events, then spend them on rewards below.</p>
      </section>

      {profile?.suspended && (
        <p className="form-error" role="alert">
          Your account is suspended, so you can't spend points right now. Please contact the Snacktic team.
        </p>
      )}
      {notice && (
        <p className="form-notice" role="status">
          {notice}
        </p>
      )}

      <section className="rewards-section" aria-labelledby="shop-heading">
        <h2 id="shop-heading">Claim a reward</h2>
        {rewards.length === 0 ? (
          <EmptyState title="No rewards yet">New rewards are added by the Snacktic team. Check back soon.</EmptyState>
        ) : (
          <ul className="reward-grid">
            {rewards.map((reward) => {
              const missing = reward.costPoints - balance;
              const soldOut = reward.stock === 0;
              return (
                <li key={reward.id}>
                  <article className="reward-card">
                    <div className="reward-card__media feed-card__media--tint0">
                      {reward.imagePath ? <img src={pictureUrl(reward.imagePath)} alt="" loading="lazy" decoding="async" /> : <CardArt />}
                      <span className="reward-card__cost">{reward.costPoints.toLocaleString()} pts</span>
                    </div>
                    <div className="reward-card__body">
                      <h3>{reward.name}</h3>
                      {reward.description && <p className="text-secondary text-small">{reward.description}</p>}
                      {reward.stock !== null && reward.stock > 0 && reward.stock <= 5 && <p className="text-small"><strong>Only {reward.stock} left</strong></p>}
                      <Button disabled={soldOut || missing > 0 || Boolean(profile?.suspended)} onClick={() => startBuying(reward)}>
                        {soldOut ? 'Sold out' : missing > 0 ? `Need ${missing.toLocaleString()} more` : 'Get this'}
                      </Button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal open={buying !== null} onClose={() => setBuying(null)} labelledBy={buyTitleId}>
        {buying && (
          <div className="buy-sheet">
            <h2 id={buyTitleId}>Get {buying.name}?</h2>
            <p>
              This costs <strong>{buying.costPoints.toLocaleString()} points</strong>. You'll have {(balance - buying.costPoints).toLocaleString()} left.
            </p>
            {profile?.phone ? (
              <p className="text-secondary">A Snacktic agent will message you on WhatsApp ({profile.phone}) to arrange delivery in school.</p>
            ) : (
              <>
                <p className="text-secondary">Add your WhatsApp number so a Snacktic agent can reach you to arrange delivery in school.</p>
                <TextField label="WhatsApp number" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={25} autoComplete="tel" />
              </>
            )}
            {buyError && (
              <p className="form-error" role="alert">
                {buyError}
              </p>
            )}
            <div className="buy-sheet__actions">
              <Button disabled={busy} onClick={() => void confirmBuying()}>
                {busy ? 'One moment…' : `Yes, spend ${buying.costPoints.toLocaleString()} points`}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setBuying(null)}>
                Not now
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {redemptions.length > 0 && (
        <section className="rewards-section" aria-labelledby="mine-heading">
          <h2 id="mine-heading">Your orders</h2>
          <ul className="activity-list">
            {redemptions.map((r) => (
              <li key={r.id} className="activity-row">
                <div>
                  <p className="activity-row__title">{r.rewardName}</p>
                  <p className="text-xs text-secondary">
                    {statusLabel[r.status]} · {dateFormat.format(new Date(r.createdAt))}
                  </p>
                </div>
                <span className="activity-row__amount activity-row__amount--out">-{r.pointsCost}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rewards-section" aria-labelledby="activity-heading">
        <h2 id="activity-heading">Activity</h2>
        {history.length === 0 ? (
          <p className="text-secondary">No activity yet. Your points will show up here.</p>
        ) : (
          <ul className="activity-list">
            {history.map((t) => (
              <li key={t.id} className="activity-row">
                <div>
                  <p className="activity-row__title">{kindLabels[t.kind]}</p>
                  <p className="text-xs text-secondary">
                    {t.note ? `${t.note} · ` : ''}
                    {dateFormat.format(new Date(t.createdAt))}
                  </p>
                </div>
                <span className={`activity-row__amount ${t.amount > 0 ? 'activity-row__amount--in' : 'activity-row__amount--out'}`}>
                  {t.amount > 0 ? '+' : ''}
                  {t.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

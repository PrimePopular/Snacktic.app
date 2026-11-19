import { useEffect, useId, useState } from 'react';
import { isOfferLive, getBonusStatus, NO_BONUS, priceOf, endsText } from '../../features/bonus';
import type { BonusStatus } from '../../features/bonus';
import { CardArt } from '../../features/feed';
import { listRewards } from '../../features/points';
import type { Reward } from '../../features/points';
import { pictureUrl } from '../../services/pictures';
import { Button, EmptyState, Loading, Modal, PageHeader } from '../../shared/components';
import { RewardCard } from './RewardCard';

type Tab = 'physical' | 'digital';

/**
 * The Rewards Store for visitors who are not signed in. Everything can be looked at: pictures, descriptions, prices and special
 * offers. Only getting a reward needs an account, and the database checks that too.
 */
export function PublicRewards({ focusId }: { focusId?: string }) {
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [bonus, setBonus] = useState<BonusStatus>(NO_BONUS);
  const [tab, setTab] = useState<Tab>('physical');
  const [open, setOpen] = useState<Reward | null>(null);
  const titleId = useId();

  useEffect(() => {
    let active = true;
    void Promise.all([listRewards(), getBonusStatus()])
      .then(([list, status]) => {
        if (!active) return;
        setRewards(list);
        setBonus(status);
        const wanted = focusId ? list.find((r) => r.id === focusId) : undefined;
        if (wanted) {
          setTab(wanted.kind);
          setOpen(wanted);
        }
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [focusId]);

  const header = <PageHeader title="Rewards" description="Look around the Rewards Store. Sign in to collect Crumb Points and get rewards." />;
  if (failed) {
    return (
      <>
        {header}
        <EmptyState title="We couldn't load the rewards" action={<Button onClick={() => window.location.reload()}>Try again</Button>}>
          Check your connection and try again.
        </EmptyState>
      </>
    );
  }
  if (!rewards) return <Loading label="Loading rewards" />;

  const items = rewards.filter((r) => r.kind === tab && (!r.isBonus || isOfferLive(r))).sort((a, b) => Number(b.isBonus) - Number(a.isBonus));
  const bonusOpen = open?.isBonus && isOfferLive(open);

  return (
    <>
      {header}
      <p className="form-notice" role="note">
        <Button to="/profile" variant="secondary">
          Create account or sign in
        </Button>{' '}
        to get rewards. New members get special offers.
      </p>
      <div className="market-tabs" role="tablist" aria-label="Market sections">
        <button type="button" role="tab" aria-selected={tab === 'physical'} className={`market-tab ${tab === 'physical' ? 'market-tab--on' : ''}`} onClick={() => setTab('physical')}>
          Items
        </button>
        <button type="button" role="tab" aria-selected={tab === 'digital'} className={`market-tab ${tab === 'digital' ? 'market-tab--on' : ''}`} onClick={() => setTab('digital')}>
          Digital
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyState title={tab === 'digital' ? 'No digital rewards yet' : 'No items yet'}>New things are added by the Snacktic team. Check back soon.</EmptyState>
      ) : (
        <ul className="reward-grid">
          {items.map((reward) => (
            <li key={reward.id}>
              <RewardCard reward={reward} balance={null} eligible={false} claimed={false} onGet={setOpen} onOpen={setOpen} />
            </li>
          ))}
        </ul>
      )}

      <Modal open={open !== null} onClose={() => setOpen(null)} labelledBy={titleId}>
        {open && (
          <div className="buy-sheet">
            <div className="reward-card__media feed-card__media--tint0">{open.imagePath ? <img src={pictureUrl(open.imagePath)} alt="" /> : <CardArt />}</div>
            <h2 id={titleId}>{open.name}</h2>
            {open.description && <p>{open.description}</p>}
            <p>
              <strong>{priceOf(open).toLocaleString()} points</strong>
              {bonusOpen && <span className="reward-card__was">{open.costPoints.toLocaleString()} points</span>}
            </p>
            <p className="text-secondary text-small">{open.kind === 'digital' ? 'A digital reward, delivered at once.' : 'A physical reward, delivered in school.'}</p>
            {bonusOpen && (
              <p className="text-small">
                <strong>New member offer{endsText(open) ? ` · ${endsText(open)}` : ''}.</strong> For members in their first {bonus.eligibilityDays} days.
              </p>
            )}
            {open.stock !== null && open.stock > 0 && open.stock <= 10 && <p className="text-small"><strong>Only {open.stock} left</strong></p>}
            <p className="text-secondary">To get this reward, you need a Snacktic account.</p>
            <div className="buy-sheet__actions">
              <Button to="/profile">Sign in or register</Button>
              <Button variant="secondary" onClick={() => setOpen(null)}>
                Keep browsing
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

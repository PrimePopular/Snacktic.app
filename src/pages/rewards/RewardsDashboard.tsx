import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { useAuth } from '../../features/authentication';
import { validatePhone } from '../../features/authentication/validation';
import { AdCard, useLiveAds, weaveAds } from '../../features/ads';
import { CardArt } from '../../features/feed';
import { buyDigitalReward, getBalance, listMyDigitalPurchases, listRewards, redeemReward } from '../../features/points';
import type { Reward } from '../../features/points';
import { pictureUrl } from '../../services/pictures';
import { playCoin } from '../../services/sound';
import { Button, EmptyState, Loading, Modal, PageHeader, TextField } from '../../shared/components';

type Tab = 'physical' | 'digital';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; balance: number; rewards: Reward[]; owned: Record<string, string> };

const PAGE = 12;

interface CardProps {
  reward: Reward;
  balance: number;
  ownedUrl: string | undefined;
  suspended: boolean;
  onGet: (reward: Reward) => void;
}

/** One item in the market. Compact, so many fit on a screen. */
function RewardCard({ reward, balance, ownedUrl, suspended, onGet }: CardProps) {
  const missing = reward.costPoints - balance;
  const soldOut = reward.stock === 0;
  return (
    <article className="reward-card">
      <div className="reward-card__media feed-card__media--tint0">
        {reward.imagePath ? <img src={pictureUrl(reward.imagePath)} alt="" loading="lazy" decoding="async" /> : <CardArt />}
        <span className="reward-card__cost">{reward.costPoints.toLocaleString()} pts</span>
        {reward.kind === 'digital' && <span className="reward-card__tag">Ebook</span>}
      </div>
      <div className="reward-card__body">
        <h3>{reward.name}</h3>
        {reward.description && <p className="text-secondary text-small reward-card__desc">{reward.description}</p>}
        {reward.stock !== null && reward.stock > 0 && reward.stock <= 5 && (
          <p className="text-small">
            <strong>Only {reward.stock} left</strong>
          </p>
        )}
        {ownedUrl ? (
          <Button onClick={() => window.open(ownedUrl, '_blank', 'noopener')}>Open</Button>
        ) : (
          <Button disabled={soldOut || missing > 0 || suspended} onClick={() => onGet(reward)}>
            {soldOut ? 'Sold out' : missing > 0 ? `Need ${missing.toLocaleString()} more` : reward.kind === 'digital' ? 'Get ebook' : 'Get this'}
          </Button>
        )}
      </div>
    </article>
  );
}

/**
 * The signed-in Rewards screen: your points and the market. Physical items and ebooks have a tab each (swipe sideways to
 * change), the list loads as you scroll, and ads appear between the cards. Your activity and orders are in Profile.
 */
export function RewardsDashboard() {
  const auth = useAuth();
  const profile = auth.profile;
  const ads = useLiveAds();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [tab, setTab] = useState<Tab>('physical');
  const [visible, setVisible] = useState(PAGE);
  const [notice, setNotice] = useState<string | null>(null);
  const [buying, setBuying] = useState<Reward | null>(null);
  const [opened, setOpened] = useState<{ title: string; url: string } | null>(null);
  const [phone, setPhone] = useState('');
  const [buyError, setBuyError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const buyTitleId = useId();
  const openedTitleId = useId();
  const sentinel = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const [balance, rewards, purchases] = await Promise.all([getBalance(), listRewards(), listMyDigitalPurchases().catch(() => [])]);
      const owned: Record<string, string> = {};
      for (const p of purchases) if (p.rewardId) owned[p.rewardId] = p.url;
      setState({ kind: 'ready', balance, rewards, owned });
    } catch (error) {
      console.error('[rewards]', error);
      setState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items = state.kind === 'ready' ? state.rewards.filter((r) => r.kind === tab) : [];

  // Load more as the student scrolls to the end of the list.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === 'undefined' || visible >= items.length) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && setVisible((v) => v + PAGE), { rootMargin: '300px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, items.length, tab]);

  function switchTab(next: Tab) {
    setTab(next);
    setVisible(PAGE);
  }

  function onTouchStart(event: TouchEvent) {
    const t = event.touches[0];
    touch.current = t ? { x: t.clientX, y: t.clientY } : null;
  }

  function onTouchEnd(event: TouchEvent) {
    const start = touch.current;
    const end = event.changedTouches[0];
    touch.current = null;
    if (!start || !end) return;
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) switchTab(dx < 0 ? 'digital' : 'physical');
  }

  function startBuying(reward: Reward) {
    setNotice(null);
    setBuyError(null);
    setPhone(profile?.phone ?? '');
    setBuying(reward);
  }

  async function confirmBuying() {
    if (!buying) return;
    setBuyError(null);
    setBusy(true);
    try {
      if (buying.kind === 'digital') {
        const book = await buyDigitalReward(buying.id);
        playCoin();
        setBuying(null);
        setOpened(book);
        await load();
        setBusy(false);
        return;
      }
      const needsPhone = !profile?.phone;
      if (needsPhone) {
        const problem = validatePhone(phone, true);
        if (problem) {
          setBuyError(problem);
          setBusy(false);
          return;
        }
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

  const { balance, owned } = state;
  const shown = weaveAds(items.slice(0, visible), ads);

  return (
    <>
      <section className="balance-hero balance-hero--compact" aria-label="Your Crumb Points">
        <p className="balance-hero__label">Your Crumb Points</p>
        <p className="balance-hero__number" aria-live="polite">
          {balance.toLocaleString()}
        </p>
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

      <div className="market-tabs" role="tablist" aria-label="Market sections">
        <button type="button" role="tab" aria-selected={tab === 'physical'} className={`market-tab ${tab === 'physical' ? 'market-tab--on' : ''}`} onClick={() => switchTab('physical')}>
          Items
        </button>
        <button type="button" role="tab" aria-selected={tab === 'digital'} className={`market-tab ${tab === 'digital' ? 'market-tab--on' : ''}`} onClick={() => switchTab('digital')}>
          Ebooks
        </button>
      </div>

      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="market-swipe">
        {items.length === 0 ? (
          <EmptyState title={tab === 'digital' ? 'No ebooks yet' : 'No items yet'}>New things are added by the Snacktic team. Check back soon.</EmptyState>
        ) : (
          <ul className="reward-grid">
            {shown.map((slot) =>
              slot.kind === 'ad' ? (
                <li key={slot.key} className="reward-grid__ad">
                  <AdCard ad={slot.ad} />
                </li>
              ) : (
                <li key={slot.item.id}>
                  <RewardCard reward={slot.item} balance={balance} ownedUrl={owned[slot.item.id]} suspended={Boolean(profile?.suspended)} onGet={startBuying} />
                </li>
              ),
            )}
          </ul>
        )}
        {visible < items.length && <div ref={sentinel} className="market-more" aria-hidden="true" />}
      </div>

      <Modal open={buying !== null} onClose={() => setBuying(null)} labelledBy={buyTitleId}>
        {buying && (
          <div className="buy-sheet">
            <h2 id={buyTitleId}>Get {buying.name}?</h2>
            <p>
              This costs <strong>{buying.costPoints.toLocaleString()} points</strong>. You'll have {(balance - buying.costPoints).toLocaleString()} left.
            </p>
            {buying.kind === 'digital' ? (
              <p className="text-secondary">You'll get the book straight away, and it stays in Profile under Activity.</p>
            ) : profile?.phone ? (
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

      <Modal open={opened !== null} onClose={() => setOpened(null)} labelledBy={openedTitleId}>
        {opened && (
          <div className="buy-sheet">
            <h2 id={openedTitleId}>It's yours!</h2>
            <p>{opened.title}</p>
            <Button onClick={() => window.open(opened.url, '_blank', 'noopener')}>Open the book</Button>
            <p className="text-secondary text-small">You can open it again any time from Profile, under Activity.</p>
            <Button variant="secondary" onClick={() => setOpened(null)}>
              Close
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}

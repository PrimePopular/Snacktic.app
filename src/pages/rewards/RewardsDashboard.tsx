import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { useAuth } from '../../features/authentication';
import { validatePhone } from '../../features/authentication/validation';
import { AdCard, useRotatedAds, weaveAds } from '../../features/ads';
import { CrossEvent } from '../../features/events';
import { CrossFeature } from '../../features/cross';
import { getBonusStatus, isOfferLive, NO_BONUS, priceOf, forgetBonusStatus } from '../../features/bonus';
import type { BonusStatus } from '../../features/bonus';
import { listDeliveryLocations, requestDeliveryLocation } from '../../features/delivery';
import type { DeliveryLocation } from '../../features/delivery';
import { buyDigitalReward, getBalance, listMyDigitalPurchases, listRewardCategories, listRewards, redeemReward } from '../../features/points';
import type { Reward, RewardCategory } from '../../features/points';
import { playCoin } from '../../services/sound';
import { Button, EmptyState, Loading, Modal, PageHeader, SelectField, TextField } from '../../shared/components';
import { CategoryChips } from './CategoryChips';
import { RewardCard } from './RewardCard';

type Tab = 'physical' | 'digital';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; balance: number; rewards: Reward[]; owned: Record<string, string>; places: DeliveryLocation[]; bonus: BonusStatus };

const PAGE = 12;

/**
 * The signed-in Rewards screen: your points and the market. Physical items and digital rewards have a tab each (swipe sideways to
 * change), the list loads as you scroll, and ads appear between the cards. Your activity and orders are in Profile.
 */
export function RewardsDashboard({ focusId }: { focusId?: string }) {
  const auth = useAuth();
  const profile = auth.profile;
  const ads = useRotatedAds('rewards');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [tab, setTab] = useState<Tab>('physical');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<RewardCategory[]>([]);
  useEffect(() => {
    void listRewardCategories().then(setCategories);
  }, []);
  const [visible, setVisible] = useState(PAGE);
  const [notice, setNotice] = useState<string | null>(null);
  const [buying, setBuying] = useState<Reward | null>(null);
  const [opened, setOpened] = useState<{ title: string; url: string } | null>(null);
  const [phone, setPhone] = useState('');
  const [buyError, setBuyError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placeId, setPlaceId] = useState('');
  const [asking, setAsking] = useState(false);
  const [askText, setAskText] = useState('');
  const [askMessage, setAskMessage] = useState<string | null>(null);
  const buyTitleId = useId();
  const openedTitleId = useId();
  const sentinel = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    try {
      forgetBonusStatus();
      const [balance, rewards, purchases, places, bonus] = await Promise.all([getBalance(), listRewards(), listMyDigitalPurchases().catch(() => []), listDeliveryLocations().catch(() => [] as DeliveryLocation[]), getBonusStatus(true)]);
      const owned: Record<string, string> = {};
      for (const p of purchases) if (p.rewardId) owned[p.rewardId] = p.url;
      setState({ kind: 'ready', balance, rewards, owned, places, bonus });
    } catch (error) {
      console.error('[rewards]', error);
      setState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const bonusInfo = state.kind === 'ready' ? state.bonus : NO_BONUS;
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focusId || focused || state.kind !== 'ready') return;
    setFocused(true);
    const reward = state.rewards.find((r) => r.id === focusId);
    if (!reward) {
      setNotice('That reward is no longer available.');
      return;
    }
    if (state.owned[reward.id]) return;
    const price = priceOf(reward);
    if (reward.stock === 0 || state.balance < price || (reward.isBonus && (!state.bonus.eligible || state.bonus.claimed.includes(reward.id) || !isOfferLive(reward)))) {
      setNotice(reward.isBonus && !state.bonus.eligible ? 'That offer is for new members.' : state.balance < price ? `You need ${(price - state.balance).toLocaleString()} more points for ${reward.name}.` : 'That reward is not available right now.');
      return;
    }
    setTab(reward.kind);
    startBuying(reward);
  }, [focusId, focused, state]); // eslint-disable-line react-hooks/exhaustive-deps

  const items =
    state.kind === 'ready'
      ? state.rewards
          .filter((r) => r.kind === tab && (categoryId === null || r.categoryId === categoryId) && (!r.isBonus || isOfferLive(r)))
          // New members see their special offers first.
          .sort((a, b) => (bonusInfo.eligible ? Number(b.isBonus) - Number(a.isBonus) : 0))
      : [];
  // With enough items, the newest few sit in a sideways rail at the top (like a shop front) and the rest follow below.
  const useRail = items.length > 8;
  const rail = useRail ? items.slice(0, 6) : [];
  const rest = useRail ? items.slice(6) : items;

  // Load more as the student scrolls to the end of the list.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === 'undefined' || visible >= rest.length) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && setVisible((v) => v + PAGE), { rootMargin: '300px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, rest.length, tab]);

  function switchTab(next: Tab) {
    setTab(next);
    setVisible(PAGE);
  }

  function onTouchStart(event: TouchEvent) {
    // Scrolling the "Just added" rail sideways must not switch the tab.
    if ((event.target as HTMLElement).closest?.('.market-rail')) {
      touch.current = null;
      return;
    }
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
    setPlaceId(state.kind === 'ready' ? (state.places[0]?.id ?? '') : '');
    setAsking(false);
    setAskMessage(null);
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
      if (!placeId) {
        setBuyError('Delivery is not available right now. You can ask for a new place below.');
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
      await redeemReward(buying.id, placeId);
      playCoin();
      setNotice(`Order placed for "${buying.name}"! A Snacktic agent will message you on WhatsApp to arrange delivery.`);
      setBuying(null);
      await load();
    } catch (error) {
      setBuyError(error instanceof Error ? error.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  async function sendAsk() {
    setAskMessage(null);
    try {
      await requestDeliveryLocation(askText, '');
      setAskMessage('Thank you! We have noted it. The team will consider adding it.');
      setAskText('');
      setAsking(false);
    } catch (error) {
      setAskMessage(error instanceof Error ? error.message : 'Something went wrong.');
    }
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

  const { balance, owned, places, bonus } = state;
  const shown = weaveAds(rest.slice(0, visible), ads);

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
          Digital
        </button>
      </div>

      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="market-swipe">
        {state.kind === 'ready' && <CategoryChips categories={categories} rewards={state.rewards.filter((r) => r.kind === tab)} selected={categoryId} onSelect={setCategoryId} />}
      {items.length === 0 ? (
          <EmptyState title={tab === 'digital' ? 'No digital rewards yet' : 'No items yet'}>New things are added by the Snacktic team. Check back soon.</EmptyState>
        ) : (
          <>
            {rail.length > 0 && (
              <section aria-labelledby="rail-heading">
                <h2 id="rail-heading" className="market-heading">
                  Just added
                </h2>
                <ul className="market-rail">
                  {rail.map((reward) => (
                    <li key={reward.id}>
                      <RewardCard reward={reward} balance={balance} ownedUrl={owned[reward.id]} suspended={Boolean(profile?.suspended)} eligible={bonus.eligible} claimed={bonus.claimed.includes(reward.id)} onGet={startBuying} />
                    </li>
                  ))}
                </ul>
                <h2 className="market-heading">More to get</h2>
              </section>
            )}
          <ul className="reward-grid">
            {shown.map((slot) =>
              slot.kind === 'ad' ? (
                <li key={slot.key} className="reward-grid__ad">
                  <AdCard ad={slot.ad} />
                </li>
              ) : (
                <li key={slot.item.id}>
                  <RewardCard reward={slot.item} balance={balance} ownedUrl={owned[slot.item.id]} suspended={Boolean(profile?.suspended)} eligible={bonus.eligible} claimed={bonus.claimed.includes(slot.item.id)} onGet={startBuying} />
                </li>
              ),
            )}
          </ul>
          </>
        )}
        {visible < rest.length && <div ref={sentinel} className="market-more" aria-hidden="true" />}
      </div>

      <CrossEvent chance={0.4} />

      <CrossFeature section="rewards" />

      <Modal open={buying !== null} onClose={() => setBuying(null)} labelledBy={buyTitleId}>
        {buying && (
          <div className="buy-sheet">
            <h2 id={buyTitleId}>Get {buying.name}?</h2>
            <p>
              This costs <strong>{priceOf(buying).toLocaleString()} points</strong>
              {buying.isBonus && <> (instead of {buying.costPoints.toLocaleString()})</>}. You'll have {(balance - priceOf(buying)).toLocaleString()} left.
            </p>
            {buying.kind === 'digital' ? (
              <p className="text-secondary">You'll get it straight away, and it stays in Profile under Activity.</p>
            ) : (
              <>
                <p className="delivery-note">
                  <strong>Delivery is only available at: {places.length > 0 ? places.map((p) => p.name).join(', ') : 'no places right now'}.</strong> Orders to other places can't be accepted yet.
                </p>
                {places.length > 1 && (
                  <SelectField label="Deliver to" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
                    {places.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </SelectField>
                )}
                {profile?.phone ? (
                  <p className="text-secondary">A Snacktic agent will message you on WhatsApp ({profile.phone}) to arrange delivery.</p>
                ) : (
                  <>
                    <p className="text-secondary">Add your WhatsApp number so a Snacktic agent can reach you to arrange delivery.</p>
                    <TextField label="WhatsApp number" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={25} autoComplete="tel" hint="Start with 0 or +234. We add the Nigeria code (+234) for you." />
                  </>
                )}
                {asking ? (
                  <div className="delivery-ask">
                    <TextField label="Which place do you want delivery to?" value={askText} onChange={(e) => setAskText(e.target.value)} maxLength={120} />
                    <Button variant="secondary" disabled={askText.trim().length < 2} onClick={() => void sendAsk()}>
                      Send request
                    </Button>
                  </div>
                ) : (
                  <button type="button" className="link-button" onClick={() => setAsking(true)}>
                    My place isn't listed
                  </button>
                )}
                {askMessage && (
                  <p className="text-small" role="status">
                    {askMessage}
                  </p>
                )}
              </>
            )}
            {buyError && (
              <p className="form-error" role="alert">
                {buyError}
              </p>
            )}
            <div className="buy-sheet__actions">
              <Button disabled={busy} onClick={() => void confirmBuying()}>
                {busy ? 'One moment…' : `Yes, spend ${priceOf(buying).toLocaleString()} points`}
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
            <Button onClick={() => window.open(opened.url, '_blank', 'noopener')}>Open it</Button>
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

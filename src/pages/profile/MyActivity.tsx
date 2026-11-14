import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { kindLabels, listHistory, listMyDigitalPurchases, listMyRedemptions } from '../../features/points';
import type { DigitalPurchase, PointsTransaction, Redemption } from '../../features/points';
import { Button, Card } from '../../shared/components';

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const statusLabel: Record<Redemption['status'], string> = {
  pending: 'Waiting for the team to contact you',
  fulfilled: 'Handed over',
  cancelled: 'Cancelled and refunded',
};

/** Points activity, orders and ebooks. Each part opens on tap and loads only then, so Profile stays short and quick. */
export function MyActivity() {
  const [history, setHistory] = useState<PointsTransaction[] | null>(null);
  const [orders, setOrders] = useState<Redemption[] | null>(null);
  const [books, setBooks] = useState<DigitalPurchase[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function opened(event: SyntheticEvent<HTMLDetailsElement>) {
    return event.currentTarget.open;
  }

  function fail(err: unknown) {
    console.error('[profile] activity', err);
    setError('Could not load this. Check your connection and try again.');
  }

  return (
    <Card className="account-section my-activity">
      <h3>My activity</h3>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <details onToggle={(e) => opened(e) && history === null && void listHistory().then(setHistory).catch(fail)}>
        <summary>Points activity</summary>
        {history === null ? (
          <p className="text-secondary">Loading…</p>
        ) : history.length === 0 ? (
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
      </details>

      <details onToggle={(e) => opened(e) && orders === null && void listMyRedemptions().then(setOrders).catch(fail)}>
        <summary>My orders</summary>
        {orders === null ? (
          <p className="text-secondary">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="text-secondary">No orders yet. Items you get in Rewards show here until they are handed over.</p>
        ) : (
          <ul className="activity-list">
            {orders.map((r) => (
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
        )}
      </details>

      <details onToggle={(e) => opened(e) && books === null && void listMyDigitalPurchases().then(setBooks).catch(fail)}>
        <summary>My ebooks</summary>
        {books === null ? (
          <p className="text-secondary">Loading…</p>
        ) : books.length === 0 ? (
          <p className="text-secondary">No ebooks yet. Get one in Rewards, under Ebooks.</p>
        ) : (
          <ul className="activity-list">
            {books.map((b) => (
              <li key={b.url} className="activity-row">
                <div>
                  <p className="activity-row__title">{b.title}</p>
                  <p className="text-xs text-secondary">{dateFormat.format(new Date(b.createdAt))}</p>
                </div>
                <Button onClick={() => window.open(b.url, '_blank', 'noopener')}>Open</Button>
              </li>
            ))}
          </ul>
        )}
      </details>
    </Card>
  );
}

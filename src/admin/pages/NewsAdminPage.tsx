import { useCallback, useEffect, useState } from 'react';
import { adminListNews, deleteNews, setNewsHidden, sourceLabels } from '../../features/news';
import type { AdminNews } from '../../features/news';
import { Button, Card, EmptyState, Loading } from '../../shared/components';

const when = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * News is fetched automatically (see docs/NEWS_SOURCES.md), so nobody writes it here. This page shows what was fetched, and lets
 * you hide a story from students or delete it.
 */
export function NewsAdminPage() {
  const [items, setItems] = useState<AdminNews[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await adminListNews());
    } catch (e) {
      setItems([]);
      setMessage(e instanceof Error ? `${e.message}. Has supabase/025 been run?` : 'Something went wrong.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby="news-heading" className="ann">
      <h1 id="news-heading">News</h1>
      <p className="text-secondary">Trending stories are fetched for you automatically and ranked by popularity. Students see the best ones in the News tab of Discover, and one or two on Home. You can hide or delete any story.</p>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      {!items ? (
        <Loading label="Loading news" />
      ) : items.length === 0 ? (
        <EmptyState title="No stories yet">
          Nothing has been fetched. To switch the news on, follow the steps in docs/NEWS_SOURCES.md (run supabase/025, add the fetch-news function, and give it a YouTube key). Until then students do not see a News tab.
        </EmptyState>
      ) : (
        <ul className="ann__list">
          {items.map((n) => (
            <li key={n.id}>
              <Card as="article" className="ann__item">
                <div className="ann__meta">
                  <span className="badge">{sourceLabels[n.source]}</span>
                  <span className={n.hidden ? 'badge badge--minor' : 'badge'}>{n.hidden ? 'Hidden' : 'Showing'}</span>
                  <span className="text-xs text-secondary">
                    {when.format(new Date(n.publishedAt))} · rank {Math.round(n.score)}
                  </span>
                </div>
                <h2>{n.title}</h2>
                <p className="text-small text-secondary">{n.sourceName}</p>
                <div className="ann__actions">
                  <Button variant="secondary" disabled={busy} onClick={() => void run(() => setNewsHidden(n.id, !n.hidden))}>
                    {n.hidden ? 'Show again' : 'Hide'}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm('Delete this story?')) void run(() => deleteNews(n.id));
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

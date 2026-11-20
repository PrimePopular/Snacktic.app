import { useCallback, useEffect, useState } from 'react';
import { BillboardCard, listBillboards, PAGE_SIZE } from '../../features/billboards';
import type { BillboardPost } from '../../features/billboards';
import { CrossBonus } from '../../features/bonus';
import { CrossFeature } from '../../features/cross';
import { Button, EmptyState, Loading, PageHeader } from '../../shared/components';

/**
 * Billboards: a free discovery feed. Not events, not ads. Posts have different layouts, featured ones come first, and the
 * feed loads a page at a time so it stays quick on a phone.
 */
export default function BillboardsPage() {
  const [posts, setPosts] = useState<BillboardPost[] | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFirst = useCallback(async () => {
    setPosts(null);
    const first = await listBillboards(0);
    setPosts(first);
    setPage(0);
    setMore(first.length === PAGE_SIZE);
  }, []);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  async function loadNext() {
    setLoadingMore(true);
    const next = await listBillboards(page + 1);
    setPosts((current) => [...(current ?? []), ...next.filter((n) => !(current ?? []).some((c) => c.id === n.id))]);
    setPage(page + 1);
    setMore(next.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  return (
    <>
      <PageHeader title="Billboards" description="Music, creators, stories, recommendations and other things worth a look." />
      {!posts ? (
        <Loading label="Loading Billboards" />
      ) : posts.length === 0 ? (
        <EmptyState title="Nothing on the Billboards yet" action={<Button onClick={() => void loadFirst()}>Refresh</Button>}>
          New posts show up here. Check back soon.
        </EmptyState>
      ) : (
        <>
          <ul className="billboard-feed">
            {posts.map((post) => (
              <li key={post.id}>
                <BillboardCard post={post} />
              </li>
            ))}
          </ul>
          {more && (
            <p>
              <Button variant="secondary" disabled={loadingMore} onClick={() => void loadNext()}>
                {loadingMore ? 'Loading…' : 'Show more'}
              </Button>
            </p>
          )}
        </>
      )}
      <CrossFeature section="billboards" />
      <CrossBonus section="home" />
    </>
  );
}

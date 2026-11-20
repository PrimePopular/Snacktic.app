import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '../../core/router';
import { BillboardCard } from './BillboardCard';
import { listBillboards, PAGE_SIZE } from './billboardsService';
import type { BillboardPost } from './billboards.types';

const shuffle = <T,>(list: T[]): T[] => [...list].sort(() => Math.random() - 0.5);

/**
 * Billboard posts, one after another, on the Home feed: a page at a time, mixed up each visit, loading the next page as the
 * student scrolls near the end, so Home never runs dry. Each post keeps its BILLBOARD tag. Nothing shows if there are no posts.
 */
export function BillboardStream() {
  const [posts, setPosts] = useState<BillboardPost[]>([]);
  const [page, setPage] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    const next = await listBillboards(page);
    setPosts((current) => [...current, ...shuffle(next.filter((n) => !current.some((c) => c.id === n.id)))]);
    setPage((p) => p + 1);
    if (next.length < PAGE_SIZE) setDone(true);
    setLoading(false);
  }, [loading, done, page]);

  useEffect(() => {
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), { rootMargin: '600px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, done]);

  if (posts.length === 0) return null;
  return (
    <section className="billboard-stream" aria-label="From Billboards">
      <ul className="billboard-feed">
        {posts.map((post) => (
          <li key={post.id}>
            <BillboardCard post={post} />
          </li>
        ))}
      </ul>
      {!done && <div ref={sentinel} aria-hidden="true" style={{ height: 1 }} />}
      {done && (
        <p className="billboard-stream__end text-secondary">
          You are all caught up. <Link to="/billboards">Open Billboards</Link>
        </p>
      )}
    </section>
  );
}

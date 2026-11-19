import { useEffect, useState } from 'react';
import { BillboardCard } from './BillboardCard';
import { featuredBillboard } from './billboardsService';
import type { BillboardPost } from './billboards.types';

/** Now and then, a featured Billboard post shows on Home. It keeps its BILLBOARD tag, so it is never mistaken for an ad or event. */
export function CrossBillboard() {
  const [post, setPost] = useState<BillboardPost | null>(null);
  useEffect(() => {
    let active = true;
    if (Math.random() > 0.7) return;
    void featuredBillboard().then((p) => active && setPost(p));
    return () => {
      active = false;
    };
  }, []);
  if (!post) return null;
  return (
    <section className="cross-bonus" aria-label="From Billboards">
      <BillboardCard post={post} />
    </section>
  );
}

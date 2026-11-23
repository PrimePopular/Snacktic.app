import { useEffect, useState } from 'react';
import { Link } from '../../core/router';
import { classicGames } from '../../games/registry';
import { BillboardCard, listBillboards } from '../billboards';
import type { BillboardPost } from '../billboards';
import { CardArt } from '../feed';
import { PlaceCard, listLivePlaces } from '../places';
import type { Place } from '../places';
import { listRewards } from '../points';
import type { Reward } from '../points';
import { pictureUrl } from '../../services/pictures';
import { getCrossMatrix } from './crossSettings';
import type { CrossKind as Kind, CrossSection } from './crossSettings';
import './cross.css';

type Pick = { kind: 'reward'; reward: Reward } | { kind: 'place'; place: Place } | { kind: 'billboard'; post: BillboardPost } | { kind: 'game'; id: string; title: string; summary: string };
const random = <T,>(list: T[]): T | undefined => list[Math.floor(Math.random() * list.length)];

async function choose(kind: Kind): Promise<Pick | null> {
  if (kind === 'reward') {
    const reward = random((await listRewards()).filter((r) => !r.isBonus && (r.stock === null || r.stock > 0)));
    return reward ? { kind, reward } : null;
  }
  if (kind === 'place') {
    const place = random(await listLivePlaces());
    return place ? { kind, place } : null;
  }
  if (kind === 'billboard') {
    const post = random(await listBillboards(0));
    return post ? { kind, post } : null;
  }
  const game = random(classicGames);
  return game ? { kind, id: game.id, title: game.title, summary: game.summary } : null;
}

/**
 * Lets a little of everything show up in every section, so no screen feels thin: rewards in Discover, places in Games, Billboards
 * in Rewards, and so on. Every card keeps its own label (REWARD, PLACES TO VISIT, BILLBOARD, GAME) so nothing is mistaken for
 * something else.
 */
export function CrossFeature({ section, count = 1 }: { section: CrossSection; count?: number }) {
  const [picks, setPicks] = useState<Pick[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const matrix = await getCrossMatrix();
      const kinds = [...matrix[section]].sort(() => Math.random() - 0.5).slice(0, count);
      const found = (await Promise.all(kinds.map((k) => choose(k).catch(() => null)))).filter((p): p is Pick => p !== null);
      if (active) setPicks(found);
    })();
    return () => {
      active = false;
    };
  }, [section, count]);

  if (picks.length === 0) return null;
  return (
    <section className="cross-feature" aria-label="You might like">
      {picks.map((p) => {
        if (p.kind === 'place') return <PlaceCard key={`p-${p.place.id}`} place={p.place} />;
        if (p.kind === 'billboard') return <BillboardCard key={`b-${p.post.id}`} post={p.post} />;
        if (p.kind === 'game')
          return (
            <Link key={`g-${p.id}`} to={`/games/${p.id}`} className="cross-teaser cross-teaser--game">
              <span className="content-tag content-tag--game cross-teaser__tag">GAME</span>
              <strong>{p.title}</strong>
              <span>{p.summary}</span>
              <span className="cross-teaser__cta">Play and earn Crumb Points</span>
            </Link>
          );
        return (
          <Link key={`r-${p.reward.id}`} to={`/rewards/${p.reward.id}`} className="cross-teaser cross-teaser--reward">
            <span className="content-tag content-tag--reward cross-teaser__tag">REWARD</span>
            <span className="cross-teaser__media">{p.reward.imagePath ? <img src={pictureUrl(p.reward.imagePath)} alt="" loading="lazy" /> : <CardArt />}</span>
            <strong>{p.reward.name}</strong>
            <span>{p.reward.costPoints.toLocaleString()} Crumb Points</span>
            <span className="cross-teaser__cta">See it in Rewards</span>
          </Link>
        );
      })}
    </section>
  );
}

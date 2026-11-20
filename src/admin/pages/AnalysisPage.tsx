import { useEffect, useState } from 'react';
import { listAllAds } from '../../features/ads';
import type { Ad } from '../../features/ads';
import { getFriendStats, getGameStats, getOverview, getRewardStats, getTopPlayers } from '../../features/points';
import type { FriendStat, GameStat, Overview, RewardStat, TopPlayer } from '../../features/points';
import { Card, EmptyState, Loading, SelectField } from '../../shared/components';
import { AdAnalyticsPanel } from './AdAnalyticsPanel';
import { PointsAnalysisPage } from './PointsAnalysisPage';

type Tab = 'overview' | 'games' | 'ads' | 'points' | 'rewards' | 'friends';
const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'games', label: 'Games' },
  { id: 'ads', label: 'Ads' },
  { id: 'points', label: 'Points' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'friends', label: 'Find a Friend' },
];
const n = (v: number) => v.toLocaleString();

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card as="div">
      <p className="text-xs text-secondary">{label}</p>
      <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', margin: 0 }}>{value}</p>
      {note && <p className="text-xs text-secondary">{note}</p>}
    </Card>
  );
}

/** Wraps a block that loads once, with a friendly message if the database update has not been run yet. */
function useLoad<T>(load: () => Promise<T>, deps: unknown[]): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    load()
      .then((d) => active && setData(d))
      .catch((e: unknown) => active && setError(e instanceof Error ? `${e.message}. Has supabase/028 been run?` : 'Something went wrong.'));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error };
}

const Problem = ({ text }: { text: string }) => (
  <p className="form-error" role="alert">
    {text}
  </p>
);

function OverviewTab() {
  const { data, error } = useLoad<Overview>(getOverview, []);
  if (error) return <Problem text={error} />;
  if (!data) return <Loading label="Loading" />;
  return (
    <div className="analysis-grid">
      <Stat label="Students" value={n(data.students)} note={`${n(data.new7d)} joined in the last 7 days`} />
      <Stat label="Active right now" value={n(data.active15m)} note="Played or earned in the last 15 minutes" />
      <Stat label="Active in the last 24 hours" value={n(data.active24h)} />
      <Stat label="Game plays, last 24 hours" value={n(data.plays24h)} />
      <Stat label="Points earned, last 24 hours" value={n(data.pointsEarned24h)} />
      <Stat label="Points spent, last 24 hours" value={n(data.pointsSpent24h)} />
      <Stat label="Reward orders, last 7 days" value={n(data.orders7d)} />
      <Stat label="Friends invited, last 7 days" value={n(data.friends7d)} />
    </div>
  );
}

function GamesTab() {
  const [days, setDays] = useState('30');
  const stats = useLoad<GameStat[]>(() => getGameStats(Number(days)), [days]);
  const top = useLoad<TopPlayer[]>(() => getTopPlayers(Number(days)), [days]);
  return (
    <>
      <SelectField label="Period" value={days} onChange={(e) => setDays(e.target.value)}>
        <option value="1">Last 24 hours</option>
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
      </SelectField>
      {stats.error && <Problem text={stats.error} />}
      {!stats.data && !stats.error && <Loading label="Loading games" />}
      {stats.data && stats.data.length === 0 && <EmptyState title="No games played in this period">Plays show up here once students finish a game while signed in.</EmptyState>}
      {stats.data && stats.data.length > 0 && (
        <ul className="activity-list">
          {stats.data.map((g) => (
            <li key={`${g.gameId}-${g.mode}`} className="activity-row">
              <strong>
                {g.gameId}
                {g.mode !== 'default' ? ` · ${g.mode}` : ''}
              </strong>
              <span className="text-xs text-secondary">
                {n(g.plays)} plays · {n(g.players)} players · {n(g.playsToday)} today · {n(g.playersNow)} playing in the last 15 min · average score {g.avgScore} · best {n(g.bestScore)} · {n(g.pointsPaid)} points paid
              </span>
            </li>
          ))}
        </ul>
      )}
      {top.data && top.data.length > 0 && (
        <>
          <h3>Most active players in each game</h3>
          <ul className="activity-list">
            {top.data.map((p, i) => (
              <li key={`${p.gameId}-${p.username}-${i}`} className="activity-row">
                <span>
                  <strong>{p.gameId}</strong> · {p.username}
                </span>
                <span className="text-xs text-secondary">
                  {n(p.plays)} plays · {n(p.points)} points
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function AdsTab() {
  const { data, error } = useLoad<Ad[]>(listAllAds, []);
  if (error) return <Problem text={error} />;
  if (!data) return <Loading label="Loading ads" />;
  if (data.length === 0) return <EmptyState title="No ads yet">Create an ad under Ads and its results show up here.</EmptyState>;
  return <AdAnalyticsPanel ads={data} />;
}

function RewardsTab() {
  const [days, setDays] = useState('30');
  const { data, error } = useLoad<RewardStat[]>(() => getRewardStats(Number(days)), [days]);
  return (
    <>
      <SelectField label="Period" value={days} onChange={(e) => setDays(e.target.value)}>
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
        <option value="365">Last year</option>
      </SelectField>
      {error && <Problem text={error} />}
      {!data && !error && <Loading label="Loading" />}
      {data && data.length === 0 && <EmptyState title="Nothing redeemed in this period">Orders and digital purchases show up here.</EmptyState>}
      {data && data.length > 0 && (
        <ul className="activity-list">
          {data.map((r) => (
            <li key={`${r.name}-${r.kind}`} className="activity-row">
              <strong>{r.name}</strong>
              <span className="text-xs text-secondary">
                {r.kind === 'digital' ? 'Digital' : 'Physical'} · {n(r.redemptions)} redeemed · {n(r.students)} students · {n(r.pointsSpent)} points spent
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function FriendsTab() {
  const { data, error } = useLoad<FriendStat[]>(getFriendStats, []);
  if (error) return <Problem text={error} />;
  if (!data) return <Loading label="Loading" />;
  if (data.length === 0) return <EmptyState title="No Find a Friend events yet">Start one under Find a Friend.</EmptyState>;
  return (
    <ul className="activity-list">
      {data.map((f, i) => (
        <li key={`${f.campaign}-${i}`} className="activity-row">
          <strong>{f.campaign}</strong>
          <span className="text-xs text-secondary">
            {n(f.invites)} friends invited · {n(f.inviters)} inviters · {n(f.pointsPaid)} points paid
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * One place for everything: the numbers right now, games (who plays what), ads, points (with the flag rule for cheating),
 * rewards and Find a Friend. Owner only. Only nicknames are shown.
 */
export function AnalysisPage() {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <section aria-labelledby="an-heading">
      <h1 id="an-heading">Analysis</h1>
      <div className="market-tabs" role="tablist" aria-label="Analysis sections">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`market-tab ${tab === t.id ? 'market-tab--on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <OverviewTab />}
      {tab === 'games' && <GamesTab />}
      {tab === 'ads' && <AdsTab />}
      {tab === 'points' && <PointsAnalysisPage embedded />}
      {tab === 'rewards' && <RewardsTab />}
      {tab === 'friends' && <FriendsTab />}
    </section>
  );
}

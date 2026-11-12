import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdCard, listLiveAds, NudgeCard, nudges } from '../../features/ads';
import type { Ad, Nudge } from '../../features/ads';
import { listLiveAnnouncements } from '../../features/announcements';
import { WeatherCard } from '../../features/weather';
import type { Announcement } from '../../features/announcements';
import { EventCard, listCategories, listUpcomingEvents } from '../../features/events';
import type { EventCategory, EventItem } from '../../features/events';
import { listLivePlaces, PlaceCard } from '../../features/places';
import type { Place } from '../../features/places';
import { getAffinities, rankForHome } from '../../features/recommendations';
import { Link } from '../../core/router';
import { isDatabaseConfigured } from '../../services/database';
import { OfflineNotice } from '../../pwa/OfflineNotice';
import { Button, EmptyState, PageHeader, SkeletonCards } from '../../shared/components';
import { MajorBar } from './MajorBar';
import './home.css';

const DISMISSED_KEY = 'snacktic.dismissedMajor';

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function saveDismissed(ids: string[]) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
  } catch {
    /* storage can be unavailable (private mode); the bar simply returns next visit */
  }
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      major: Announcement[];
      events: EventItem[];
      places: Place[];
      ads: Ad[];
      eventCategories: EventCategory[];
      placeCategories: EventCategory[];
    };

/** One card in the feed: an event or a place, ready to be ranked. */
interface FeedEntry {
  id: string;
  categoryId: number | null;
  startsAt?: string;
  event?: EventItem;
  place?: Place;
}

type FeedSlot =
  | { kind: 'entry'; entry: FeedEntry }
  | { kind: 'ad'; ad: Ad; key: string }
  | { kind: 'nudge'; nudge: Nudge; key: string };

/**
 * Mixes ads and nudge cards into the ranked feed. An ad goes in after the 3rd card and then after
 * every 5th card after that, so an ad is never first, never second and never next to another ad.
 * A nudge card goes in after the 6th card and every 5th after that, so it never touches an ad
 * either. Ads and nudges take turns through their lists.
 */
function weave(entries: FeedEntry[], allAds: Ad[]): FeedSlot[] {
  // A fresh random order each time the feed loads, so ads come round in a different order and a
  // student with only a few ads will see the same one again now and then. Points are paid once per ad.
  const ads = [...allAds];
  for (let i = ads.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ads[i], ads[j]] = [ads[j], ads[i]];
  }
  const slots: FeedSlot[] = [];
  let adIndex = 0;
  let nudgeIndex = 0;
  entries.forEach((entry, i) => {
    slots.push({ kind: 'entry', entry });
    const n = i + 1;
    if (ads.length > 0 && n >= 3 && (n - 3) % 5 === 0) {
      slots.push({ kind: 'ad', ad: ads[adIndex % ads.length], key: `ad-${n}` });
      adIndex += 1;
    } else if (n >= 6 && (n - 6) % 5 === 0) {
      slots.push({ kind: 'nudge', nudge: nudges[nudgeIndex % nudges.length], key: `nudge-${n}` });
      nudgeIndex += 1;
    }
  });
  return slots;
}

/**
 * Home: a feed to scroll through. Only a major announcement is pinned on top, as a slim bar;
 * everything else lives in Discover. Events are the first cards in the feed. Discoveries, games
 * and rewards cards join it as those sections are built. All content comes from the admin panel.
 */
export default function HomePage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const [announcements, events, places, ads, eventCategories, placeCategories] = await Promise.all([
        listLiveAnnouncements(),
        listUpcomingEvents(),
        listLivePlaces(),
        // Ads are optional: if they cannot load, the rest of the feed still works.
        listLiveAds().catch((error: unknown) => {
          console.error('[home] ads', error);
          return [] as Ad[];
        }),
        listCategories('event'),
        listCategories('place'),
      ]);
      setState({
        kind: 'ready',
        major: announcements.filter((a) => a.level === 'major'),
        events,
        places,
        ads,
        eventCategories,
        placeCategories,
      });
    } catch (error) {
      console.error('[home] feed', error);
      setState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    if (isDatabaseConfigured) void load();
  }, [load]);

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    saveDismissed(next);
  }

  // Order the feed once per load. New students see events in the order they happen; the feed
  // adapts as they open and contact events. Discover always shows everything.
  const ordered = useMemo(() => {
    if (state.kind !== 'ready') return [];
    const entries: FeedEntry[] = [
      ...state.events.map((event): FeedEntry => ({ id: event.id, categoryId: event.categoryId, startsAt: event.startsAt, event })),
      ...state.places.map((place): FeedEntry => ({ id: place.id, categoryId: place.categoryId, place })),
    ];
    return weave(rankForHome(entries, getAffinities(), Date.now()), state.ads);
  }, [state]);

  if (!isDatabaseConfigured) {
    return (
      <>
        <PageHeader title="Home" />
        <EmptyState title="The database isn't connected yet">
          Add your Supabase keys to .env.local and restart the app. Steps are in docs/SUPABASE_SETUP.md.
        </EmptyState>
      </>
    );
  }

  const majors = state.kind === 'ready' ? state.major.filter((a) => !dismissed.includes(a.id)) : [];

  return (
    <>
      {majors.map((item) => (
        <MajorBar key={item.id} item={item} onDismiss={dismiss} />
      ))}

      <PageHeader
        tone="orange"
        title="Home"
        description="What's happening around campus."
      />

      <OfflineNotice />

      <WeatherCard />

      {state.kind === 'loading' && <SkeletonCards label="Loading your feed" />}

      {state.kind === 'error' && (
        <EmptyState title="We couldn't load your feed" action={<Button onClick={() => void load()}>Try again</Button>}>
          Check your connection and try again.
        </EmptyState>
      )}

      {state.kind === 'ready' && ordered.length === 0 && (
        <EmptyState title="Nothing on right now">
          Events and places to try will show up here as soon as they're added.
        </EmptyState>
      )}

      {state.kind === 'ready' && ordered.length > 0 && (
        <>
          <h2 className="home-section">For you</h2>
          <ul className="home-feed">
            {ordered.map((slot) => {
              if (slot.kind === 'ad') return <li key={slot.key}><AdCard ad={slot.ad} /></li>;
              if (slot.kind === 'nudge') return <li key={slot.key}><NudgeCard nudge={slot.nudge} /></li>;
              const entry = slot.entry;
              return (
                <li key={entry.id}>
                  {entry.event && (
                    <EventCard event={entry.event} category={state.eventCategories.find((c) => c.id === entry.categoryId)} />
                  )}
                  {entry.place && (
                    <PlaceCard place={entry.place} category={state.placeCategories.find((c) => c.id === entry.categoryId)} />
                  )}
                </li>
              );
            })}
          </ul>
          <p className="home-more">
            <Link to="/discover">See everything in Discover</Link>
          </p>
        </>
      )}
    </>
  );
}

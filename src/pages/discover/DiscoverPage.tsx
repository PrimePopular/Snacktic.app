import { useCallback, useEffect, useId, useState } from 'react';
import { levelLabels, listLiveAnnouncements } from '../../features/announcements';
import type { Announcement } from '../../features/announcements';
import { EventCard, listCategories, listUpcomingEvents } from '../../features/events';
import type { EventCategory, EventItem } from '../../features/events';
import { listLivePlaces, PlaceCard } from '../../features/places';
import type { Place } from '../../features/places';
import { isSaved, recordInterest } from '../../features/recommendations';
import { listLiveShops, ShopCard } from '../../features/shops';
import type { Shop } from '../../features/shops';
import { isDatabaseConfigured } from '../../services/database';
import { pictureUrl } from '../../services/pictures';
import { OfflineNotice } from '../../pwa/OfflineNotice';
import { Button, EmptyState, Modal, PageHeader, SkeletonCards, TextField } from '../../shared/components';
import { distanceLabel, distanceMetres } from '../../shared/url';
import './discover.css';

type Section = 'events' | 'places' | 'shops' | 'news';
type Filter = number | 'all' | 'saved';
type DateFilter = 'any' | 'today' | 'tomorrow' | 'weekend';

const DAY = 86_400_000;
const dateLabels: Record<DateFilter, string> = { any: 'Any time', today: 'Today', tomorrow: 'Tomorrow', weekend: 'This weekend' };

function overlaps(event: EventItem, from: number, to: number): boolean {
  return Date.parse(event.startsAt) < to && Date.parse(event.expiresAt) > from;
}

/** Does the event happen (at least partly) on the chosen day or weekend? */
function matchesDate(event: EventItem, filter: DateFilter, now: Date = new Date()): boolean {
  if (filter === 'any') return true;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (filter === 'today') return overlaps(event, today, today + DAY);
  if (filter === 'tomorrow') return overlaps(event, today + DAY, today + 2 * DAY);
  // Weekend: the coming Saturday and Sunday, or the current ones if today is part of the weekend.
  const weekday = now.getDay(); // 0 = Sunday ... 6 = Saturday
  const saturday = today + (weekday === 0 ? -1 : 6 - weekday) * DAY;
  return overlaps(event, saturday, saturday + 2 * DAY);
}

function matchesSearch(text: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return needle === '' || text.toLowerCase().includes(needle);
}
type LoadState<T> = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: T };

const postedFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

interface FilterProps {
  categories: EventCategory[];
  usedIds: Set<number | null>;
  hasSaved: boolean;
  value: Filter;
  onChange: (value: Filter) => void;
  /** Events only: also filter by day. */
  dateValue?: DateFilter;
  onDateChange?: (value: DateFilter) => void;
}

function FilterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

/**
 * One Filter button instead of a row of tags. It opens a sheet with everything, saved items and each
 * category. Choosing a category also teaches the Home feed what the student likes.
 */
function FilterButton({ categories, usedIds, hasSaved, value, onChange, dateValue = 'any', onDateChange }: FilterProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const options = categories.filter((c) => usedIds.has(c.id));
  if (options.length < 2 && !hasSaved && !onDateChange) return null;

  const categoryLabel =
    value === 'all' ? null : value === 'saved' ? 'Liked' : (categories.find((c) => c.id === value)?.name ?? null);
  const dayLabel = dateValue === 'any' ? null : dateLabels[dateValue];
  const currentLabel = [categoryLabel, dayLabel].filter(Boolean).join(' · ') || null;

  function choose(next: Filter) {
    onChange(next);
    if (typeof next === 'number') recordInterest(next, 1);
  }

  return (
    <div className="filter-bar">
      <button type="button" className={`filter-button ${currentLabel ? 'filter-button--active' : ''}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <FilterIcon />
        {currentLabel ? `Filter: ${currentLabel}` : 'Filter'}
      </button>
      {currentLabel && (
        <button
          type="button"
          className="link-button"
          onClick={() => {
            onChange('all');
            onDateChange?.('any');
          }}
        >
          Clear
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} labelledBy={titleId}>
        <div className="filter-sheet">
          <h2 id={titleId}>Show me</h2>
          {onDateChange && (
            <div className="filter-sheet__options" role="group" aria-label="When">
              {(Object.keys(dateLabels) as DateFilter[]).map((d) => (
                <button key={d} type="button" aria-pressed={dateValue === d} onClick={() => onDateChange(d)}>
                  {dateLabels[d]}
                </button>
              ))}
            </div>
          )}
          <div className="filter-sheet__options" role="group" aria-label="Filter options">
            <button type="button" aria-pressed={value === 'all'} onClick={() => choose('all')}>
              Everything
            </button>
            {hasSaved && (
              <button type="button" aria-pressed={value === 'saved'} onClick={() => choose('saved')}>
                Liked by me
              </button>
            )}
            {options.map((c) => (
              <button key={c.id} type="button" aria-pressed={value === c.id} onClick={() => choose(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </div>
      </Modal>
    </div>
  );
}

/**
 * Discover: everything, unfiltered unless the student chooses a filter. Events, Places and News.
 * Products and Shops join as those are built. All content comes from the admin panel.
 */
export default function DiscoverPage() {
  const [section, setSection] = useState<Section>('events');
  const [events, setEvents] = useState<LoadState<{ items: EventItem[]; categories: EventCategory[] }>>({ kind: 'loading' });
  const [places, setPlaces] = useState<LoadState<{ items: Place[]; categories: EventCategory[] }>>({ kind: 'loading' });
  const [shops, setShops] = useState<LoadState<Shop[]>>({ kind: 'loading' });
  const [here, setHere] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hereMessage, setHereMessage] = useState('');
  const [news, setNews] = useState<LoadState<Announcement[]>>({ kind: 'loading' });
  const [eventFilter, setEventFilter] = useState<Filter>('all');
  const [placeFilter, setPlaceFilter] = useState<Filter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('any');
  const [query, setQuery] = useState('');

  const loadEvents = useCallback(async () => {
    setEvents({ kind: 'loading' });
    try {
      const [items, categories] = await Promise.all([listUpcomingEvents(), listCategories('event')]);
      setEvents({ kind: 'ready', data: { items, categories } });
    } catch (error) {
      console.error('[discover] events', error);
      setEvents({ kind: 'error' });
    }
  }, []);

  const loadPlaces = useCallback(async () => {
    setPlaces({ kind: 'loading' });
    try {
      const [items, categories] = await Promise.all([listLivePlaces(), listCategories('place')]);
      setPlaces({ kind: 'ready', data: { items, categories } });
    } catch (error) {
      console.error('[discover] places', error);
      setPlaces({ kind: 'error' });
    }
  }, []);

  const loadShops = useCallback(async () => {
    setShops({ kind: 'loading' });
    try {
      setShops({ kind: 'ready', data: await listLiveShops() });
    } catch (error) {
      console.error('[discover] shops', error);
      setShops({ kind: 'error' });
    }
  }, []);

  /** Asks the phone for its position once, only when the student taps "Near me". It is never stored or sent anywhere. */
  function findNearMe() {
    if (!navigator.geolocation) return setHereMessage('This browser cannot find your location.');
    setHereMessage('Finding you…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setHere({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setHereMessage('');
      },
      () => setHereMessage('Could not get your location. Allow location access and try again.'),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  }

  const loadNews = useCallback(async () => {
    setNews({ kind: 'loading' });
    try {
      setNews({ kind: 'ready', data: await listLiveAnnouncements() });
    } catch (error) {
      console.error('[discover] news', error);
      setNews({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    if (!isDatabaseConfigured) return;
    void loadEvents();
    void loadPlaces();
    void loadShops();
    void loadNews();
  }, [loadEvents, loadPlaces, loadShops, loadNews]);

  if (!isDatabaseConfigured) {
    return (
      <>
        <PageHeader title="Discover" />
        <EmptyState title="The database isn't connected yet">
          Add your Supabase keys to .env.local and restart the app. Steps are in docs/SUPABASE_SETUP.md.
        </EmptyState>
      </>
    );
  }

  const tabs: { id: Section; label: string }[] = [
    { id: 'events', label: 'Events' },
    { id: 'places', label: 'Places' },
    { id: 'shops', label: 'Shops' },
    { id: 'news', label: 'News' },
  ];

  return (
    <>
      <PageHeader tone="rose" title="Discover" description="Events, places to try, shops and news around campus." />

      <div className="segmented discover-tabs" role="group" aria-label="Discover sections">
        {tabs.map((t) => (
          <button key={t.id} type="button" aria-pressed={section === t.id} onClick={() => setSection(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <OfflineNotice />

      {section !== 'news' && (
        <TextField label="Search" type="search" placeholder={section === 'events' ? 'Search events' : section === 'places' ? 'Search places' : 'Search shops and products'} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      )}

      {section === 'events' && (
        <>
          {events.kind === 'loading' && <SkeletonCards label="Loading events" />}
          {events.kind === 'error' && (
            <EmptyState title="We couldn't load events" action={<Button onClick={() => void loadEvents()}>Try again</Button>}>
              Check your connection and try again.
            </EmptyState>
          )}
          {events.kind === 'ready' &&
            (events.data.items.length === 0 ? (
              <EmptyState title="No events right now">When something is happening on campus, you'll find it here.</EmptyState>
            ) : (
              (() => {
                const { items, categories } = events.data;
                const shown = items
                  .filter((e) => (eventFilter === 'all' ? true : eventFilter === 'saved' ? isSaved('event', e.id) : e.categoryId === eventFilter))
                  .filter((e) => matchesDate(e, dateFilter))
                  .filter((e) => matchesSearch(`${e.name} ${e.description} ${e.locationText}`, query));
                return (
                  <>
                    <FilterButton
                      categories={categories}
                      usedIds={new Set(items.map((e) => e.categoryId))}
                      hasSaved={items.some((e) => isSaved('event', e.id))}
                      value={eventFilter}
                      onChange={setEventFilter}
                      dateValue={dateFilter}
                      onDateChange={setDateFilter}
                    />
                    {shown.length === 0 && <p className="events-none text-secondary">Nothing matches. Try a different search or filter.</p>}
                    <ul className="event-grid">
                      {shown.map((event) => (
                        <li key={event.id}>
                          <EventCard event={event} category={categories.find((c) => c.id === event.categoryId)} />
                        </li>
                      ))}
                    </ul>
                  </>
                );
              })()
            ))}
        </>
      )}

      {section === 'places' && (
        <>
          {places.kind === 'loading' && <SkeletonCards label="Loading places" />}
          {places.kind === 'error' && (
            <EmptyState title="We couldn't load places" action={<Button onClick={() => void loadPlaces()}>Try again</Button>}>
              Check your connection and try again. If this keeps happening, the latest database updates may not have been run.
            </EmptyState>
          )}
          {places.kind === 'ready' &&
            (places.data.items.length === 0 ? (
              <EmptyState title="No places yet">Spots to eat, hang out and explore will show up here.</EmptyState>
            ) : (
              (() => {
                const { items, categories } = places.data;
                const shown = items
                  .filter((p) => (placeFilter === 'all' ? true : placeFilter === 'saved' ? isSaved('place', p.id) : p.categoryId === placeFilter))
                  .filter((p) => matchesSearch(`${p.name} ${p.description} ${p.address}`, query));
                return (
                  <>
                    <FilterButton
                      categories={categories}
                      usedIds={new Set(items.map((p) => p.categoryId))}
                      hasSaved={items.some((p) => isSaved('place', p.id))}
                      value={placeFilter}
                      onChange={setPlaceFilter}
                    />
                    {shown.length === 0 && <p className="events-none text-secondary">Nothing matches. Try a different search or filter.</p>}
                    <ul className="event-grid">
                      {shown.map((place) => (
                        <li key={place.id}>
                          <PlaceCard place={place} category={categories.find((c) => c.id === place.categoryId)} />
                        </li>
                      ))}
                    </ul>
                  </>
                );
              })()
            ))}
        </>
      )}

      {section === 'shops' && (
        <>
          {shops.kind === 'loading' && <SkeletonCards label="Loading shops" />}
          {shops.kind === 'error' && (
            <EmptyState title="We couldn't load shops" action={<Button onClick={() => void loadShops()}>Try again</Button>}>
              Check your connection and try again. If this keeps happening, the latest database updates may not have been run.
            </EmptyState>
          )}
          {shops.kind === 'ready' &&
            (shops.data.length === 0 ? (
              <EmptyState title="No shops yet">Shops around campus, and what they have, will show up here.</EmptyState>
            ) : (
              (() => {
                const withDistance = shops.data
                  .filter((shop) => matchesSearch(`${shop.name} ${shop.description} ${shop.address} ${shop.products.map((p) => p.name).join(' ')}`, query))
                  .map((shop) => ({
                    shop,
                    metres: here && shop.latitude !== null && shop.longitude !== null ? distanceMetres(here.latitude, here.longitude, shop.latitude, shop.longitude) : null,
                  }));
                if (here) withDistance.sort((a, b) => (a.metres ?? Infinity) - (b.metres ?? Infinity));
                return (
                  <>
                    <div className="filter-bar">
                      <button type="button" className={`filter-button ${here ? 'filter-button--active' : ''}`} onClick={findNearMe}>
                        {here ? 'Sorted by distance' : 'Near me'}
                      </button>
                      {here && (
                        <button type="button" className="link-button" onClick={() => setHere(null)}>
                          Clear
                        </button>
                      )}
                    </div>
                    {hereMessage && <p className="text-secondary text-small" role="status">{hereMessage}</p>}
                    {withDistance.length === 0 && <p className="events-none text-secondary">Nothing matches your search.</p>}
                    <ul className="event-grid">
                      {withDistance.map(({ shop, metres }) => (
                        <li key={shop.id}>
                          <ShopCard shop={shop} distance={metres === null ? undefined : distanceLabel(metres)} />
                        </li>
                      ))}
                    </ul>
                  </>
                );
              })()
            ))}
        </>
      )}

      {section === 'news' && (
        <>
          {news.kind === 'loading' && <SkeletonCards label="Loading news" count={2} />}
          {news.kind === 'error' && (
            <EmptyState title="We couldn't load the news" action={<Button onClick={() => void loadNews()}>Try again</Button>}>
              Check your connection and try again.
            </EmptyState>
          )}
          {news.kind === 'ready' && news.data.length === 0 && (
            <EmptyState title="No news right now">Announcements from the Snacktic team will show up here.</EmptyState>
          )}
          {news.kind === 'ready' && news.data.length > 0 && (
            <ul className="news-list">
              {news.data.map((item) => (
                <li key={item.id}>
                  <article className={`news-card news-card--${item.level}`}>
                    {item.imagePath && (
                      <div className="news-card__media">
                        <img src={pictureUrl(item.imagePath)} alt="" loading="lazy" decoding="async" />
                      </div>
                    )}
                    <div className="news-card__body">
                      <div className="news-card__meta">
                        <span className={`news-card__sticker news-card__sticker--${item.level}`}>{levelLabels[item.level]}</span>
                        <span className="news-card__date">{postedFormat.format(new Date(item.createdAt))}</span>
                      </div>
                      <h2>{item.title}</h2>
                      {item.body && <p className="text-secondary">{item.body}</p>}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

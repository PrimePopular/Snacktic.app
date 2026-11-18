import { useEffect, useState } from 'react';
import { EventCard } from './EventCard';
import { listUpcomingEvents } from './eventsService';
import type { EventItem } from './events.types';
import './cross-event.css';

/**
 * Once in a while, shows one upcoming event in another section (Games, Rewards) so good events are found wherever students
 * are. It keeps its identity: it is the normal event card, with a clear "EVENT" label above it. Most visits show nothing.
 */
export function CrossEvent({ chance = 0.5 }: { chance?: number }) {
  const [event, setEvent] = useState<EventItem | null>(null);

  useEffect(() => {
    if (Math.random() > chance) return;
    let active = true;
    void listUpcomingEvents()
      .then((list) => {
        if (!active || list.length === 0) return;
        const pool = list.slice(0, 5);
        setEvent(pool[Math.floor(Math.random() * pool.length)]);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [chance]);

  if (!event) return null;
  return (
    <section className="cross-event" aria-label="An event coming up">
      <p className="cross-event__label">EVENT · coming up</p>
      <EventCard event={event} />
    </section>
  );
}

import { useState } from 'react';
import { DetailSheet, FeedCard, useCardActions } from '../feed';
import type { DetailLink } from '../feed';
import { playTap } from '../../services/sound';
import { linkLabel, phoneHref, safeLink } from '../../shared/url';
import { recordInterest } from '../recommendations';
import { eventImageUrl } from './eventsService';
import type { EventCategory, EventItem } from './events.types';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const dayMonthFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const longFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Happening now", "Today 9:00 PM", "Tomorrow 2:00 PM", "Sat 6:00 PM" or "12 Dec 6:00 PM". */
function whenLabel(startsAt: string, expiresAt: string, now: Date = new Date()): string {
  const start = new Date(startsAt);
  const end = new Date(expiresAt);
  if (start <= now && end > now) return 'Happening now';
  const days = Math.round((startOfDay(start) - startOfDay(now)) / 86_400_000);
  const day = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days > 1 && days < 7 ? weekdayFormat.format(start) : dayMonthFormat.format(start);
  return `${day} ${timeFormat.format(start)}`;
}

function fullWhen(startsAt: string, expiresAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(expiresAt);
  const sameDay = startOfDay(start) === startOfDay(end);
  return `${longFormat.format(start)} until ${sameDay ? timeFormat.format(end) : longFormat.format(end)}`;
}

interface EventCardProps {
  event: EventItem;
  category?: EventCategory;
}

/**
 * An event card. Tap it and the details open as a full-height sheet, with like, share and buttons to
 * reach the organiser. Opening, liking and contacting all teach the feed what this student likes.
 */
export function EventCard({ event, category }: EventCardProps) {
  const [open, setOpen] = useState(false);
  const when = whenLabel(event.startsAt, event.expiresAt);
  const imageUrl = event.imagePath ? eventImageUrl(event.imagePath) : null;
  const actions = useCardActions({
    kind: 'event',
    id: event.id,
    categoryId: event.categoryId,
    title: event.name,
    shareText: `${event.name} · ${when}${event.locationText ? ` · ${event.locationText}` : ''}`,
  });

  const link = safeLink(event.contactLink);
  const phone = phoneHref(event.contactPhone);
  const links: DetailLink[] = [];
  if (link) links.push({ href: link, label: linkLabel(link), primary: true, onClick: () => recordInterest(event.categoryId, 3) });
  if (phone) links.push({ href: phone, label: `Call ${event.contactPhone.trim()}`, onClick: () => recordInterest(event.categoryId, 3) });

  return (
    <>
      <FeedCard
        title={event.name}
        categoryId={event.categoryId}
        imageUrl={imageUrl}
        categoryName={category?.name}
        pill={when}
        meta={event.locationText || undefined}
        saved={actions.saved}
        status={actions.status}
        onToggleSaved={actions.toggle}
        onShare={() => void actions.share()}
        onOpen={() => {
          playTap();
          recordInterest(event.categoryId, 2);
          setOpen(true);
        }}
      />
      <DetailSheet
        open={open}
        onClose={() => setOpen(false)}
        title={event.name}
        categoryId={event.categoryId}
        imageUrl={imageUrl}
        categoryName={category?.name}
        highlights={[
          { icon: 'calendar', text: fullWhen(event.startsAt, event.expiresAt) },
          ...(event.locationText ? [{ icon: 'pin' as const, text: event.locationText }] : []),
        ]}
        description={event.description || undefined}
        saved={actions.saved}
        status={actions.status}
        onToggleSaved={actions.toggle}
        onShare={() => void actions.share()}
        contact={links.length > 0 || event.contactName ? { heading: 'Want to know more?', name: event.contactName || undefined, links } : undefined}
      />
    </>
  );
}

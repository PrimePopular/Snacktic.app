import { useState } from 'react';
import { DetailSheet, FeedCard, useCardActions } from '../feed';
import type { DetailLink } from '../feed';
import { pictureUrl } from '../../services/pictures';
import { playTap } from '../../services/sound';
import { linkLabel, mapsOpenUrl, osmEmbedUrl, phoneHref, safeLink } from '../../shared/url';
import type { EventCategory } from '../events';
import { recordInterest } from '../recommendations';
import type { Place } from './places.types';

interface PlaceCardProps {
  place: Place;
  category?: EventCategory;
}

/** A place to try. Same look as events; the details add a map when the place has a position. */
export function PlaceCard({ place, category }: PlaceCardProps) {
  const [open, setOpen] = useState(false);
  const imageUrl = place.imagePath ? pictureUrl(place.imagePath) : null;
  const actions = useCardActions({
    kind: 'place',
    id: place.id,
    categoryId: place.categoryId,
    title: place.name,
    shareText: `${place.name}${place.address ? ` · ${place.address}` : ''}`,
  });

  const link = safeLink(place.link);
  const phone = phoneHref(place.phone);
  const links: DetailLink[] = [];
  if (link) links.push({ href: link, label: linkLabel(link), primary: true, onClick: () => recordInterest(place.categoryId, 3) });
  if (phone) links.push({ href: phone, label: `Call ${place.phone.trim()}`, onClick: () => recordInterest(place.categoryId, 3) });

  const hasPosition = place.latitude !== null && place.longitude !== null;
  const map = hasPosition
    ? { embedUrl: osmEmbedUrl(place.latitude as number, place.longitude as number), openUrl: mapsOpenUrl(place.latitude as number, place.longitude as number) }
    : undefined;

  return (
    <>
      <FeedCard
        title={place.name}
        categoryId={place.categoryId}
        imageUrl={imageUrl}
        categoryName={category?.name}
        meta={place.address || undefined}
        saved={actions.saved}
        status={actions.status}
        onToggleSaved={actions.toggle}
        onShare={() => void actions.share()}
        onOpen={() => {
          playTap();
          recordInterest(place.categoryId, 2);
          setOpen(true);
        }}
      />
      <DetailSheet
        open={open}
        onClose={() => setOpen(false)}
        title={place.name}
        categoryId={place.categoryId}
        imageUrl={imageUrl}
        categoryName={category?.name}
        highlights={place.address ? [{ icon: 'pin', text: place.address }] : []}
        description={place.description || undefined}
        saved={actions.saved}
        status={actions.status}
        onToggleSaved={actions.toggle}
        onShare={() => void actions.share()}
        map={map}
        contact={links.length > 0 ? { heading: 'Go there or get in touch', links } : undefined}
      />
    </>
  );
}

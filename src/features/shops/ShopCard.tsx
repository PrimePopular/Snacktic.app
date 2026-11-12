import { useState } from 'react';
import { DetailSheet, FeedCard, useCardActions } from '../feed';
import type { DetailLink } from '../feed';
import { pictureUrl } from '../../services/pictures';
import { playTap } from '../../services/sound';
import { googleMapsUrl, phoneHref } from '../../shared/url';
import type { Shop } from './shops.types';

interface ShopCardProps {
  shop: Shop;
  /** For example "250 m away", when the student chose "Near me". */
  distance?: string;
}

/** A shop. Its page shows the address, opening hours, the partner products it has and a Google Maps button. */
export function ShopCard({ shop, distance }: ShopCardProps) {
  const [open, setOpen] = useState(false);
  const imageUrl = shop.imagePath ? pictureUrl(shop.imagePath) : null;
  const actions = useCardActions({
    kind: 'shop',
    id: shop.id,
    categoryId: null,
    title: shop.name,
    shareText: `${shop.name}${shop.address ? ` · ${shop.address}` : ''}`,
  });

  const mapUrl = googleMapsUrl({ latitude: shop.latitude, longitude: shop.longitude, address: shop.address || shop.name });
  const phone = phoneHref(shop.phone);
  const links: DetailLink[] = phone ? [{ href: phone, label: `Call ${shop.phone.trim()}`, primary: true }] : [];

  const highlights = [
    ...(shop.address ? [{ icon: 'pin' as const, text: shop.address }] : []),
    ...(shop.openingHours ? [{ icon: 'calendar' as const, text: shop.openingHours }] : []),
  ];

  return (
    <>
      <FeedCard
        title={shop.name}
        categoryId={null}
        imageUrl={imageUrl}
        pill={distance}
        meta={shop.products.length > 0 ? `${shop.products.length} product${shop.products.length === 1 ? '' : 's'} here` : shop.address || undefined}
        saved={actions.saved}
        status={actions.status}
        onToggleSaved={actions.toggle}
        onShare={() => void actions.share()}
        onOpen={() => {
          playTap();
          setOpen(true);
        }}
      />
      <DetailSheet
        open={open}
        onClose={() => setOpen(false)}
        title={shop.name}
        categoryId={null}
        imageUrl={imageUrl}
        highlights={highlights}
        description={shop.description || undefined}
        saved={actions.saved}
        status={actions.status}
        onToggleSaved={actions.toggle}
        onShare={() => void actions.share()}
        map={mapUrl ? { openUrl: mapUrl } : undefined}
        contact={links.length > 0 ? { heading: 'Get in touch', links } : undefined}
      >
        {shop.products.length > 0 && (
          <section className="detail__section">
            <h3>Available here</h3>
            <ul className="shop-products">
              {shop.products.map((p) => (
                <li key={p.id} className="shop-products__item">
                  {p.imagePath && <img src={pictureUrl(p.imagePath)} alt="" loading="lazy" decoding="async" />}
                  <div>
                    <strong>{p.name}</strong>
                    {p.description && <p className="text-secondary text-small">{p.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </DetailSheet>
    </>
  );
}

/** Only web links are allowed (never javascript: or other schemes). Returns null if unsafe or empty. */
export function safeLink(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Turns a typed phone number into a tel: link, or null if it does not look like a number. */
export function phoneHref(value: string): string | null {
  const digits = value.replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 6 ? `tel:${digits}` : null;
}

/** A friendly button label for a link: WhatsApp, Maps, or a general link. */
export function linkLabel(url: string): string {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Open link';
  }
  if (host === 'wa.me' || host.endsWith('whatsapp.com')) return 'Message on WhatsApp';
  if (host === 'maps.app.goo.gl' || host === 'goo.gl' || host.startsWith('maps.') || (host.endsWith('google.com') && url.includes('/maps'))) {
    return 'Open in Maps';
  }
  return 'Open link';
}

/**
 * A link that opens Google Maps (the app on a phone, the website otherwise). Free: no key, no
 * account and no map is loaded inside Snacktic. Uses the exact point when there is one, otherwise
 * the typed address or place name.
 */
export function googleMapsUrl(target: { latitude?: number | null; longitude?: number | null; address?: string }): string | null {
  const { latitude, longitude, address } = target;
  const query =
    typeof latitude === 'number' && typeof longitude === 'number'
      ? `${latitude.toFixed(6)},${longitude.toFixed(6)}`
      : (address ?? '').trim();
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

/** Straight-line distance in metres between two points (good enough to sort shops by "near me"). */
export function distanceMetres(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(bLat - aLat) / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLon - aLon) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceLabel(metres: number): string {
  return metres < 1000 ? `${Math.max(10, Math.round(metres / 10) * 10)} m away` : `${(metres / 1000).toFixed(1)} km away`;
}

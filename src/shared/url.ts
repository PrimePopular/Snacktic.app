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

/** OpenStreetMap embed centred on a point, with a pin. Free, no account and no key needed. */
export function osmEmbedUrl(latitude: number, longitude: number): string {
  const dLon = 0.004;
  const dLat = 0.003;
  const bbox = [longitude - dLon, latitude - dLat, longitude + dLon, latitude + dLat].map((n) => n.toFixed(6)).join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude.toFixed(6)}%2C${longitude.toFixed(6)}`;
}

/** Opens the phone's maps app on a point. Free, no key needed. */
export function mapsOpenUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

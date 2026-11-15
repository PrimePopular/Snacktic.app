/**
 * Phone numbers. Snacktic is used in Nigeria, so a number typed without a country code gets +234 added. This makes
 * WhatsApp links work (WhatsApp needs the country code) however a student types their number.
 */
export const DEFAULT_COUNTRY_CODE = '234';

/**
 * The digits WhatsApp wants (country code first, no plus), or null if the text is not a usable number. Examples:
 * 0903 300 0131 -> 2349033000131, +234 903 300 0131 -> 2349033000131, 9033000131 -> 2349033000131,
 * +44 7700 900123 -> 447700900123 (a plus means the country code is already there).
 */
export function toWhatsAppNumber(raw: string): string | null {
  const text = raw.trim();
  let digits = text.replace(/\D/g, '');
  if (digits.length < 7) return null;

  if (text.startsWith('+')) {
    // The country code was typed. Remove a stray 0 after +234 (+234 0903...).
    if (digits.startsWith(`${DEFAULT_COUNTRY_CODE}0`)) digits = DEFAULT_COUNTRY_CODE + digits.slice(DEFAULT_COUNTRY_CODE.length + 1);
    return digits;
  }
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return DEFAULT_COUNTRY_CODE + digits.slice(1);
  if (digits.startsWith(`${DEFAULT_COUNTRY_CODE}0`)) return DEFAULT_COUNTRY_CODE + digits.slice(DEFAULT_COUNTRY_CODE.length + 1);
  if (digits.startsWith(DEFAULT_COUNTRY_CODE) && digits.length >= 12) return digits;
  if (digits.length === 10) return DEFAULT_COUNTRY_CODE + digits;
  return digits; // longer numbers are assumed to include their own country code
}

/** The number as it is saved: +2349033000131. Anything that cannot be understood is saved as typed. */
export function normalizePhone(raw: string): string {
  const number = toWhatsAppNumber(raw);
  return number ? `+${number}` : raw.trim();
}

/** A WhatsApp chat link for a number, or null. */
export function whatsappLink(raw: string): string | null {
  const number = toWhatsAppNumber(raw);
  return number ? `https://wa.me/${number}` : null;
}

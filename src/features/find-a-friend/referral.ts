/**
 * The invite link. A player's QR code is a normal web address (their link plus their code), so any phone camera can open it,
 * even for someone who has never heard of Snacktic. The code is remembered through sign-up and sign-in, and credited once
 * the person is signed in.
 */
import { getShareLink } from '../share';

const KEY = 'snacktic.ref';

export function rememberReferral(code: string): void {
  try {
    localStorage.setItem(KEY, code.trim().toLowerCase());
  } catch {
    /* storage unavailable: the invite simply cannot be remembered */
  }
}

export function pendingReferral(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearReferral(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* fine */
  }
}

/** The address a QR code points to. Uses the live website address the owner set (Admin, Share link), or this site's own. */
export async function inviteLink(code: string): Promise<string> {
  const base = ((await getShareLink()) || window.location.origin).replace(/\/+$/, '');
  return `${base}/#/r/${code}`;
}

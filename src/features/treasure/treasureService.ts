import { supabase } from '../../services/database';
import { notifyPointsChanged } from '../points';
import { getShareLink } from '../share';

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

export interface TreasureCode {
  id: string;
  name: string;
  hint: string;
  token: string;
  points: number;
  maxScans: number;
  scans: number;
  active: boolean;
}

export type ClaimStatus = 'found' | 'already' | 'too_late' | 'closed' | 'invalid';
export interface ClaimResult {
  status: ClaimStatus;
  points: number;
  name: string;
}

/** Claims the treasure for the signed-in student. The database decides everything: limit, once per person, and the points. */
export async function claimTreasure(token: string): Promise<ClaimResult> {
  const { data, error } = await client().rpc('claim_treasure', { p_token: token });
  if (error) throw new Error(/sign in/i.test(error.message) ? 'Sign in to claim treasure.' : /suspended/i.test(error.message) ? 'Your account is suspended.' : 'Something went wrong. Please try again.');
  const r = (Array.isArray(data) ? data[0] : data) as { status: ClaimStatus; points: number; name: string } | undefined;
  if (!r) throw new Error('Something went wrong. Please try again.');
  if (r.status === 'found') notifyPointsChanged();
  return { status: r.status, points: Number(r.points), name: r.name };
}

const KEY = 'snacktic.pendingTreasure';
/** Remember a scanned code while the person signs up or signs in, so it is claimed afterwards. */
export function rememberTreasure(token: string): void {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* ignore */
  }
}
export function pendingTreasure(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function forgetTreasure(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// ---- Owner ----

const COLUMNS = 'id, name, hint, token, points, max_scans, scans, active';
const fromRow = (r: Record<string, unknown>): TreasureCode => ({ id: r.id as string, name: r.name as string, hint: r.hint as string, token: r.token as string, points: Number(r.points), maxScans: Number(r.max_scans), scans: Number(r.scans), active: r.active as boolean });

export async function listTreasure(): Promise<TreasureCode[]> {
  const { data, error } = await client().from('treasure_codes').select(COLUMNS).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(fromRow);
}

export async function createTreasure(input: { name: string; hint: string; points: number; maxScans: number }): Promise<void> {
  const { error } = await client().from('treasure_codes').insert({ name: input.name.trim(), hint: input.hint.trim(), points: input.points, max_scans: input.maxScans });
  if (error) throw new Error(error.message);
}

export async function updateTreasure(id: string, input: { name: string; hint: string; points: number; maxScans: number }): Promise<void> {
  const { error } = await client().from('treasure_codes').update({ name: input.name.trim(), hint: input.hint.trim(), points: input.points, max_scans: input.maxScans }).eq('id', id);
  if (error) throw new Error(/check|scans/i.test(error.message) ? 'The limit cannot be lower than the number of people who already found it.' : error.message);
}

export async function setTreasureActive(id: string, active: boolean): Promise<void> {
  const { error } = await client().from('treasure_codes').update({ active }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteTreasure(id: string): Promise<void> {
  const { error } = await client().from('treasure_codes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listFinders(codeId: string): Promise<{ username: string; foundAt: string; points: number }[]> {
  const { data, error } = await client().rpc('owner_treasure_finders', { p_code: codeId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { username: string; found_at: string; points: number }[]).map((r) => ({ username: r.username, foundAt: r.found_at, points: Number(r.points) }));
}

/** The address a printed QR code opens: the live website address the owner set (Admin, Share link), or this site's own. */
export async function treasureLink(token: string): Promise<string> {
  const base = ((await getShareLink()) || window.location.origin).replace(/\/+$/, '');
  return `${base}/#/t/${token}`;
}

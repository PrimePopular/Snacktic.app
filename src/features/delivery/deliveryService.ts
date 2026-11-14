/**
 * Where Snacktic can deliver. Right now only approved places (Godfrey Okoye University). The database refuses an order for
 * any other place, so this is not just a message in the app. Students can ask for a new place; the owner decides.
 */
import { supabase } from '../../services/database';

export interface DeliveryLocation {
  id: string;
  name: string;
  active: boolean;
}

export interface DeliveryRequest {
  id: string;
  place: string;
  note: string;
  status: 'new' | 'added' | 'declined';
  createdAt: string;
}

const SHOWABLE = [
  'Sign in to ask for a new delivery place',
  'Please type the place',
  'You have asked a few times today',
  'Owner only',
];

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

/** The places students can order to (only active ones are visible to them). */
export async function listDeliveryLocations(): Promise<DeliveryLocation[]> {
  const { data, error } = await client().from('delivery_locations').select('id, name, active').order('created_at');
  if (error) throw new Error(error.message);
  return ((data ?? []) as DeliveryLocation[]).filter((l) => l.active);
}

/** Student: ask for delivery in another place. */
export async function requestDeliveryLocation(place: string, note: string): Promise<void> {
  const { error } = await client().rpc('request_delivery_location', { p_place: place, p_note: note });
  if (error) {
    const known = SHOWABLE.find((text) => error.message.includes(text));
    if (!known) console.error('[delivery] request', error.message);
    throw new Error(known ? error.message : 'Something went wrong. Please try again.');
  }
}

/* ---------------------------------- Owner ---------------------------------- */

export async function adminListLocations(): Promise<DeliveryLocation[]> {
  const { data, error } = await client().from('delivery_locations').select('id, name, active').order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []) as DeliveryLocation[];
}

export async function adminAddLocation(name: string): Promise<void> {
  const { error } = await client().from('delivery_locations').insert({ name: name.trim() });
  if (error) throw new Error(error.code === '23505' ? 'That place is already in the list.' : error.message);
}

export async function adminSetLocationActive(id: string, active: boolean): Promise<void> {
  const { error } = await client().from('delivery_locations').update({ active }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminDeleteLocation(id: string): Promise<void> {
  const { error } = await client().from('delivery_locations').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminListRequests(): Promise<DeliveryRequest[]> {
  const { data, error } = await client().from('delivery_requests').select('id, place, note, status, created_at').order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; place: string; note: string; status: DeliveryRequest['status']; created_at: string }[]).map((r) => ({
    id: r.id,
    place: r.place,
    note: r.note,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function adminSetRequestStatus(id: string, status: DeliveryRequest['status']): Promise<void> {
  const { error } = await client().from('delivery_requests').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminDeleteRequest(id: string): Promise<void> {
  const { error } = await client().from('delivery_requests').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

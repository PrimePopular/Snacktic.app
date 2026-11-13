/** Things games sell for Crumb Points (hint packs). The database does the charging; this file only asks. */
import { supabase } from '../../services/database';
import { notifyPointsChanged } from './pointsService';

export interface GameItem {
  item: string;
  label: string;
  qty: number;
  price: number;
}

const SHOWABLE = ['Sign in to buy this', 'Your account is suspended', 'That item is not for sale', 'Not enough Crumb Points', 'That purchase is not valid'];

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

export async function listGameItems(gameId: string): Promise<GameItem[]> {
  const { data, error } = await client().from('game_items').select('item, label, qty, price').eq('game_id', gameId).order('price');
  if (error) throw new Error(error.message);
  return (data ?? []) as GameItem[];
}

/**
 * Buys one item. The request id is made here, so if the same request is sent twice (a slow connection, a double tap)
 * the student is charged once. Throws a readable message when it cannot be done, and nothing is charged.
 */
export async function spendGameItem(gameId: string, item: string): Promise<{ balance: number; qty: number }> {
  const { data, error } = await client().rpc('spend_game_item', { p_request: crypto.randomUUID(), p_game_id: gameId, p_item: item });
  if (error) {
    const known = SHOWABLE.find((text) => error.message.includes(text));
    if (!known) console.error('[points] purchase', error.message);
    throw new Error(known ?? 'Something went wrong. You were not charged.');
  }
  const row = ((data ?? []) as { new_balance: number; bought_qty: number; charged: number }[])[0];
  if (!row) throw new Error('Something went wrong. You were not charged.');
  if (row.charged > 0) notifyPointsChanged();
  return { balance: row.new_balance, qty: row.bought_qty };
}

/** Owner only: change what an item costs. */
export async function adminSetItemPrice(gameId: string, item: string, price: number): Promise<void> {
  const { error } = await client().from('game_items').update({ price }).eq('game_id', gameId).eq('item', item);
  if (error) throw new Error(error.message);
}

export async function adminListItems(): Promise<(GameItem & { gameId: string })[]> {
  const { data, error } = await client().from('game_items').select('game_id, item, label, qty, price').order('game_id').order('price');
  if (error) throw new Error(error.message);
  return ((data ?? []) as { game_id: string; item: string; label: string; qty: number; price: number }[]).map((r) => ({ gameId: r.game_id, item: r.item, label: r.label, qty: r.qty, price: r.price }));
}

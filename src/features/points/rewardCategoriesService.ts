import { supabase } from '../../services/database';
import type { RewardCategory } from './points.types';

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

/** Public. Empty if the database update (supabase/034) has not been run, so the store simply has no category filter. */
export async function listRewardCategories(): Promise<RewardCategory[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('reward_categories').select('id, name').order('sort_order').order('name');
  if (error) return [];
  return (data ?? []) as RewardCategory[];
}

export async function createRewardCategory(name: string): Promise<void> {
  const { error } = await client().from('reward_categories').insert({ name: name.trim() });
  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'There is already a category with that name.' : error.message);
}

export async function deleteRewardCategory(id: string): Promise<void> {
  const { error } = await client().from('reward_categories').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Ads. The owner uploads them; they appear in feeds tagged "Ad". Seeing one earns Crumb Points,
 * paid by the database function claim_ad_points (once per student per ad). This file never
 * changes a balance itself.
 */
import { supabase } from '../../services/database';
import { cached } from '../../services/offlineCache';
import { removePicture } from '../../services/pictures';
import { notifyPointsChanged } from '../points';
import type { Ad, AdInput } from './ads.types';

const COLUMNS = 'id, advertiser, title, body, image_path, link, points, ends_at, published, created_at';

interface Row {
  id: string;
  advertiser: string;
  title: string;
  body: string;
  image_path: string | null;
  link: string;
  points: number;
  ends_at: string | null;
  published: boolean;
  created_at: string;
}

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

const fromRow = (r: Row): Ad => ({
  id: r.id,
  advertiser: r.advertiser,
  title: r.title,
  body: r.body,
  imagePath: r.image_path,
  link: r.link,
  points: r.points,
  endsAt: r.ends_at,
  published: r.published,
  createdAt: r.created_at,
});

const toRow = (i: AdInput) => ({
  advertiser: i.advertiser.trim(),
  title: i.title.trim(),
  body: i.body.trim(),
  image_path: i.imagePath,
  link: i.link.trim(),
  points: i.points,
  ends_at: i.endsAt,
  published: i.published,
});

/** Student view: ads that are visible and not finished. The database filters them too. */
export async function listLiveAds(): Promise<Ad[]> {
  const rows = await cached('ads', async () => {
    const { data, error } = await client().from('ads').select(COLUMNS).eq('published', true).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Row[];
  });
  const now = Date.now();
  return rows.map(fromRow).filter((a) => !a.endsAt || Date.parse(a.endsAt) > now);
}

/** Owner view: every ad, including hidden and finished ones. */
export async function listAllAds(): Promise<Ad[]> {
  const { data, error } = await client().from('ads').select(COLUMNS).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(fromRow);
}

/** How many different students saw each ad. Owner only. */
export async function ownerAdViewers(): Promise<Record<string, number>> {
  const { data, error } = await client().rpc('owner_ad_viewers');
  if (error) throw new Error(error.message);
  const result: Record<string, number> = {};
  for (const row of (data ?? []) as { ad_id: string; viewers: number | string }[]) result[row.ad_id] = Number(row.viewers);
  return result;
}

export async function createAd(input: AdInput): Promise<void> {
  const { error } = await client().from('ads').insert(toRow(input));
  if (error) throw new Error(error.message);
}

export async function updateAd(id: string, input: AdInput): Promise<void> {
  const { error } = await client().from('ads').update(toRow(input)).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setAdPublished(id: string, published: boolean): Promise<void> {
  const { error } = await client().from('ads').update({ published }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteAd(ad: Ad): Promise<void> {
  const { error } = await client().from('ads').delete().eq('id', ad.id);
  if (error) throw new Error(error.message);
  if (ad.imagePath) await removePicture(ad.imagePath);
}

/**
 * Asks the database to pay for seeing this ad. Returns the points paid, or 0 if the student
 * already earned them. Never throws: a failed claim just means no points this time.
 */
export async function claimAdPoints(adId: string): Promise<number> {
  try {
    const { data, error } = await client().rpc('claim_ad_points', { p_ad_id: adId });
    if (error) throw new Error(error.message);
    const points = Number(data ?? 0);
    if (points > 0) notifyPointsChanged();
    return points;
  } catch (error) {
    console.error('[ads] claim', error);
    return 0;
  }
}

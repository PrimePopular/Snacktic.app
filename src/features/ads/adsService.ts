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

const seenThisSession = new Set<string>();

/** Counts a view (once per ad per visit) or a tap. Anyone can be counted, signed in or not. Never throws. */
export function trackAdEvent(adId: string, kind: 'view' | 'click'): void {
  if (!supabase) return;
  if (kind === 'view') {
    if (seenThisSession.has(adId)) return;
    seenThisSession.add(adId);
  }
  const db = supabase;
  // With a private viewer key, so the owner can see unique reach and unique clicks. If the database update (supabase/027) has not
  // been run, fall back to the plain counter so tracking keeps working.
  void Promise.resolve(db.rpc('track_ad_event', { p_ad: adId, p_kind: kind, p_viewer: deviceId() }))
    .then(({ error }) => (error ? db.rpc('track_ad_event', { p_ad: adId, p_kind: kind }) : undefined))
    .catch((error: unknown) => console.error('[ads] track', error));
}

/** A random id for this browser, so a visitor who is not signed in still counts once toward unique reach. It identifies no one. */
function deviceId(): string {
  try {
    let id = localStorage.getItem('snacktic.deviceId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('snacktic.deviceId', id);
    }
    return id;
  } catch {
    return '';
  }
}

export interface AdAnalytics {
  impressions: number;
  reach: number;
  clicks: number;
  uniqueClicks: number;
  /** Clicks as a percentage of impressions. */
  ctr: number;
  pointsPaid: number;
  studentsPaid: number;
}

/** Owner only: totals for every ad over the last N days. */
export async function ownerAdAnalytics(days: number): Promise<Record<string, AdAnalytics>> {
  const { data, error } = await client().rpc('owner_ad_analytics', { p_days: days });
  if (error) throw new Error(error.message);
  const out: Record<string, AdAnalytics> = {};
  for (const r of (data ?? []) as Record<string, number | string>[]) {
    out[r.ad_id as string] = { impressions: Number(r.impressions), reach: Number(r.reach), clicks: Number(r.clicks), uniqueClicks: Number(r.unique_clicks), ctr: Number(r.ctr), pointsPaid: Number(r.points_paid), studentsPaid: Number(r.students_paid) };
  }
  return out;
}

export interface AdDay {
  day: string;
  views: number;
  clicks: number;
}

/** Owner only: views and clicks per day for one ad. */
export async function ownerAdDaily(adId: string, days: number): Promise<AdDay[]> {
  const { data, error } = await client().rpc('owner_ad_daily', { p_ad: adId, p_days: days });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { day: string; views: number | string; clicks: number | string }[]).map((r) => ({ day: r.day, views: Number(r.views), clicks: Number(r.clicks) }));
}

export interface AdReport {
  views: number;
  clicks: number;
  views7d: number;
  clicks7d: number;
  signedInViewers: number;
}

/** Owner only: views and taps for every ad. */
export async function ownerAdReport(): Promise<Record<string, AdReport>> {
  const { data, error } = await client().rpc('owner_ad_report');
  if (error) throw new Error(error.message);
  const result: Record<string, AdReport> = {};
  for (const r of (data ?? []) as { ad_id: string; views: number | string; clicks: number | string; views_7d: number | string; clicks_7d: number | string; signed_in_viewers: number | string }[]) {
    result[r.ad_id] = { views: Number(r.views), clicks: Number(r.clicks), views7d: Number(r.views_7d), clicks7d: Number(r.clicks_7d), signedInViewers: Number(r.signed_in_viewers) };
  }
  return result;
}

/** Starts the engagement clock for a signed-in student who opened an ad. The server pays only if the claim comes about 3 seconds later. */
export async function beginAdOpen(adId: string): Promise<void> {
  try {
    const { error } = await client().rpc('begin_ad_open', { p_ad: adId });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error('[ads] open', error);
  }
}

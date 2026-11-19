import { supabase } from '../../services/database';
import { removePicture } from '../../services/pictures';
import type { BillboardInput, BillboardPost } from './billboards.types';

const COLUMNS = 'id, layout, title, body, images, video_url, link_url, link_label, featured, status, publish_at, expires_at, created_at';

interface Row {
  id: string;
  layout: BillboardPost['layout'];
  title: string;
  body: string;
  images: string[] | null;
  video_url: string | null;
  link_url: string | null;
  link_label: string;
  featured: boolean;
  status: BillboardPost['status'];
  publish_at: string;
  expires_at: string | null;
  created_at: string;
}

const fromRow = (r: Row): BillboardPost => ({
  id: r.id,
  layout: r.layout,
  title: r.title,
  body: r.body,
  images: r.images ?? [],
  videoUrl: r.video_url,
  linkUrl: r.link_url,
  linkLabel: r.link_label,
  featured: r.featured,
  status: r.status,
  publishAt: r.publish_at,
  expiresAt: r.expires_at,
  createdAt: r.created_at,
});

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

export const PAGE_SIZE = 8;

/**
 * Students: the live feed, a page at a time. Featured posts come first on the first page, then newest first. If the database
 * update (supabase/026) has not been run, this is just an empty feed.
 */
export async function listBillboards(page: number): Promise<BillboardPost[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('billboard_posts')
    .select(COLUMNS)
    .order('featured', { ascending: false })
    .order('publish_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (error) return [];
  return ((data ?? []) as Row[]).map(fromRow);
}

/** One featured post, to show on Home. */
export async function featuredBillboard(): Promise<BillboardPost | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('billboard_posts').select(COLUMNS).eq('featured', true).order('publish_at', { ascending: false }).limit(5);
  if (error || !data || data.length === 0) return null;
  const rows = data as Row[];
  return fromRow(rows[Math.floor(Math.random() * rows.length)]);
}

export async function adminListBillboards(): Promise<BillboardPost[]> {
  const { data, error } = await client().from('billboard_posts').select(COLUMNS).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(fromRow);
}

const toRow = (i: BillboardInput) => ({
  layout: i.layout,
  title: i.title.trim(),
  body: i.body.trim(),
  images: i.images,
  video_url: i.videoUrl,
  link_url: i.linkUrl,
  link_label: i.linkLabel.trim(),
  featured: i.featured,
  status: i.status,
  publish_at: i.publishAt,
  expires_at: i.expiresAt,
});

const friendly = (message: string) =>
  /billboard_posts_check|expires_at/.test(message) ? 'The end date must be at least 30 days after the post goes live.' : message;

export async function createBillboard(input: BillboardInput): Promise<void> {
  const { error } = await client().from('billboard_posts').insert(toRow(input));
  if (error) throw new Error(friendly(error.message));
}

export async function updateBillboard(id: string, input: BillboardInput): Promise<void> {
  const { error } = await client().from('billboard_posts').update(toRow(input)).eq('id', id);
  if (error) throw new Error(friendly(error.message));
}

export async function setBillboardStatus(id: string, status: BillboardPost['status']): Promise<void> {
  const { error } = await client().from('billboard_posts').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setBillboardFeatured(id: string, featured: boolean): Promise<void> {
  const { error } = await client().from('billboard_posts').update({ featured }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteBillboard(post: BillboardPost): Promise<void> {
  const { error } = await client().from('billboard_posts').delete().eq('id', post.id);
  if (error) throw new Error(error.message);
  await Promise.all(post.images.map((p) => removePicture(p).catch(() => undefined)));
}

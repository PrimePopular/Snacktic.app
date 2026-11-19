/**
 * Announcements data access. Owned by the Admin developer (writes) and the Home developer (reads).
 * Everything here goes through the database, so Row Level Security decides who may do what.
 */
import { supabase } from '../../services/database';
import { cached } from '../../services/offlineCache';
import { removePicture } from '../../services/pictures';
import type { Announcement, AnnouncementInput, AnnouncementLevel } from './announcements.types';

const BASE_COLUMNS = 'id, title, body, level, image_path, published, expires_at, created_at';
const COLUMNS = `${BASE_COLUMNS}, starts_at`;

/** Reads with the scheduling column; if the database update (supabase/025) has not been run yet, reads without it. */
async function select(build: (columns: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  let result = await build(COLUMNS);
  if (result.error) result = await build(BASE_COLUMNS);
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as Row[];
}

interface Row {
  id: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  image_path: string | null;
  published: boolean;
  expires_at: string | null;
  starts_at?: string | null;
  created_at: string;
}

function fromRow(row: Row): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    level: row.level,
    imagePath: row.image_path,
    published: row.published,
    startsAt: row.starts_at ?? null,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

const levelRank: Record<AnnouncementLevel, number> = { major: 0, medium: 1, minor: 2 };

/** Admin view: everything, including hidden and expired. */
export async function listAllAnnouncements(): Promise<Announcement[]> {
  const rows = await select((columns) => client().from('announcements').select(columns).order('created_at', { ascending: false }));
  return rows.map(fromRow);
}

/** Student view: only what is published and not expired, most important first. */
export async function listLiveAnnouncements(now: Date = new Date()): Promise<Announcement[]> {
  const rows = await cached('announcements', () =>
    select((columns) => client().from('announcements').select(columns).eq('published', true).order('created_at', { ascending: false })),
  );
  return rows
    .map(fromRow)
    .filter((a) => (!a.startsAt || Date.parse(a.startsAt) <= now.getTime()) && (!a.expiresAt || Date.parse(a.expiresAt) > now.getTime()))
    .sort((a, b) => levelRank[a.level] - levelRank[b.level] || Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function toRow(input: AnnouncementInput) {
  return {
    title: input.title.trim(),
    body: input.body.trim(),
    level: input.level,
    image_path: input.imagePath,
    published: input.published,
    expires_at: input.expiresAt,
    // Only sent when set, so saving still works before the database update (supabase/025) has been run.
    ...(input.startsAt ? { starts_at: input.startsAt } : {}),
  };
}

export async function createAnnouncement(input: AnnouncementInput): Promise<void> {
  const { error } = await client().from('announcements').insert(toRow(input));
  if (error) throw new Error(error.message);
}

export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<void> {
  const { error } = await client().from('announcements').update(toRow(input)).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setAnnouncementPublished(id: string, published: boolean): Promise<void> {
  const { error } = await client().from('announcements').update({ published }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteAnnouncement(item: Announcement): Promise<void> {
  const { error } = await client().from('announcements').delete().eq('id', item.id);
  if (error) throw new Error(error.message);
  if (item.imagePath) await removePicture(item.imagePath);
}

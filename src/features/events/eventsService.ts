/**
 * Events and categories data access. Writes are for admins; reads are open to everyone.
 * The database (Row Level Security) decides who may do what, not this file.
 */
import { supabase } from '../../services/database';
import { cached } from '../../services/offlineCache';
import { pictureUrl, removePicture, uploadPicture } from '../../services/pictures';
import type { CategoryKind, EventCategory, EventInput, EventItem } from './events.types';

const EVENT_COLUMNS =
  'id, name, description, category_id, starts_at, expires_at, location_text, image_path, contact_name, contact_phone, contact_link, published, created_at';

interface EventRow {
  id: string;
  name: string;
  description: string;
  category_id: number | null;
  starts_at: string;
  expires_at: string;
  location_text: string;
  image_path: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_link: string | null;
  published: boolean;
  created_at: string;
}

interface CategoryRow {
  id: number;
  name: string;
  active: boolean;
  kind: CategoryKind;
}

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

function eventFromRow(row: EventRow): EventItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    locationText: row.location_text,
    imagePath: row.image_path,
    contactName: row.contact_name ?? '',
    contactPhone: row.contact_phone ?? '',
    contactLink: row.contact_link ?? '',
    published: row.published,
    createdAt: row.created_at,
  };
}

function eventToRow(input: EventInput) {
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    category_id: input.categoryId,
    starts_at: input.startsAt,
    expires_at: input.expiresAt,
    location_text: input.locationText.trim(),
    image_path: input.imagePath,
    contact_name: input.contactName.trim(),
    contact_phone: input.contactPhone.trim(),
    contact_link: input.contactLink.trim(),
    published: input.published,
  };
}

/* ------------------------------- Categories ------------------------------- */

/** Categories for events (default) or for places. Both share one numbering. */
export async function listCategories(kind: CategoryKind = 'event'): Promise<EventCategory[]> {
  const rows = await cached(`categories-${kind}`, async () => {
    const { data, error } = await client()
      .from('event_categories')
      .select('id, name, active, kind')
      .eq('kind', kind)
      .order('id', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as CategoryRow[];
  });
  return rows.map((c) => ({ id: c.id, name: c.name, active: c.active, kind: c.kind }));
}

export async function createCategory(name: string, kind: CategoryKind = 'event'): Promise<void> {
  const { error } = await client().from('event_categories').insert({ name: name.trim(), kind });
  if (error) {
    throw new Error(error.message.includes('duplicate') ? 'A category with that name already exists.' : error.message);
  }
}

export async function updateCategory(id: number, patch: { name?: string; active?: boolean }): Promise<void> {
  const { error } = await client().from('event_categories').update(patch).eq('id', id);
  if (error) {
    throw new Error(error.message.includes('duplicate') ? 'A category with that name already exists.' : error.message);
  }
}

/* --------------------------------- Events --------------------------------- */

/** Admin view: everything, including hidden and finished events. */
export async function listAllEvents(): Promise<EventItem[]> {
  const { data, error } = await client().from('events').select(EVENT_COLUMNS).order('starts_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as EventRow[]).map(eventFromRow);
}

/** Student view: published events that have not ended, soonest first. */
export async function listUpcomingEvents(now: Date = new Date()): Promise<EventItem[]> {
  const rows = await cached('events', async () => {
    const { data, error } = await client()
      .from('events')
      .select(EVENT_COLUMNS)
      .eq('published', true)
      .order('starts_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as EventRow[];
  });
  return rows
    .map(eventFromRow)
    .filter((e) => Date.parse(e.expiresAt) > now.getTime());
}

export async function createEvent(input: EventInput): Promise<void> {
  const { error } = await client().from('events').insert(eventToRow(input));
  if (error) throw new Error(error.message);
}

export async function updateEvent(id: string, input: EventInput): Promise<void> {
  const { error } = await client().from('events').update(eventToRow(input)).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setEventPublished(id: string, published: boolean): Promise<void> {
  const { error } = await client().from('events').update({ published }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteEvent(event: EventItem): Promise<void> {
  const { error } = await client().from('events').delete().eq('id', event.id);
  if (error) throw new Error(error.message);
  if (event.imagePath) await removePicture(event.imagePath);
}

/* Pictures are shared with announcements: see services/pictures.ts. */
export const uploadEventImage = uploadPicture;
export const removeEventImage = removePicture;
export const eventImageUrl = pictureUrl;

/**
 * Places: things to try (food spots, hangouts, trips). Written by admins, read by everyone.
 * The database (Row Level Security) decides who may do what, not this file.
 */
import { supabase } from '../../services/database';
import { cached } from '../../services/offlineCache';
import { removePicture } from '../../services/pictures';
import type { Place, PlaceInput } from './places.types';

const COLUMNS = 'id, name, description, category_id, address, image_path, link, phone, latitude, longitude, published, created_at';

interface Row {
  id: string;
  name: string;
  description: string;
  category_id: number | null;
  address: string;
  image_path: string | null;
  link: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  published: boolean;
  created_at: string;
}

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

const fromRow = (r: Row): Place => ({
  id: r.id,
  name: r.name,
  description: r.description,
  categoryId: r.category_id,
  address: r.address,
  imagePath: r.image_path,
  link: r.link,
  phone: r.phone,
  latitude: r.latitude,
  longitude: r.longitude,
  published: r.published,
  createdAt: r.created_at,
});

const toRow = (i: PlaceInput) => ({
  name: i.name.trim(),
  description: i.description.trim(),
  category_id: i.categoryId,
  address: i.address.trim(),
  image_path: i.imagePath,
  link: i.link.trim(),
  phone: i.phone.trim(),
  latitude: i.latitude,
  longitude: i.longitude,
  published: i.published,
});

/** Admin view: everything, including hidden places. */
export async function listAllPlaces(): Promise<Place[]> {
  const { data, error } = await client().from('places').select(COLUMNS).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(fromRow);
}

/** Student view: published places, newest first. */
export async function listLivePlaces(): Promise<Place[]> {
  const rows = await cached('places', async () => {
    const { data, error } = await client()
      .from('places')
      .select(COLUMNS)
      .eq('published', true)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Row[];
  });
  return rows.map(fromRow);
}

export async function createPlace(input: PlaceInput): Promise<void> {
  const { error } = await client().from('places').insert(toRow(input));
  if (error) throw new Error(error.message);
}

export async function updatePlace(id: string, input: PlaceInput): Promise<void> {
  const { error } = await client().from('places').update(toRow(input)).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setPlacePublished(id: string, published: boolean): Promise<void> {
  const { error } = await client().from('places').update({ published }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deletePlace(place: Place): Promise<void> {
  const { error } = await client().from('places').delete().eq('id', place.id);
  if (error) throw new Error(error.message);
  if (place.imagePath) await removePicture(place.imagePath);
}

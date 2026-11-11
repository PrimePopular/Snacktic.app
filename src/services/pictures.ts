/**
 * Picture storage shared by events and announcements. Pictures are shrunk in the browser first
 * (see shared/image.ts) so free storage and data transfer last. Only admins can upload or remove;
 * anyone can view. Rules live in the database (supabase/005_events_categories_images.sql).
 */
import { resizeImage } from '../shared/image';
import { supabase } from './database';

const BUCKET = 'event-images';

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

/** Shrinks and uploads a picture. Returns the path to store on the event or announcement. */
export async function uploadPicture(file: File): Promise<string> {
  const { blob, extension } = await resizeImage(file);
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await client().storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000', // a picture never changes once uploaded, so browsers may keep it
  });
  if (error) throw new Error(error.message);
  return path;
}

/** Best effort: a leftover file is harmless, so failures are only logged. */
export async function removePicture(path: string): Promise<void> {
  try {
    const { error } = await client().storage.from(BUCKET).remove([path]);
    if (error) console.error('[pictures] could not remove', error.message);
  } catch (error) {
    console.error('[pictures] could not remove', error);
  }
}

export function pictureUrl(path: string): string {
  return supabase ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : '';
}

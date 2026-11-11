/**
 * The one place the Supabase client is created. Owned by the Backend developer.
 * Only the public (anon) key is ever used here. Security comes from Row Level Security
 * in the database, not from hiding this key.
 */
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Email links (password reset) bring the person back with tokens in the page address. supabase-js
 * reads and then removes them, so note here, before it starts, that we arrived from such a link.
 */
export const startedFromRecoveryLink = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash);
export const startedFromAuthEmail =
  typeof window !== 'undefined' && /type=recovery|error_code=/.test(window.location.hash);

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** False until .env.local is filled in. Screens use this to explain what is missing. */
export const isDatabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

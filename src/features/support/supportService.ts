/**
 * Support and Feedback. Anyone can send a report, even before signing up. Reports are saved in the database and the owner
 * is told in the app. Rules (limits per day, who can read) are in supabase/018_ebooks_ad_retries_feedback.sql.
 */
import { removePicture } from '../../services/pictures';
import { supabase } from '../../services/database';

export type FeedbackCategory = 'bug' | 'feature' | 'update' | 'other';
export type FeedbackStatus = 'new' | 'investigating' | 'in_progress' | 'fixed' | 'declined';

export const categoryLabels: Record<FeedbackCategory, string> = {
  bug: 'Report a bug',
  feature: 'Request a feature',
  update: 'Request an update',
  other: 'Something else',
};

export const statusLabels: Record<FeedbackStatus, string> = {
  new: 'New',
  investigating: 'Under investigation',
  in_progress: 'In progress',
  fixed: 'Fixed',
  declined: 'Declined',
};

export interface FeedbackInput {
  category: FeedbackCategory;
  title: string;
  description: string;
  expected: string;
  actual: string;
  contact: string;
  screenshotPath: string | null;
}

export interface FeedbackItem {
  id: string;
  from: string;
  category: FeedbackCategory;
  title: string;
  description: string;
  expected: string;
  actual: string;
  device: string;
  browser: string;
  appVersion: string;
  contact: string;
  screenshotPath: string | null;
  status: FeedbackStatus;
  createdAt: string;
}

export interface SupportContacts {
  email: string;
  whatsapp: string;
}

const SHOWABLE = [
  'Choose what this is about',
  'Please fill in the title and the details',
  'You have sent a lot today',
  'Too many reports right now',
];

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

/** Sends a report. Device, browser and app version are added automatically. */
export async function submitFeedback(input: FeedbackInput): Promise<void> {
  const device = `${navigator.platform || 'unknown'} · screen ${window.screen.width}x${window.screen.height} · ${window.devicePixelRatio}x`;
  const version = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'dev';
  const { error } = await client().rpc('submit_feedback', {
    p_category: input.category,
    p_title: input.title,
    p_description: input.description,
    p_expected: input.expected,
    p_actual: input.actual,
    p_device: device,
    p_browser: navigator.userAgent,
    p_version: version,
    p_screenshot: input.screenshotPath ?? '',
    p_contact: input.contact,
  });
  if (error) {
    const known = SHOWABLE.find((text) => error.message.includes(text));
    if (!known) console.error('[support] submit', error.message);
    throw new Error(known ? error.message : 'Something went wrong. Please try again.');
  }
}

/** The email and WhatsApp number shown on the Support page. Falls back to the defaults if they cannot be read. */
export async function getSupportContacts(): Promise<SupportContacts> {
  const fallback = { email: 'snacktic.service@gmail.com', whatsapp: '2349033000131' };
  if (!supabase) return fallback;
  try {
    const { data, error } = await supabase.from('app_settings').select('key, value').in('key', ['support_email', 'support_whatsapp']);
    if (error) throw new Error(error.message);
    const get = (key: string) => (data as { key: string; value: string }[]).find((s) => s.key === key)?.value ?? '';
    return { email: get('support_email') || fallback.email, whatsapp: get('support_whatsapp') || fallback.whatsapp };
  } catch (error) {
    console.error('[support] contacts', error);
    return fallback;
  }
}

/** Owner only. */
export async function saveSupportContacts(contacts: SupportContacts): Promise<void> {
  const rows = [
    { key: 'support_email', value: contacts.email.trim() },
    { key: 'support_whatsapp', value: contacts.whatsapp.replace(/[^0-9]/g, '') },
  ];
  const { error } = await client().from('app_settings').upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

interface FeedbackRow {
  id: string;
  category: FeedbackCategory;
  title: string;
  description: string;
  expected: string;
  actual: string;
  device: string;
  browser: string;
  app_version: string;
  contact: string;
  screenshot_path: string | null;
  status: FeedbackStatus;
  created_at: string;
  profiles: { username: string } | null;
}

export async function adminListFeedback(): Promise<FeedbackItem[]> {
  const { data, error } = await client()
    .from('feedback')
    .select('id, category, title, description, expected, actual, device, browser, app_version, contact, screenshot_path, status, created_at, profiles(username)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as FeedbackRow[]).map((r) => ({
    id: r.id,
    from: r.profiles?.username ?? 'Visitor (not signed in)',
    category: r.category,
    title: r.title,
    description: r.description,
    expected: r.expected,
    actual: r.actual,
    device: r.device,
    browser: r.browser,
    appVersion: r.app_version,
    contact: r.contact,
    screenshotPath: r.screenshot_path,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function adminSetFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
  const { error } = await client().from('feedback').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Owner only. Also removes the screenshot so it stops using storage. */
export async function adminDeleteFeedback(item: FeedbackItem): Promise<void> {
  const { error } = await client().from('feedback').delete().eq('id', item.id);
  if (error) throw new Error(error.message);
  if (item.screenshotPath) await removePicture(item.screenshotPath);
}

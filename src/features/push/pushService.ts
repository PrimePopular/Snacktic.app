/**
 * Phone notifications (Web Push). The student turns them on from Profile. Their phone gives us a
 * private address to send messages to, and the database remembers it. The messages themselves are
 * sent by Supabase Edge Functions, never by this app.
 */
import { supabase } from '../../services/database';

const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export type PushState =
  | 'not-configured' // the keys have not been added yet
  | 'unsupported' // this browser cannot receive notifications
  | 'needs-install' // iPhone: only works once Snacktic is on the Home Screen
  | 'blocked' // the student said no in the browser
  | 'off'
  | 'on';

export type PushPref = 'weather' | 'prayer' | 'games' | 'products';
export type PushPrefs = Record<PushPref, boolean>;

export interface PushStatus {
  state: PushState;
  prefs: PushPrefs;
}

const ALL_ON: PushPrefs = { weather: true, prayer: true, games: true, products: true };

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

function toKey(base64: string): ArrayBuffer {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function getPushStatus(): Promise<PushStatus> {
  const off = (state: PushState): PushStatus => ({ state, prefs: { ...ALL_ON } });
  if (!publicKey || !supabase) return off('not-configured');
  const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!capable) return off(isIos() && !isInstalled() ? 'needs-install' : 'unsupported');
  if (Notification.permission === 'denied') return off('blocked');
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return off('unsupported'); // not registered, for example while developing on this computer
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return off('off');
    const { data } = await client().from('push_subscriptions').select('weather, prayer, games, products').eq('endpoint', subscription.endpoint).maybeSingle();
    return { state: 'on', prefs: data ? (data as PushPrefs) : { ...ALL_ON } };
  } catch (error) {
    console.error('[push] status', error);
    return off('unsupported');
  }
}

/** Asks permission, subscribes this phone and saves it. Throws a readable message if it cannot. */
export async function enablePush(): Promise<void> {
  if (!publicKey) throw new Error('Notifications are not set up yet.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed. You can allow them in your browser settings.');
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) throw new Error('Notifications work in the installed app or the live website.');
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }));
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) throw new Error('This phone could not be set up for notifications.');
  const { error } = await client().rpc('save_push_subscription', { p_endpoint: json.endpoint, p_p256dh: p256dh, p_auth: auth });
  if (error) {
    console.error('[push] save', error.message);
    throw new Error('Could not save your notification setting. Please try again.');
  }
}

export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const { error } = await client().rpc('remove_push_subscription', { p_endpoint: endpoint });
  if (error) console.error('[push] remove', error.message);
}

/** Turns one kind of notification on or off for this phone. */
export async function setPushPref(kind: PushPref, on: boolean): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  const { error } = await client().rpc('set_push_pref', { p_endpoint: subscription.endpoint, p_kind: kind, p_on: on });
  if (error) throw new Error('Could not change that setting. Please try again.');
}

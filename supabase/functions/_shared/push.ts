// Shared by the two push functions. Runs on Supabase (Deno), never in the browser.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

export const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:snacktic.service@gmail.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

/** Only our own database webhook and scheduler know this secret. */
export function isAllowed(request: Request): boolean {
  const secret = Deno.env.get('PUSH_SECRET');
  return Boolean(secret) && request.headers.get('x-push-secret') === secret;
}

export interface Subscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface Message {
  title: string;
  body: string;
  /** A path inside the app, for example /find-a-friend. */
  link?: string;
}

/** Sends one message to many phones. Phones that no longer exist (404 or 410) are forgotten. */
export async function sendTo(subs: Subscription[], message: Message): Promise<{ sent: number; removed: number }> {
  const payload = JSON.stringify(message);
  let sent = 0;
  const gone: string[] = [];
  const queue = [...subs];

  async function worker() {
    for (let sub = queue.pop(); sub; sub = queue.pop()) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 60 * 60 * 12 });
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(sub.id);
        else console.error('push failed', status);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(10, subs.length) }, worker));

  if (gone.length > 0) await admin.from('push_subscriptions').delete().in('id', gone);
  return { sent, removed: gone.length };
}

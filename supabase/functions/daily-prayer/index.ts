// Called once a day by the scheduler (see docs/PUSH_SETUP.md), around midday.
// If the owner switched prayer reminders on and set a link, every phone with prayer reminders on gets a message
// that opens the school's prayer link.
import { admin, isAllowed, sendTo } from '../_shared/push.ts';

Deno.serve(async (request) => {
  if (!isAllowed(request)) return new Response('Not allowed', { status: 401 });
  try {
    const { data: settings } = await admin.from('app_settings').select('key, value').in('key', ['prayer_enabled', 'prayer_link']);
    const get = (key: string) => settings?.find((s) => s.key === key)?.value ?? '';
    const link = get('prayer_link').trim();
    if (get('prayer_enabled') !== 'true' || !link.startsWith('https://')) return new Response('Prayer reminders are off', { status: 200 });

    const { data: subs, error } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('prayer', true);
    if (error) throw error;
    const result = await sendTo(subs ?? [], { title: 'Time for prayers', body: 'Tap to open the school prayer link.', link });
    return Response.json(result);
  } catch (error) {
    console.error(error);
    return new Response('Failed', { status: 500 });
  }
});

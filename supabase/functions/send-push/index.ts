// Called by a Database Webhook every time a row is added to "notifications".
// Sends that message to every phone the student turned notifications on for.
import { admin, isAllowed, sendTo } from '../_shared/push.ts';

Deno.serve(async (request) => {
  if (!isAllowed(request)) return new Response('Not allowed', { status: 401 });
  try {
    const payload = await request.json();
    const record = payload?.record;
    if (!record?.user_id || !record?.title) return new Response('Nothing to send', { status: 200 });

    const { data, error } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', record.user_id);
    if (error) throw error;
    const result = await sendTo(data ?? [], { title: record.title, body: record.body ?? '', link: record.link || '/' });
    return Response.json(result);
  } catch (error) {
    console.error(error);
    return new Response('Failed', { status: 500 });
  }
});

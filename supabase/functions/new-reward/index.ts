// Called by a Database Webhook whenever a row is added to "rewards" (see docs/PUSH_SETUP.md).
// Tells every phone with "new rewards" on that something new is in the shop.
import { admin, isAllowed, sendTo } from '../_shared/push.ts';

Deno.serve(async (request) => {
  if (!isAllowed(request)) return new Response('Not allowed', { status: 401 });
  try {
    const record = (await request.json())?.record;
    if (!record?.name || record.active === false || (record.stock !== null && record.stock !== undefined && record.stock <= 0)) {
      return new Response('Nothing to announce', { status: 200 });
    }
    const { data: subs, error } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('products', true);
    if (error) throw error;
    const result = await sendTo(subs ?? [], {
      title: 'New in Rewards',
      body: `${record.name} is now available for ${record.cost_points} Crumb Points.`,
      link: '/rewards',
    });
    return Response.json(result);
  } catch (error) {
    console.error(error);
    return new Response('Failed', { status: 500 });
  }
});

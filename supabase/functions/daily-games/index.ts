// Called once a day by the scheduler (see docs/PUSH_SETUP.md), in the afternoon or evening.
// Reminds students that the daily game challenges are waiting.
import { admin, isAllowed, sendTo } from '../_shared/push.ts';

Deno.serve(async (request) => {
  if (!isAllowed(request)) return new Response('Not allowed', { status: 401 });
  try {
    const { data: setting } = await admin.from('app_settings').select('value').eq('key', 'games_enabled').maybeSingle();
    if (setting?.value === 'false') return new Response('Game reminders are off', { status: 200 });

    const { data: rules } = await admin.from('game_rules').select('title').eq('active', true).eq('is_daily_challenge', true);
    const titles = [...new Set((rules ?? []).map((r) => r.title))];
    const body = titles.length > 0
      ? `Today's challenges are waiting in ${titles.join(', ')}. Play to win points and earn prizes!`
      : 'Games are waiting. Play to win points and earn prizes!';

    const { data: subs, error } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('games', true);
    if (error) throw error;
    const result = await sendTo(subs ?? [], { title: 'Time to play!', body, link: '/games' });
    return Response.json(result);
  } catch (error) {
    console.error(error);
    return new Response('Failed', { status: 500 });
  }
});

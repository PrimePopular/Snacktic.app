// ONE function for every phone notification. Paste this whole file into a Supabase Edge Function named "push"
// (see docs/PUSH_SETUP.md). Every call must send the header x-push-secret with your PUSH_SECRET.
//
//   ?kind=scheduled   called every minute by the scheduler. Sends whatever is due in Admin, Daily notifications.
//   ?kind=message     called by a Database Webhook when a row is added to "notifications" (a gift, a prize, a report...).
//   ?kind=reward      called by a Database Webhook when a row is added to "rewards" (a new item in the market).
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:snacktic.service@gmail.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

/** How many phones one call may message. Large audiences are sent over several calls (one a minute). */
const BATCH = Number(Deno.env.get('PUSH_BATCH') ?? '150');

interface Sub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  latitude?: number | null;
  longitude?: number | null;
  place_name?: string;
}
interface Message {
  title: string;
  body: string;
  link?: string;
}

const json = (value: unknown) => Response.json(value);

/** Sends to many phones. Phones that no longer exist (404 or 410) are forgotten. */
async function sendTo(subs: Sub[], message: Message, ttlSeconds: number): Promise<number> {
  const payload = JSON.stringify(message);
  let sent = 0;
  const gone: string[] = [];
  const queue = [...subs];
  async function worker() {
    for (let sub = queue.pop(); sub; sub = queue.pop()) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: Math.max(60, ttlSeconds) });
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
  return sent;
}

/* ------------------------------- weather ---------------------------------- */

interface Day {
  code: number;
  high: number;
  low: number;
  rainChance: number;
  rainMm: number;
  sunshine: number | null;
  daylight: number | null;
  uv: number;
  cloud: number | null;
}

// The same rules as the weather card in the app (src/features/weather/weather.ts).
function outlook(day: Day, place: string): string {
  const sun = day.sunshine !== null && day.daylight ? Math.min(1, day.sunshine / day.daylight) : null;
  const clear = day.cloud !== null ? 1 - day.cloud / 100 : null;
  const brightness = sun !== null && clear !== null ? (sun + clear) / 2 : (sun ?? clear ?? 0.5);
  let summary: string;
  if (day.code >= 95) summary = 'Thunderstorms';
  else if (day.rainChance >= 60 || day.rainMm >= 3 || (day.code >= 61 && day.code <= 82)) summary = 'Rainy';
  else if (day.code === 45 || day.code === 48) summary = 'Foggy';
  else if (brightness >= 0.7) summary = 'Sunny';
  else if (brightness >= 0.45) summary = 'Partly sunny';
  else summary = 'Cloudy';

  const advice: string[] = [];
  if (day.rainChance >= 60) advice.push('Take an umbrella.');
  else if (day.rainChance >= 30) advice.push(`Slight chance of rain (${day.rainChance}%), so keep an umbrella handy.`);
  if (day.high >= 32) advice.push('It will be hot. Wear something light and drink plenty of water.');
  else if (day.high >= 28) advice.push('Warm day. Light clothes will do.');
  else if (day.high < 22) advice.push('Cool day. A light jacket is a good idea.');
  if (day.uv >= 8 && brightness >= 0.45) advice.push('Strong sun: sunglasses or a cap will help.');
  if (advice.length === 0) advice.push('A comfortable day ahead.');
  return `${summary} today${place ? ` in ${place}` : ''}, ${day.low}° to ${day.high}°. ${advice.join(' ')}`;
}

async function weatherText(lat: number, lon: number, place: string): Promise<string | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=cloud_cover` +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunshine_duration,daylight_duration,uv_index_max' +
      '&timezone=auto&forecast_days=1';
    const response = await fetch(url);
    if (!response.ok) return null;
    const j = await response.json();
    const cloud: number[] = (j.hourly?.cloud_cover ?? []).slice(7, 18).filter((n: unknown) => typeof n === 'number');
    return outlook(
      {
        code: Number(j.daily.weather_code[0]),
        high: Math.round(j.daily.temperature_2m_max[0]),
        low: Math.round(j.daily.temperature_2m_min[0]),
        rainChance: Math.round(j.daily.precipitation_probability_max?.[0] ?? 0),
        rainMm: Number(j.daily.precipitation_sum?.[0] ?? 0),
        sunshine: typeof j.daily.sunshine_duration?.[0] === 'number' ? j.daily.sunshine_duration[0] : null,
        daylight: typeof j.daily.daylight_duration?.[0] === 'number' ? j.daily.daylight_duration[0] : null,
        uv: Number(j.daily.uv_index_max?.[0] ?? 0),
        cloud: cloud.length > 0 ? cloud.reduce((a, b) => a + b, 0) / cloud.length : null,
      },
      place,
    );
  } catch (error) {
    console.error('weather', error);
    return null;
  }
}

/* ------------------------------ scheduled --------------------------------- */

const PREFERENCE: Record<string, string> = { weather: 'weather', prayer: 'prayer', games: 'games', custom: 'general' };

interface Schedule {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  send_time: string;
  repeat: string;
  start_date: string | null;
  end_date: string | null;
  valid_minutes: number;
  enabled: boolean;
}

async function runScheduled() {
  const { data: tzRow } = await admin.from('app_settings').select('value').eq('key', 'notify_timezone').maybeSingle();
  const timeZone = tzRow?.value || 'Africa/Lagos';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const nowMin = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
  const weekend = parts.weekday === 'Sat' || parts.weekday === 'Sun';

  const { data: schedules } = await admin.from('scheduled_notifications').select('*').eq('enabled', true);
  const due = ((schedules ?? []) as Schedule[]).filter((s) => {
    if (s.start_date && today < s.start_date) return false;
    if (s.end_date && today > s.end_date) return false;
    if (s.repeat === 'weekdays' && weekend) return false;
    if (s.repeat === 'weekends' && !weekend) return false;
    const [h, m] = s.send_time.split(':').map(Number);
    const start = h * 60 + m;
    return nowMin >= start && nowMin < start + s.valid_minutes;
  });

  let budget = BATCH;
  const report: Record<string, number> = {};
  for (const schedule of due) {
    if (budget <= 0) break;
    const pref = PREFERENCE[schedule.kind];
    const { data: all } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth, latitude, longitude, place_name').eq(pref, true).limit(10000);
    const { data: already } = await admin.from('push_sent').select('sub_id').eq('schedule_id', schedule.id).eq('day', today).limit(20000);
    const done = new Set((already ?? []).map((r: { sub_id: string }) => r.sub_id));
    const todo = ((all ?? []) as Sub[]).filter((s) => !done.has(s.id)).slice(0, budget);
    if (todo.length === 0) continue;

    const [h, m] = schedule.send_time.split(':').map(Number);
    const ttl = (h * 60 + m + schedule.valid_minutes - nowMin) * 60;
    const link = schedule.link || '/';
    let sent = 0;

    if (schedule.kind === 'weather' && !schedule.body) {
      // Weather is written for each student's own place (rounded to about 10 km). Phones with no place use the campus.
      const { data: settings } = await admin.from('app_settings').select('key, value').in('key', ['campus_name', 'campus_latitude', 'campus_longitude']);
      const get = (k: string): string => settings?.find((row: { key: string; value: string }) => row.key === k)?.value ?? '';
      const campus = get('campus_latitude') && get('campus_longitude') ? { lat: Number(get('campus_latitude')), lon: Number(get('campus_longitude')), name: get('campus_name') } : null;
      type Group = { lat: number; lon: number; name: string; subs: Sub[] };
      const groups = new Map<string, Group>();
      for (const sub of todo) {
        const cell =
          sub.latitude != null && sub.longitude != null
            ? { lat: sub.latitude, lon: sub.longitude, name: sub.place_name ?? '' }
            : campus;
        if (!cell) continue;
        const key = `${cell.lat.toFixed(1)},${cell.lon.toFixed(1)}`;
        const group: Group = groups.get(key) ?? { lat: cell.lat, lon: cell.lon, name: cell.name, subs: [] };
        group.subs.push(sub);
        groups.set(key, group);
      }
      for (const group of groups.values()) {
        const text = await weatherText(group.lat, group.lon, group.name);
        if (!text) continue;
        sent += await sendTo(group.subs, { title: schedule.title, body: text, link }, ttl);
      }
    } else {
      sent = await sendTo(todo, { title: schedule.title, body: schedule.body, link }, ttl);
    }

    // Note every phone we tried today, so nobody gets it twice and the next call continues with the rest.
    await admin.from('push_sent').upsert(todo.map((s) => ({ schedule_id: schedule.id, sub_id: s.id, day: today })), { onConflict: 'schedule_id,sub_id,day', ignoreDuplicates: true });
    budget -= todo.length;
    report[schedule.kind] = (report[schedule.kind] ?? 0) + sent;
  }
  return { checked: due.length, sent: report };
}

/* --------------------------------- webhooks -------------------------------- */

async function sendMessage(payload: { record?: { user_id?: string; title?: string; body?: string; link?: string } }) {
  const r = payload.record;
  if (!r?.user_id || !r.title) return { sent: 0 };
  const { data } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', r.user_id);
  const link = r.link && (r.link.startsWith('/') || r.link.startsWith('https://')) ? r.link : '/';
  return { sent: await sendTo((data ?? []) as Sub[], { title: r.title, body: r.body ?? '', link }, 86400) };
}

async function announceReward(payload: { record?: { name?: string; cost_points?: number; active?: boolean; stock?: number | null } }) {
  const r = payload.record;
  if (!r?.name || r.active === false || (r.stock !== null && r.stock !== undefined && r.stock <= 0)) return { sent: 0 };
  const { data } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('products', true).limit(BATCH * 4);
  return { sent: await sendTo((data ?? []) as Sub[], { title: 'New in Rewards', body: `${r.name} is now available for ${r.cost_points} Crumb Points.`, link: '/rewards' }, 86400) };
}

Deno.serve(async (request) => {
  const secret = Deno.env.get('PUSH_SECRET');
  if (!secret || request.headers.get('x-push-secret') !== secret) return new Response('Not allowed', { status: 401 });
  try {
    const kind = new URL(request.url).searchParams.get('kind');
    if (kind === 'scheduled') return json(await runScheduled());
    if (kind === 'message') return json(await sendMessage(await request.json()));
    if (kind === 'reward') return json(await announceReward(await request.json()));
    return new Response('Unknown kind', { status: 400 });
  } catch (error) {
    console.error(error);
    return new Response('Failed', { status: 500 });
  }
});

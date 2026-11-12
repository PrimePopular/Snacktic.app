// Called once each morning by the scheduler (see docs/PUSH_SETUP.md).
// Looks up today's weather for the campus (free service, no key) and sends it to every phone with weather on.
import { admin, isAllowed, sendTo } from '../_shared/push.ts';

function describe(code: number): string {
  if (code === 0) return 'Clear skies';
  if (code <= 2) return 'Mostly sunny';
  if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Light drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Mixed weather';
}

Deno.serve(async (request) => {
  if (!isAllowed(request)) return new Response('Not allowed', { status: 401 });
  try {
    const { data: settings } = await admin.from('app_settings').select('key, value').in('key', ['campus_name', 'campus_latitude', 'campus_longitude']);
    const get = (key: string) => settings?.find((s) => s.key === key)?.value ?? '';
    const lat = Number(get('campus_latitude'));
    const lon = Number(get('campus_longitude'));
    if (!get('campus_latitude') || !get('campus_longitude') || Number.isNaN(lat) || Number.isNaN(lon)) {
      return new Response('Campus location is not set', { status: 200 });
    }

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1';
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather service answered ${response.status}`);
    const daily = (await response.json()).daily;
    const high = Math.round(daily.temperature_2m_max[0]);
    const low = Math.round(daily.temperature_2m_min[0]);
    const rain = Math.round(daily.precipitation_probability_max?.[0] ?? 0);
    const place = get('campus_name') || 'campus';

    const { data: subs, error } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('weather', true);
    if (error) throw error;
    const result = await sendTo(subs ?? [], {
      title: `Good morning! Today at ${place}`,
      body: `${describe(daily.weather_code[0])}, ${low}° to ${high}°. ${rain >= 40 ? `${rain}% chance of rain, take an umbrella. ` : ''}Good snacks, good moments.`,
      link: '/',
    });
    return Response.json(result);
  } catch (error) {
    console.error(error);
    return new Response('Failed', { status: 500 });
  }
});

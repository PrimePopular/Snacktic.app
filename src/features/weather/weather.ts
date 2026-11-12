/**
 * Today's weather for the campus, from Open-Meteo (free, no account, no key). The owner sets the
 * campus name and position in the admin. If they are not set, no weather is shown.
 */
import { supabase } from '../../services/database';

export interface Weather {
  place: string;
  now: number;
  high: number;
  low: number;
  rainChance: number;
  summary: string;
  emoji: string;
}

const CACHE_KEY = 'snacktic.weather';
const CACHE_MS = 30 * 60_000;

export function describeWeather(code: number): { summary: string; emoji: string } {
  if (code === 0) return { summary: 'Clear skies', emoji: '☀️' };
  if (code <= 2) return { summary: 'Mostly sunny', emoji: '🌤️' };
  if (code === 3) return { summary: 'Cloudy', emoji: '☁️' };
  if (code === 45 || code === 48) return { summary: 'Foggy', emoji: '🌫️' };
  if (code >= 51 && code <= 57) return { summary: 'Light drizzle', emoji: '🌦️' };
  if (code >= 61 && code <= 67) return { summary: 'Rain', emoji: '🌧️' };
  if (code >= 80 && code <= 82) return { summary: 'Rain showers', emoji: '🌦️' };
  if (code >= 95) return { summary: 'Thunderstorms', emoji: '⛈️' };
  return { summary: 'Mixed weather', emoji: '🌥️' };
}

function readCache(): Weather | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: Weather };
    return Date.now() - at < CACHE_MS ? data : null;
  } catch {
    return null;
  }
}

/** Never throws: the weather is a nicety, so any problem simply means no card. */
export async function getCampusWeather(): Promise<Weather | null> {
  const cached = readCache();
  if (cached) return cached;
  if (!supabase) return null;
  try {
    const { data: settings, error } = await supabase.from('app_settings').select('key, value').in('key', ['campus_name', 'campus_latitude', 'campus_longitude']);
    if (error) throw new Error(error.message);
    const get = (key: string) => (settings as { key: string; value: string }[]).find((s) => s.key === key)?.value ?? '';
    const lat = Number(get('campus_latitude'));
    const lon = Number(get('campus_longitude'));
    if (!get('campus_latitude') || !get('campus_longitude') || Number.isNaN(lat) || Number.isNaN(lon)) return null;

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1';
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather service answered ${response.status}`);
    const json = await response.json();
    const { summary, emoji } = describeWeather(Number(json.current.weather_code));
    const weather: Weather = {
      place: get('campus_name') || 'Campus',
      now: Math.round(json.current.temperature_2m),
      high: Math.round(json.daily.temperature_2m_max[0]),
      low: Math.round(json.daily.temperature_2m_min[0]),
      rainChance: Math.round(json.daily.precipitation_probability_max?.[0] ?? 0),
      summary,
      emoji,
    };
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: weather }));
    } catch {
      /* storage unavailable: fine */
    }
    return weather;
  } catch (error) {
    console.error('[weather]', error);
    return null;
  }
}

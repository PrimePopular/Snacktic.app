/**
 * Weather for a place, from Open-Meteo (free, no account, no key). Each student gets the weather for their own place:
 * their phone's location if they allow it, or a place they search for. If they have chosen neither, the campus the owner
 * set in the admin is used. Their chosen place stays on their phone.
 */
import { supabase } from '../../services/database';

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

export interface Weather {
  place: string;
  now: number;
  high: number;
  low: number;
  rainChance: number;
  summary: string;
  emoji: string;
}

const PLACE_KEY = 'snacktic.place';
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

/** The place this student chose (or allowed), kept on their phone. */
export function getSavedPlace(): Place | null {
  try {
    const raw = localStorage.getItem(PLACE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Place;
    return Number.isFinite(p.lat) && Number.isFinite(p.lon) && typeof p.name === 'string' ? p : null;
  } catch {
    return null;
  }
}

export function savePlace(place: Place | null): void {
  try {
    if (place) localStorage.setItem(PLACE_KEY, JSON.stringify(place));
    else localStorage.removeItem(PLACE_KEY);
  } catch {
    /* storage unavailable: the weather simply is not remembered */
  }
}

/** The campus the owner set in the admin, used until a student picks their own place. Never throws. */
export async function getCampusPlace(): Promise<Place | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('app_settings').select('key, value').in('key', ['campus_name', 'campus_latitude', 'campus_longitude']);
    if (error) throw new Error(error.message);
    const get = (key: string) => (data as { key: string; value: string }[]).find((s) => s.key === key)?.value ?? '';
    const lat = Number(get('campus_latitude'));
    const lon = Number(get('campus_longitude'));
    if (!get('campus_latitude') || !get('campus_longitude') || Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { name: get('campus_name') || 'Campus', lat, lon };
  } catch (error) {
    console.error('[weather] campus', error);
    return null;
  }
}

/** Looks places up by name (free, no key). */
export async function searchPlaces(query: string): Promise<Place[]> {
  const text = query.trim();
  if (text.length < 2) return [];
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=6&language=en&name=${encodeURIComponent(text)}`);
  if (!response.ok) throw new Error('Search is not available right now.');
  const json = (await response.json()) as { results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[] };
  return (json.results ?? []).map((r) => ({ name: [r.name, r.admin1].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude }));
}

/** Asks the phone where it is (the student is asked for permission) and names the area. */
export async function locateMe(): Promise<Place> {
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This browser cannot find your location.'));
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('We could not get your location. Allow location access, or search for your place.')), {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 10 * 60_000,
    });
  });
  const lat = Math.round(position.coords.latitude * 100) / 100;
  const lon = Math.round(position.coords.longitude * 100) / 100;
  let name = 'Your area';
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    if (r.ok) {
      const j = (await r.json()) as { city?: string; locality?: string; principalSubdivision?: string };
      name = j.city || j.locality || j.principalSubdivision || name;
    }
  } catch {
    /* the name is only a label */
  }
  return { name, lat, lon };
}

/** Today's weather for a place. Never throws: the weather is a nicety, so any problem simply means no card. */
export async function fetchWeather(place: Place): Promise<Weather | null> {
  const key = `snacktic.weather.${place.lat.toFixed(2)},${place.lon.toFixed(2)}`;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const { at, data } = JSON.parse(raw) as { at: number; data: Weather };
      if (Date.now() - at < CACHE_MS) return { ...data, place: place.name };
    }
  } catch {
    /* ignore a bad cache */
  }
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
      '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1';
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather service answered ${response.status}`);
    const json = await response.json();
    const { summary, emoji } = describeWeather(Number(json.current.weather_code));
    const weather: Weather = {
      place: place.name,
      now: Math.round(json.current.temperature_2m),
      high: Math.round(json.daily.temperature_2m_max[0]),
      low: Math.round(json.daily.temperature_2m_min[0]),
      rainChance: Math.round(json.daily.precipitation_probability_max?.[0] ?? 0),
      summary,
      emoji,
    };
    try {
      sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data: weather }));
    } catch {
      /* fine */
    }
    return weather;
  } catch (error) {
    console.error('[weather]', error);
    return null;
  }
}

import { useCallback, useEffect, useId, useState } from 'react';
import { Button, Modal, TextField } from '../../shared/components';
import { fetchWeather, getCampusPlace, getSavedPlace, locateMe, savePlace, searchPlaces } from './weather';
import type { Place, Weather } from './weather';
import './weather.css';

/**
 * The weather card on Home. It shows the weather for the student's own place: their phone's location if they allow it,
 * a place they search for, or the campus the owner set until they choose.
 */
export function WeatherCard() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [asked, setAsked] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const titleId = useId();

  const show = useCallback(async (place: Place) => {
    setWeather(await fetchWeather(place));
    setAsked(true);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const saved = getSavedPlace();
      if (saved) return active && show(saved);
      // If the student already allowed location earlier, use it quietly. Otherwise fall back to the campus.
      try {
        const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
        if (status?.state === 'granted') {
          const place = await locateMe();
          savePlace(place);
          return active && show(place);
        }
      } catch {
        /* permission lookup is not supported everywhere: carry on */
      }
      const campus = await getCampusPlace();
      if (!active) return;
      if (campus) await show(campus);
      else setAsked(true);
    })();
    return () => {
      active = false;
    };
  }, [show]);

  async function useMyLocation() {
    setBusy(true);
    setMessage(null);
    try {
      const place = await locateMe();
      savePlace(place);
      await show(place);
      setOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  async function search() {
    setBusy(true);
    setMessage(null);
    try {
      const found = await searchPlaces(query);
      setResults(found);
      if (found.length === 0) setMessage('No places found. Try another spelling.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  async function choose(place: Place) {
    savePlace(place);
    await show(place);
    setOpen(false);
    setResults([]);
    setQuery('');
  }

  if (!asked) return null;

  return (
    <>
      {weather ? (
        <section className="weather-card" aria-label={`Weather at ${weather.place}`}>
          <span className="weather-card__emoji" aria-hidden="true">{weather.emoji}</span>
          <div className="weather-card__text">
            <strong>
              {weather.now}° in {weather.place}
            </strong>
            <p>
              {weather.summary}. Today {weather.low}° to {weather.high}°.
              {weather.rainChance >= 40 ? ` ${weather.rainChance}% chance of rain, take an umbrella.` : ''}
            </p>
          </div>
          <button type="button" className="link-button" onClick={() => setOpen(true)}>
            Change
          </button>
        </section>
      ) : (
        <section className="weather-card">
          <span className="weather-card__emoji" aria-hidden="true">🌤️</span>
          <div className="weather-card__text">
            <strong>Today's weather</strong>
            <p>Share your location or pick a place to see the weather where you are.</p>
          </div>
          <Button onClick={() => setOpen(true)}>Set place</Button>
        </section>
      )}

      <Modal open={open} onClose={() => setOpen(false)} labelledBy={titleId}>
        <div className="weather-picker">
          <h2 id={titleId}>Where are you?</h2>
          <Button disabled={busy} onClick={() => void useMyLocation()}>
            Use my location
          </Button>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void search();
            }}
          >
            <TextField label="Or search for a place" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
            <Button type="submit" variant="secondary" disabled={busy || query.trim().length < 2}>
              Search
            </Button>
          </form>
          {message && <p className="text-small" role="status">{message}</p>}
          {results.length > 0 && (
            <ul className="weather-picker__list">
              {results.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button type="button" className="link-button" onClick={() => void choose(r)}>
                    {r.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
}

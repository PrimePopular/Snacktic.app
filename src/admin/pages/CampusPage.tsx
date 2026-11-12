import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getCampusLocation, saveCampusLocation } from '../../features/weather';
import { Button, Loading, TextField } from '../../shared/components';

/** Campus location, owner only. Used for the weather card on Home and the daily weather message. */
export function CampusPage() {
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getCampusLocation()
      .then((c) => {
        setName(c.name);
        setLatitude(c.latitude);
        setLongitude(c.longitude);
      })
      .catch((err: unknown) => {
        console.error('[admin] campus', err);
        setError('Could not load the saved location. Make sure supabase/013_push_and_weather.sql has been run.');
      })
      .finally(() => setLoaded(true));
  }, []);

  function useMyLocation() {
    setError(null);
    if (!navigator.geolocation) return setError('This browser cannot find your location.');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(5));
        setLongitude(position.coords.longitude.toFixed(5));
      },
      () => setError('Could not get your location. Allow location access, or type the two numbers.'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const empty = latitude.trim() === '' && longitude.trim() === '';
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!empty && (!(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180) || latitude.trim() === '' || longitude.trim() === '')) {
      return setError('Enter both numbers: latitude between -90 and 90, longitude between -180 and 180.');
    }
    setBusy(true);
    try {
      await saveCampusLocation({ name, latitude, longitude });
      setMessage(empty ? 'Cleared. The weather is hidden.' : 'Saved. The weather now shows on Home.');
    } catch (err) {
      console.error('[admin] campus', err);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  if (!loaded) return <Loading label="Loading" />;

  return (
    <section aria-labelledby="campus-heading" className="ann">
      <h1 id="campus-heading">Campus location</h1>
      <p className="text-secondary">Used for the weather card on Home and the daily weather message. Leave the numbers empty to hide the weather.</p>
      <form className="ann__form" onSubmit={(e) => void handleSave(e)} noValidate>
        <TextField label="Campus name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} hint="Shown in the weather, for example Enugu campus." />
        <div className="ann__actions">
          <Button variant="secondary" onClick={useMyLocation}>Use my current location</Button>
        </div>
        <TextField label="Latitude" type="number" inputMode="decimal" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
        <TextField label="Longitude" type="number" inputMode="decimal" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} hint="Standing on campus? Tap the button. Otherwise, in Google Maps press and hold on the spot and copy the two numbers." />
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-notice" role="status">{message}</p>}
        <div className="ann__actions">
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </section>
  );
}

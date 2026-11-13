import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getDailyNotificationSettings, saveDailyNotificationSettings } from '../../features/push';
import { Button, CheckboxField, Loading, TextField } from '../../shared/components';
import { safeLink } from '../../shared/url';

/** Daily notifications, owner only: the prayer reminder (with the school's prayer link) and the games reminder. */
export function DailyNotificationsPage() {
  const [loaded, setLoaded] = useState(false);
  const [prayerEnabled, setPrayerEnabled] = useState(false);
  const [prayerLink, setPrayerLink] = useState('');
  const [gamesEnabled, setGamesEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getDailyNotificationSettings()
      .then((s) => {
        setPrayerEnabled(s.prayerEnabled);
        setPrayerLink(s.prayerLink);
        setGamesEnabled(s.gamesEnabled);
      })
      .catch((err: unknown) => {
        console.error('[admin] daily notifications', err);
        setError('Could not load the saved settings. Make sure supabase/015_stock_prefs_cookie_wall.sql has been run.');
      })
      .finally(() => setLoaded(true));
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (prayerEnabled && !safeLink(prayerLink)?.startsWith('https://')) {
      return setError('To turn on prayer reminders, enter the full prayer link, starting with https://');
    }
    setBusy(true);
    try {
      await saveDailyNotificationSettings({ prayerEnabled, prayerLink, gamesEnabled });
      setMessage('Saved.');
    } catch (err) {
      console.error('[admin] daily notifications', err);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  if (!loaded) return <Loading label="Loading" />;

  return (
    <section aria-labelledby="dn-heading" className="ann">
      <h1 id="dn-heading">Daily notifications</h1>
      <p className="text-secondary">
        Students choose which of these they want in Profile. Weather is set up in Campus location. The time each one is sent is set once in the notification setup guide (docs/PUSH_SETUP.md).
      </p>
      <form className="ann__form" onSubmit={(e) => void handleSave(e)} noValidate>
        <CheckboxField checked={prayerEnabled} onChange={(e) => setPrayerEnabled(e.target.checked)}>
          Send the daily prayer reminder
        </CheckboxField>
        <TextField label="Prayer link" type="url" inputMode="url" value={prayerLink} onChange={(e) => setPrayerLink(e.target.value)} hint="The school website page for prayers. Tapping the notification opens it." autoCapitalize="none" />
        <CheckboxField checked={gamesEnabled} onChange={(e) => setGamesEnabled(e.target.checked)}>
          Send the daily games reminder
        </CheckboxField>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-notice" role="status">{message}</p>}
        <div className="ann__actions">
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </section>
  );
}

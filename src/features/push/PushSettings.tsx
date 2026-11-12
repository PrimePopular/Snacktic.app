import { useCallback, useEffect, useState } from 'react';
import { Button, CheckboxField } from '../../shared/components';
import { disablePush, enablePush, getPushStatus, setWeatherPush } from './pushService';
import type { PushStatus } from './pushService';

/** The notification switches in Profile. Hidden until the notification keys have been added. */
export function PushSettings() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => setStatus(await getPushStatus()), []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    }
    await refresh();
    setBusy(false);
  }

  if (!status || status.state === 'not-configured') return null;

  return (
    <div className="push-settings">
      <h4>Phone notifications</h4>
      {status.state === 'unsupported' && (
        <p className="text-secondary text-small">This browser can't receive notifications. Installing Snacktic from the live website usually fixes this.</p>
      )}
      {status.state === 'needs-install' && (
        <p className="text-secondary text-small">On iPhone, first add Snacktic to your Home Screen (Share, then Add to Home Screen) and open it from there.</p>
      )}
      {status.state === 'blocked' && (
        <p className="text-secondary text-small">Notifications are blocked for Snacktic. Allow them in your browser or phone settings, then come back.</p>
      )}
      {status.state === 'off' && (
        <>
          <p className="text-secondary text-small">Get a message on your phone when something happens, even when Snacktic is closed.</p>
          <Button disabled={busy} onClick={() => void run(enablePush)}>
            {busy ? 'Turning on…' : 'Turn on notifications'}
          </Button>
        </>
      )}
      {status.state === 'on' && (
        <>
          <CheckboxField checked={status.weather} disabled={busy} onChange={(event) => void run(() => setWeatherPush(event.target.checked))}>
            Daily weather each morning
          </CheckboxField>
          <Button variant="secondary" disabled={busy} onClick={() => void run(disablePush)}>
            Turn off notifications on this phone
          </Button>
        </>
      )}
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

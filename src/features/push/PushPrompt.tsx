import { useEffect, useState } from 'react';
import { useAuth } from '../authentication';
import { Button, Card } from '../../shared/components';
import { enablePush, getPushStatus, updatePushLocation } from './pushService';
import './push.css';

const ASKED_KEY = 'snacktic.pushAsked';
const WEEK = 7 * 24 * 60 * 60 * 1000;

function lastAsked(): number {
  try {
    return Number(localStorage.getItem(ASKED_KEY) ?? 0);
  } catch {
    return 0;
  }
}

function markAsked(): void {
  try {
    localStorage.setItem(ASKED_KEY, String(Date.now()));
  } catch {
    /* fine */
  }
}

/**
 * Notifications are on by default for everyone (all kinds start switched on). A phone only allows them after the student
 * says yes once, so this friendly card asks right after they sign in. One tap turns everything on. If they say "Not now"
 * it asks again after a week, never more often. Hidden where notifications cannot work (for example an iPhone that has not
 * added Snacktic to the Home Screen) or when the student already chose.
 */
export function PushPrompt() {
  const { status } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'signed-in') {
      setShow(false);
      return;
    }
    if (Date.now() - lastAsked() < WEEK) return;
    let active = true;
    void getPushStatus().then((s) => {
      if (active && s.state === 'off') setShow(true);
    });
    return () => {
      active = false;
    };
  }, [status]);

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      await enablePush();
      void import('../weather').then(({ locateMe }) => locateMe()).then(updatePushLocation).catch(() => undefined);
      markAsked();
      setShow(false);
    } catch (err) {
      markAsked();
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  function later() {
    markAsked();
    setShow(false);
  }

  if (!show) return null;
  return (
    <div className="push-prompt">
      <Card tone="warm">
        <h3>Never miss a thing</h3>
        <p className="text-secondary text-small">
          Get the morning weather, game and prayer reminders, and new rewards on your phone. You can switch any of them off in Profile.
        </p>
        <div className="push-prompt__actions">
          <Button disabled={busy} onClick={() => void turnOn()}>
            {busy ? 'Turning on…' : 'Turn on notifications'}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={later}>
            Not now
          </Button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}

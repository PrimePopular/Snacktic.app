import { useSyncExternalStore } from 'react';
import { Button, Card } from '../shared/components';

/** The browser's install offer. Not in TypeScript's built-in types, so described here. */
interface InstallOffer extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let offer: InstallOffer | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Start listening as early as possible: the browser only announces the offer once. */
export function listenForInstallOffer(): void {
  installed = isStandalone();
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    offer = event as InstallOffer;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    offer = null;
    notify();
  });
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

const snapshot = () => (installed ? 'installed' : offer ? 'offer' : 'none');

/** A card that helps the student put Snacktic on their home screen. Shows nothing when it cannot help. */
export function InstallCard() {
  const state = useSyncExternalStore(subscribe, snapshot, () => 'none');
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (state === 'installed') return null;

  if (state === 'offer') {
    return (
      <Card tone="warm" className="install-card">
        <h3>Get the app</h3>
        <p className="text-secondary text-small">Add Snacktic to your home screen. It opens fast and works with a weak connection.</p>
        <Button
          onClick={async () => {
            if (!offer) return;
            await offer.prompt();
            await offer.userChoice;
            offer = null;
            notify();
          }}
        >
          Install Snacktic
        </Button>
      </Card>
    );
  }

  if (isIos) {
    return (
      <Card tone="warm" className="install-card">
        <h3>Get the app</h3>
        <ol className="text-secondary text-small install-steps">
          <li>
            Open Snacktic in <strong>Safari</strong> (not Chrome).
          </li>
          <li>
            Tap the <strong>Share</strong> button (the square with an arrow, at the bottom).
          </li>
          <li>
            Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
          </li>
          <li>Open Snacktic from your home screen. Notifications on iPhone only work from there.</li>
        </ol>
      </Card>
    );
  }

  // No one-tap install offer from the browser (Android sometimes holds it back): show the steps instead.
  const isAndroid = /android/i.test(navigator.userAgent);
  return (
    <Card tone="warm" className="install-card">
      <h3>Get the app</h3>
      {isAndroid ? (
        <p className="text-secondary text-small">
          In Chrome, tap the <strong>⋮ menu</strong> (top right), then <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
        </p>
      ) : (
        <p className="text-secondary text-small">
          In Chrome or Edge, click the install icon at the right end of the address bar, or open the browser menu and choose <strong>Install Snacktic</strong>.
        </p>
      )}
    </Card>
  );
}

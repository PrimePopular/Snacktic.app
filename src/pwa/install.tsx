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
        <p className="text-secondary text-small">
          In Safari, tap the Share button, then <strong>Add to Home Screen</strong>.
        </p>
      </Card>
    );
  }

  return null;
}

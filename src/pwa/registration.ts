/**
 * PWA setup, called once from main.tsx. Owned by the PWA developer.
 *  - Registers the service worker (public/sw.js), but only in the real (production) build, so
 *    developing locally never fights with saved files.
 *  - Catches the browser's "install this app" offer so the Profile page can show an Install button.
 *  - Tells the app when a newer version has been installed in the background, so it can offer a refresh.
 */
import { listenForInstallOffer } from './install';

export const UPDATE_READY_EVENT = 'snacktic:update-ready';

export function registerPwa(): void {
  listenForInstallOffer();
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  // The very first install also changes the controller; only a change after that means "new version".
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.dispatchEvent(new Event(UPDATE_READY_EVENT));
    hadController = true;
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // An installed app can stay open for days: look for a new version whenever it comes back on screen.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void registration.update().catch(() => undefined);
        });
      })
      .catch((error) => console.error('[pwa] could not register', error));
  });
}

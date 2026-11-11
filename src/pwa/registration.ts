/**
 * PWA setup, called once from main.tsx. Owned by the PWA developer.
 *  - Registers the service worker (public/sw.js), but only in the real (production) build, so
 *    developing locally never fights with saved files.
 *  - Catches the browser's "install this app" offer so the Profile page can show an Install button.
 */
import { listenForInstallOffer } from './install';

export function registerPwa(): void {
  listenForInstallOffer();
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.error('[pwa] could not register', error));
  });
}

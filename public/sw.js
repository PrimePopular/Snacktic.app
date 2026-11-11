/*
 * Snacktic service worker: a helper that runs in the background of the phone's browser.
 * It saves the app's files on the phone so Snacktic opens instantly, opens with no internet, and
 * can be installed like an app.
 *
 * Rules that keep it safe:
 *  - It NEVER touches the database or sign-in calls (points, accounts, gifts, orders must always
 *    be live, never a stale copy).
 *  - App files and fonts are kept and refreshed quietly in the background.
 *  - Pictures from storage are kept (up to a limit) so they load fast and use less data.
 *  - Changing VERSION below discards all saved files on the next visit.
 */
const VERSION = 'v1';
const SHELL = `snacktic-shell-${VERSION}`;
const RUNTIME = `snacktic-runtime-${VERSION}`;
const IMAGES = `snacktic-images-${VERSION}`;
const KEEP = [SHELL, RUNTIME, IMAGES];
const MAX_IMAGES = 80;

const SHELL_FILES = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/images/logo-mark.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => !KEEP.includes(name)).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirstShell(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(SHELL);
      cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    // Offline: every page of the app is the same HTML, so serve the saved copy.
    return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
  }
}

async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response && (response.status === 200 || response.type === 'opaque')) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return saved || (await refresh) || Response.error();
}

async function cacheFirstLimited(cacheName, request, max) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response && response.status === 200) {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]); // drop the oldest
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never handle the service worker itself.
  if (url.origin === self.location.origin && url.pathname === '/sw.js') return;

  // Database and sign-in traffic: always live. Only public pictures may be kept.
  if (url.hostname.endsWith('.supabase.co')) {
    if (url.pathname.startsWith('/storage/v1/object/public/')) {
      event.respondWith(cacheFirstLimited(IMAGES, request, MAX_IMAGES));
    }
    return;
  }

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(networkFirstShell(request));
    } else {
      event.respondWith(staleWhileRevalidate(RUNTIME, request));
    }
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(RUNTIME, request));
  }
  // Anything else (maps, other sites) is left alone.
});

/*
 * LYRIQ service worker: keeps the app shell available offline.
 *
 * Songs, takes and beats already live in IndexedDB / localStorage, so the only thing
 * missing offline was the page itself. This caches:
 *   - page navigations: network first, cached copy when offline
 *   - /_next/static/*: cache first (file names are content-hashed, so they never go stale)
 *   - icons, manifest and Google Fonts: served from cache, refreshed in the background
 * API calls (/api/*) and anything that is not a GET are never cached.
 *
 * Bump VERSION to drop every old cache on the next visit.
 */
const VERSION = 'v1';
const SHELL_CACHE = `lyriq-shell-${VERSION}`;
const ASSET_CACHE = `lyriq-assets-${VERSION}`;
const PRECACHE = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // One missing file must not block the install, so cache each on its own.
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('lyriq-') && key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

const isFont = (url) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = (await cache.match(request, { ignoreSearch: true })) || (await cache.match('/'));
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || refresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return;
    if (request.mode === 'navigate') {
      event.respondWith(networkFirstPage(request));
      return;
    }
    if (url.pathname.startsWith('/_next/static/')) {
      event.respondWith(cacheFirst(request));
      return;
    }
    if (/\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)) {
      event.respondWith(staleWhileRevalidate(request));
    }
    return;
  }

  if (isFont(url)) event.respondWith(staleWhileRevalidate(request));
});

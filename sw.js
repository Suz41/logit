/**
 * Log!t Service Worker (PWA Offline Shell & Asset Cache)
 * Strategy:
 * - HTML Pages: Network-first, falling back to cache when offline.
 * - Static Assets (CSS, JS, Images, Fonts): Cache-first, falling back to network.
 * - API & Authentication: Always network; never cache sensitive credentials or tokens.
 */

const CACHE_NAME = 'logit-v1';

const APP_SHELL = [
  './',
  './index.html',
  './companion.html',
  './pending.html',
  './profile.html',
  './stats.html',
  './about.html',
  './welcome.html',
  './site.webmanifest',
  './css/main.css',
  './css/components.css',
  './css/library.css',
  './css/modal.css',
  './css/desktop.css',
  './css/animations.css',
  './css/auth.css',
  './css/companion.css',
  './css/pending.css',
  './css/profile.css',
  './css/stats.css',
  './css/about.css',
  './js/constants.js',
  './js/config.js',
  './js/utils.js',
  './js/statutils.js',
  './js/movieFactory.js',
  './js/movies.js',
  './js/search.js',
  './js/storage.js',
  './js/supabase.js',
  './js/auth.js',
  './js/drive.js',
  './js/export.js',
  './js/import.js',
  './js/parser.js',
  './js/pending.js',
  './js/library.js',
  './js/app.js',
  './assets/images/favicon.ico',
  './assets/images/favicon-32x32.png',
  './assets/images/favicon-16x16.png',
  './assets/images/apple-touch-icon.png',
  './assets/images/android-chrome-192x192.png',
  './assets/images/android-chrome-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn('[SW] Cache addAll warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Purging old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Never cache non-GET requests or external API calls with private auth/data
  if (
    req.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('accounts.google.com')
  ) {
    return;
  }

  // 2. HTML navigation requests: Network-first, fallback to cache
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = await caches.match('./index.html');
          return fallback || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        })
    );
    return;
  }

  // 3. Static assets: Cache-first, fallback to network
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached immediately, fetch in background to refresh cache
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
          }
        }).catch(() => {/* offline */});
        return cachedResponse;
      }

      return fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return networkResponse;
      });
    })
  );
});

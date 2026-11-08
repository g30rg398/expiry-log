// Offline cache for the app shell. Bump VERSION whenever you change any file
// so phones pick up the new version (it applies on the next app launch).

const VERSION = 'v2.2.0';
const CACHE = `expiry-shell-${VERSION}`;
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/data/schema.js',
  './js/data/db.js',
  './js/data/repo.js',
  './js/lib/dates.js',
  './js/lib/images.js',
  './js/lib/scanner.js',
  './js/lib/lookup.js',
  './js/i18n/index.js',
  './js/i18n/en.js',
  './js/i18n/uk.js',
  './js/i18n/ru.js',
  './js/ui/dom.js',
  './js/ui/departments.js',
  './js/ui/sweep.js',
  './js/ui/due.js',
  './js/ui/history.js',
  './js/ui/settings.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('expiry-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Same-origin GETs: cache first, network fallback. Other origins (Open Food Facts) pass through.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)),
  );
});

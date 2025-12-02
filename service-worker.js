const CACHE_NAME = 'budget-tracker-v7';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/auth.html',
  '/styles.css',
  '/manifest.json',
  '/app.js',
  '/db.js',
  '/auth-gate.js',
  '/auth.js',
  '/offline.html',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
];

// 1. Install Event — cache files individually to avoid failure
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('Opened cache, adding files...');
      for (const url of URLS_TO_CACHE) {
        try {
          await cache.add(url);
          console.log(`Cached: ${url}`);
        } catch (err) {
          console.warn(`Skipped caching ${url}:`, err);
        }
      }
    })
  );
  self.skipWaiting();
});

// 2. Activate Event — clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// 3. Fetch Event — cache-first, fallback to network, offline.html for navigations
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== 'basic'
          ) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            if (
              event.request.url.startsWith('http') &&
              !event.request.url.includes('google-analytics')
            ) {
              cache.put(event.request, responseToCache);
            }
          });

          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
        });
    })
  );
});

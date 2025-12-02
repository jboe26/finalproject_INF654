// service-worker.js

const CACHE_NAME = 'budget-tracker-v7'; // Updated version for new project
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
  // Add Materialize CDN/Icons
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://fonts.gstatic.com/s/materialicons/v142/flUhRq6tzZclQEJ-Vdg-I-zDflJc.woff2'
];

// 1. Install Event: Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache, adding files...');
        return cache.addAll(URLS_TO_CACHE).catch(error => {
            console.error('Failed to cache resources:', error);
        });
      })
  );
  self.skipWaiting();
});

// 2. Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Event: Serve from cache first, then network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(event.request).then(
          (response) => {
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                if (event.request.url.startsWith('http') && !event.request.url.includes('google-analytics')) {
                    cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        ).catch(() => {
            if (event.request.mode === 'navigate') {
                // If fetching any page fails, show the general offline page
                return caches.match('/offline.html'); 
            }
        });
      })
  );
});
const CACHE = 'singulax-studio-v8';

const ASSETS = [
  './',
  './index.html',
  './full-ide.html',
  './lite-ide.html',
  './app.js',
  './runtime.js',
  './style.css',
  './manifest.webmanifest',
  './sw.js',
  './logo.png',
  './singulax-icon.png',
  '../runtime/sglx.mjs'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;

        return fetch(event.request)
          .then(response => {
            const copy = response.clone();

            caches.open(CACHE).then(cache => {
              cache.put(event.request, copy);
            });

            return response;
          })
          .catch(() => caches.match('./lite-ide.html'));
      })
  );
});

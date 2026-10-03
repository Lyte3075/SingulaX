const CACHE = 'singulax-studio-v10';

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
  const request = event.request;
  const isPage = request.mode === 'navigate' ||
    request.destination === 'document' ||
    /\.html(?:$|\?)/i.test(new URL(request.url).pathname);

  if (isPage) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;

        return fetch(request)
          .then(response => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then(cache => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => caches.match('./lite-ide.html'));
      })
  );
});

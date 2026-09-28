const CACHE_PREFIX = 'buildchamp-shell-';
/* global self, caches, URL, fetch, Response */

const CACHE_NAME = '__BUILDCHAMP_CACHE_NAME__';
const PRECACHE_URLS = '__PRECACHE_URLS__';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
          const response = await fetch(request);
          if (response.ok) {
            await cache.put(request, response.clone());
            await cache.put('/index.html', response.clone());
          }
          return response;
        } catch {
          return (
            (await cache.match(request, { ignoreVary: true })) ??
            (await cache.match('/index.html', { ignoreVary: true })) ??
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  if (!['script', 'style', 'image', 'font'].includes(request.destination)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request, { ignoreVary: true });
      if (cachedResponse) {
        return cachedResponse;
      }

      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});

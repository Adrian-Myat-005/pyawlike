// Service Worker: CACHE BYPASS MODE
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

// Always fetch from network, never from cache
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

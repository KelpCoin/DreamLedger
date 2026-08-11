const CACHE_NAME = 'dreamledger-shop-v1';
const SHELL = ['/shop', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname === '/api/catalog' || url.pathname.startsWith('/api/checkout')) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});

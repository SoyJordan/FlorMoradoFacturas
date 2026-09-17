const CACHE = 'flor-morado-v1-4-7';

const ASSETS = [
  './',
  './index.html',
  './css/styles.css?v=1.4.7',
  './js/app.js?v=1.4.7',
  './manifest.json',
  './assets/logo-flor-morado.jpg',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys =>
        Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
      )
    ])
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(response => response || caches.match('./index.html'))
      )
  );
});

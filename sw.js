// Bump CACHE_VERSION when precached files change, as an extra safety net —
// navigation requests below are network-first, so this mainly protects
// icons/manifest/Chart.js from going stale.
const CACHE_VERSION = 'v2';
const CACHE = 'estudos-' + CACHE_VERSION;
const ARQUIVOS = [
  './', './index.html', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if(event.request.method !== 'GET') return;

  const isNavegacao = event.request.mode === 'navigate' || event.request.destination === 'document';
  if(isNavegacao){
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          caches.open(CACHE).then(c => c.put(event.request, resp.clone()));
          return resp;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => {
      if(resp.ok){ caches.open(CACHE).then(c => c.put(event.request, resp.clone())); }
      return resp;
    }))
  );
});

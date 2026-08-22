// Bump CACHE_VERSION when precached files change, as an extra safety net —
// navigation requests below are network-first, so this mainly protects
// icons/manifest/Chart.js from going stale.
const CACHE_VERSION = 'v6';
const CACHE = 'estudos-' + CACHE_VERSION;
const LOCAIS = [
  './', './index.html', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png',
  './erros-ia.js', './erros-ia-modelo.js', './erros-ia-repeticao.js',
  './erros-ia-export.js', './erros-ia-import.js',
];
const CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(LOCAIS).then(() => c.add(CDN).catch(() => {})))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
  );
  self.clients.claim();
});

const HOSTS_SEM_CACHE = ['googleapis.com', 'google.com', 'firebaseapp.com', 'firebaseio.com', 'gstatic.com'];

self.addEventListener('fetch', (event) => {
  if(event.request.method !== 'GET') return;

  const host = new URL(event.request.url).hostname;
  if(host !== 'fonts.gstatic.com' && HOSTS_SEM_CACHE.some(h => host === h || host.endsWith('.' + h))) return;

  const isNavegacao = event.request.mode === 'navigate' || event.request.destination === 'document';
  if(isNavegacao){
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          if(resp.ok){ caches.open(CACHE).then(c => c.put(event.request, resp.clone())); }
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

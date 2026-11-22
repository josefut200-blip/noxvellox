const CACHE_NAME = 'noxvellox-shell-v1';
const SHELL = [
  '/',
  '/videos',
  '/categories',
  '/channels',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/assets/style.v027.css?ver=0.4.4',
  '/assets/home-dashboard.v029.css?ver=0.4.1',
  '/assets/channel-page.v031.css?ver=0.4.0',
  '/assets/site.v027.js?ver=0.3.7'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if(request.method !== 'GET' || url.origin !== self.location.origin) return;
  const isShellAsset = url.pathname === '/manifest.webmanifest' || url.pathname === '/favicon.svg' || url.pathname.startsWith('/assets/');
  if(!isShellAsset && request.mode !== 'navigate') return;
  event.respondWith((async() => {
    try {
      const network = await fetch(request);
      if(network.ok && isShellAsset){
        const copy = network.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return network;
    } catch {
      const cached = await caches.match(request);
      return cached || (request.mode === 'navigate' ? caches.match('/') : Response.error());
    }
  })());
});

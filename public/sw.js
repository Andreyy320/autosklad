const CACHE = 'avtodetal-v2';
const CORE = [
  '/', '/style.css', '/script.js', '/resizable-columns.js',
  '/mobile.css', '/mobile.js', '/manifest.webmanifest',
  '/logs', '/logs.css', '/logs-mobile.css', '/logs.js',
  '/icons/icon-192.png', '/icons/icon-512.png'
];
const STATIC_RE = /\.(?:js|css|html|png|svg|ico|webmanifest|woff2?|ttf)$/i;
const NET_TIMEOUT = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(CORE.map((url) => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const net = fetch(request).then((res) => {
    if (res && res.ok && res.type === 'basic') cache.put(request, res.clone());
    return res;
  });
  try {
    return await Promise.race([
      net,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NET_TIMEOUT))
    ]);
  } catch (e) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const home = await cache.match('/');
      if (home) return home;
    }
    return net;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const fresh = fetch(request).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  }).catch(() => cached);
  return cached || fresh;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    if (url.hostname === 'cdnjs.cloudflare.com') {
      event.respondWith(staleWhileRevalidate(req));
    }
    return;
  }
  if (url.pathname.startsWith('/api/')) return;   // данные только с сервера

  const isPage = req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/logs';
  if (isPage || STATIC_RE.test(url.pathname)) {
    event.respondWith(networkFirst(req));
  }
});
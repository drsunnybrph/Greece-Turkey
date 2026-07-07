/* Greece → Turkey 2026 — offline service worker
   HTML page  → network-first: always grab the latest when you have signal,
                fall back to the cached copy offline. Edits appear on next open,
                with NO cache-version bump ever again.
   Icons / currency API / other GETs → stale-while-revalidate: instant from
                cache, refreshed quietly in the background. */
const CACHE = 'gt2026-7cb77c2';                 // ← last bump you'll ever need
const CORE = ['index.html', 'icon.png', 'apple-touch-icon.png'];
const NET_TIMEOUT = 3000;                  // ms before falling back to cache on a slow network

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(CORE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  e.respondWith(isHTML ? networkFirst(req) : staleWhileRevalidate(req));
});

/* Latest-when-online, cached-when-not. Refreshes the cache on every success,
   and a short timer keeps a weak signal from stalling the app. */
function networkFirst(req) {
  const fromCache = () =>
    caches.match(req).then((hit) => hit || caches.match('index.html'));

  const net = fetch(req)
    .then((res) => {
      caches.open(CACHE).then((c) => c.put(req, res.clone()));
      return res;
    })
    .catch(() => null);

  const timer = new Promise((resolve) => setTimeout(() => resolve(null), NET_TIMEOUT));

  return Promise.race([net, timer]).then((res) => res || fromCache().then((hit) => hit || net));
}

/* Instant from cache, quietly refreshed for next time (good for icons + live FX rates). */
function staleWhileRevalidate(req) {
  return caches.match(req).then((cached) => {
    const net = fetch(req)
      .then((res) => {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          caches.open(CACHE).then((c) => c.put(req, res.clone()));
        }
        return res;
      })
      .catch(() => cached);
    return cached || net;
  });
}

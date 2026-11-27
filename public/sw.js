/* SantalStock service worker (v30). Makes the app installable, fast on repeat visits, and usable offline. */
const VER = 'ss-v30';
const SHELL = `${VER}-shell`;
const ASSETS = `${VER}-assets`;
const IMGS = `${VER}-img`;
const IMG_MAX = 300;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png'])).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VER)).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: always try the network first so a new deploy shows at once; offline falls back to the saved app.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || Response.error()))
    );
    return;
  }

  // Built JS/CSS/fonts have a hash in the name and never change: cache first.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Public preview photos: show the saved copy instantly, refresh it in the background.
  if (url.pathname.startsWith('/api/img/prev/')) {
    e.respondWith(
      caches.open(IMGS).then((c) =>
        c.match(req).then((hit) => {
          const net = fetch(req)
            .then((res) => {
              if (res.ok) {
                c.put(req, res.clone());
                trim(IMGS, IMG_MAX);
              }
              return res;
            })
            .catch(() => hit || Response.error());
          return hit || net;
        })
      )
    );
    return;
  }
  // Everything else (/api data, full-size paid files, login) always goes to the network.
});

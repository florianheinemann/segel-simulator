// Service Worker: macht die App offline nutzbar, ohne alte Versionen festzuhalten.
// BUILD und FILES werden beim Bauen eingesetzt (siehe vite.config.ts); dadurch
// ändert sich diese Datei mit jedem Build und der Browser installiert sie neu.
const BUILD = /*BUILD*/ 'dev';
const FILES = /*FILES*/ [];
const CACHE = `segelsim-${BUILD}`;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // 'reload' umgeht den HTTP-Cache des Browsers
      Promise.all(FILES.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => {}))),
    ),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Versionsabfrage geht immer direkt ins Netz
  if (url.pathname.endsWith('/version.json')) return;

  // Dateien mit Hash im Namen ändern sich nie: Cache zuerst
  if (url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(e.request.url, { ignoreVary: true }).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
            return res.clone();
          }),
      ),
    );
    return;
  }

  // Alles andere (vor allem index.html): Netz zuerst und am HTTP-Cache vorbei,
  // nur ohne Verbindung aus dem Cache
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request.url, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(e.request.url, { ignoreSearch: true, ignoreVary: true });
        if (hit) return hit;
        if (e.request.mode === 'navigate') {
          const index = await caches.match('./', { ignoreVary: true });
          if (index) return index;
        }
        return Response.error();
      }),
  );
});

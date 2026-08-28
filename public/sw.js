/*
 * MDSolids Web service worker — offline support after first visit.
 *
 * Strategy: network-first with cache fallback for same-origin GETs, caching
 * each successful response at runtime. This needs no build-time manifest, so
 * it works with Vite's hashed asset names and at any base path (GitHub Pages
 * or Vercel). Bump CACHE to invalidate everything.
 */
const CACHE = "mdsolids-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Precache the app entry so navigations work offline even if the first
  // visit ended before runtime caching saw them.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["./"])).catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // Persist a successful response; tied to waitUntil so the worker is not
  // terminated mid-write, with quota/partial-response rejections swallowed.
  const store = (res) => {
    if (res.ok && res.status !== 206) {
      const copy = res.clone();
      event.waitUntil(
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {}),
      );
    }
    return res;
  };

  // Vite's hashed bundles are immutable — cache-first spares a network
  // round-trip on every repeat load. Everything else is network-first so
  // deploys show up immediately.
  if (new URL(req.url).pathname.includes("/assets/")) {
    event.respondWith(
      caches.match(req).then((cached) => cached ?? fetch(req).then(store)),
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then(store)
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        // Offline navigation to a deep link: serve the cached app shell.
        if (req.mode === "navigate") {
          const shell = await caches.match("./");
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});

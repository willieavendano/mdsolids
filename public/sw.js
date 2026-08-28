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
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
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

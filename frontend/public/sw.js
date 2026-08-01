// Minimal service worker: runtime cache of same-origin GETs so the app shell
// loads offline, with a network-first strategy (fresh when online, cached when
// not). Data itself is cached separately (encrypted) in the app.

// Bumped whenever the shipped assets must supersede what a phone already has.
// A byte-identical sw.js is never treated as an update by the browser.
const CACHE = "skipp-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never cache the backend/API

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      } catch {
        const cached = await caches.match(req);
        return cached || (await caches.match("/")) || Response.error();
      }
    })(),
  );
});

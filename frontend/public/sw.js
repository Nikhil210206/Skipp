// Minimal service worker: runtime cache of same-origin GETs so the app shell
// loads offline, with a network-first strategy (fresh when online, cached when
// not). Data itself is cached separately (encrypted) in the app.

// Bumped whenever the shipped assets must supersede what a phone already has.
// A byte-identical sw.js is never treated as an update by the browser.
const CACHE = "skipp-v4";

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

// Local notifications only: there is no `push` listener, deliberately.
// Nothing on a server sends to this app. Notifications are raised by the page
// itself via `registration.showNotification` when it notices a class is close
// or that the portal recorded attendance. This handler exists so that TAPPING
// one still opens the right screen.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    (async () => {
      const url = new URL(target, self.location.origin);
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Reuse a tab that is already open rather than piling up new ones. On an
      // installed PWA there is only ever the one, and focusing it is what makes
      // the notification feel like it belongs to the app.
      for (const client of windows) {
        if (new URL(client.url).pathname === url.pathname) return client.focus();
      }
      const first = windows[0];
      if (first) {
        await first.focus();
        return "navigate" in first ? first.navigate(url.href) : undefined;
      }
      return self.clients.openWindow(url.href);
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

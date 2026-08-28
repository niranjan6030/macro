/*
 * The service worker exists for two reasons.
 *
 * One: Chrome will not offer "Install app" without a fetch handler
 * registered, however complete the manifest is. That requirement is the whole
 * reason a static site ever ships one of these.
 *
 * Two: the shell should survive a dead connection. Gym basements have no
 * signal, and an app that cannot open its own page to show you yesterday's
 * numbers is not much of an app.
 *
 * The strategy is deliberately network-first for everything. A food diary
 * that serves you a cached day is worse than one that fails — the numbers are
 * the product, and stale numbers are wrong numbers. The cache is a fallback
 * for when the network has already failed, never a shortcut past it.
 */

const CACHE = "macro-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API responses are never cached: a stale diary is a wrong diary.
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        // A navigation with nothing cached still gets the shell.
        if (request.mode === "navigate") {
          const shell = await caches.match("/");
          if (shell) return shell;
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }),
  );
});

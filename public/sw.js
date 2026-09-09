/**
 * Xtrude service worker.
 *
 * Phase 0.5 has no backend, so there is nothing dynamic to reconcile - the
 * whole job is making the shell open instantly and work with no network.
 *
 * VERSION is rewritten at build time by scripts/stamp-sw.mjs, so every deploy
 * gets a fresh cache and stale chunk references can't strand a client.
 */

const VERSION = "dev";
const CACHE = `xtrude-${VERSION}`;

/** Routes worth having before the first offline open. */
const SHELL = [
  "/",
  "/sessions/",
  "/league/",
  "/profile/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // One failed URL must not fail the whole install, so add them singly.
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Hashed build output is immutable: serve from cache, fetch only on a miss. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

/** Pages: prefer the network so a deploy is picked up, fall back to cache. */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Offline and this exact page was never cached - the shell still opens.
    const shell = await caches.match("/");
    if (shell) return shell;
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

/** Everything else: serve what we have, refresh it in the background. */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  return cached || network || fetch(request);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

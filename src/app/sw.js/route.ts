import { NextResponse } from "next/server";

/**
 * The service worker as a route handler, not a static `public/` file.
 *
 * Phase 0.5 stamped a build id into `out/sw.js` as a postbuild step, because
 * a static export has no server to compute anything at request time. Now
 * that there is a server, Vercel already gives every deployment a stable id
 * for free (`VERCEL_GIT_COMMIT_SHA`) - reading it here is simpler than a
 * separate build step, and it's naturally "dev" with no special-casing when
 * running locally where that variable isn't set.
 */
const VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? "dev";

const SOURCE = `
/**
 * Xtrude service worker.
 *
 * Phase 1 has a live backend now, so pages are no longer immutable - the
 * caching strategy below still holds: network-first for navigations means a
 * signed-in reload always sees fresh session data when online, and only
 * falls back to the last-seen cache when offline.
 */

const VERSION = ${JSON.stringify(VERSION)};
const CACHE = \`xtrude-\${VERSION}\`;

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
  "/icons/shortcut-96.png",
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

/** Pages: prefer the network so a deploy - or new data - is picked up, fall back to cache. */
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

self.addEventListener("push", (event) => {
  let data = { title: "Xtrude", body: "", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* ignore malformed payloads */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
      icon: "/icons/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(self.clients.openWindow(url));
});
`;

export function GET() {
  return new NextResponse(SOURCE, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}

const CACHE_NAME = "devflow-v4";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/manifest.json",
];

// The SPA rewrite answers any missing asset URL with index.html at HTTP 200,
// so a plain response.ok check would store HTML under a .js/.css/.woff key.
// Cache-first reads then replay that HTML forever, and the browser fails to
// parse it as the script/type it asked for. v4 also evicts entries a v3 run
// may already have poisoned.
function cacheable(response) {
  const type = response.headers.get("content-type") || "";
  return response.ok && !type.includes("text/html");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

// CACHE_NAME is a constant, so every deploy's hashed chunks pile up in the
// same cache: activate only evicts when the cache name changes, and the
// cache-first path never deletes. Left alone, each deploy leaves dead JS/CSS
// copies behind (tens of MB after a few weeks) until the browser evicts the
// whole origin under storage pressure, which also throws away the live ones.
// The sweep reads the live filenames from index.html and the entry bundle
// (Vite bakes every lazy chunk name into it as a string literal) and deletes
// anything else under /assets/. A miss in either direction is harmless:
// over-deleting costs a refetch, under-deleting leaves an unused copy.
async function sweepStaleAssets() {
  const cache = await caches.open(CACHE_NAME);
  const keys = (await cache.keys())
    .map((request) => request.url)
    .filter((url) => new URL(url).pathname.startsWith("/assets/"));
  if (keys.length === 0) return;

  // A SW-initiated fetch bypasses this worker's fetch handler, so this goes
  // straight to the network and can never read a cached old shell.
  const html = await (await fetch("/index.html", { cache: "no-store" })).text();
  const entryMatch = html.match(/\/assets\/[\w.-]+\.js/);
  if (!entryMatch) return;
  const entry = await (await fetch(entryMatch[0], { cache: "no-store" })).text();
  const css = html.match(/\/assets\/[\w.-]+\.css/g) || [];
  const live = new Set(
    (entry.match(/assets\/[\w.-]+\.(?:js|css)/g) || [])
      .map((path) => path.split("/").pop())
      .concat(css.map((path) => path.split("/").pop())),
  );
  for (const url of keys) {
    const file = new URL(url).pathname.split("/").pop();
    if (!live.has(file)) await cache.delete(url);
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(sweepStaleAssets)
      .catch(() => {})
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Never cache or intercept API calls or SignalR hubs or backend domain
  if (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/hubs") ||
    url.hostname.includes("onrender.com") ||
    !url.protocol.startsWith("http")
  ) {
    return;
  }

  // SPA navigation fallback for HTML pages
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/index.html").then((cached) => cached || Response.error()),
      ),
    );
    return;
  }

  // Static assets: cache-first with network fallback and background refresh
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        fetch(event.request)
          .then((response) => {
            if (cacheable(response)) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
          })
          .catch(() => {});
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (cacheable(response)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(
            (fallback) => fallback ?? new Response("", { status: 404 }),
          ),
        );
    }),
  );
});

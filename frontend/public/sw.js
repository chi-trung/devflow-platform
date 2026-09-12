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

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ),
    ),
  );
  self.clients.claim();
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

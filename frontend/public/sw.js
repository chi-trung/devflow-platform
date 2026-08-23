const CACHE_NAME = "devflow-v3";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/manifest.json",
];

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
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
          })
          .catch(() => {});
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
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

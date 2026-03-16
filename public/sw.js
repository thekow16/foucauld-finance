const CACHE_NAME = "alphaview-v1";
const STATIC_ASSETS = [
  "/foucauld-finance/",
  "/foucauld-finance/favicon.svg",
];

// Install: pre-cache the shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin API calls
  if (request.method !== "GET") return;

  // For API calls (Yahoo, FMP, proxies): network only, no caching
  if (
    url.hostname.includes("yahoo.com") ||
    url.hostname.includes("financialmodelingprep") ||
    url.hostname.includes("allorigins") ||
    url.hostname.includes("corsproxy") ||
    url.hostname.includes("workers.dev") ||
    url.hostname.includes("translate.googleapis.com")
  ) {
    return;
  }

  // For same-origin: stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
  }
});

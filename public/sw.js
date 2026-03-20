const CACHE_NAME = "alphaview-v2";
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

// Offline fallback HTML (embedded to avoid extra network request)
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Foucauld Finance — Hors ligne</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',-apple-system,sans-serif;background:#0b0f1a;color:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center}
    .wrap{max-width:420px}
    h1{font-size:28px;font-weight:900;letter-spacing:-.5px;margin-bottom:12px}
    p{color:#94a3b8;font-size:15px;line-height:1.6;margin-bottom:24px}
    button{background:#2563eb;color:#fff;border:none;border-radius:12px;padding:14px 28px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .2s}
    button:hover{background:#1d4ed8}
    .icon{font-size:48px;margin-bottom:16px}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="icon">&#x1F4E1;</div>
    <h1>Connexion perdue</h1>
    <p>Vérifiez votre connexion internet puis réessayez. Les données en cache restent accessibles.</p>
    <button onclick="location.reload()">Réessayer</button>
  </div>
</body>
</html>`;

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== "GET") return;

  // For API calls: network only, no caching
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

  // Hashed assets (e.g. /assets/index-abc123.js): cache-first (immutable)
  if (url.pathname.includes("/assets/") && /\.[a-f0-9]{8,}\.(js|css|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // For same-origin navigation: network-first with offline fallback
  if (url.origin === self.location.origin && request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) =>
            cached || new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })
          )
        )
    );
    return;
  }

  // For other same-origin assets: stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
  }
});

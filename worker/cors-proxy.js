/**
 * Cloudflare Worker — Proxy CORS pour Yahoo Finance avec gestion du crumb
 *
 * Redéploiement :
 *   cd worker
 *   wrangler deploy cors-proxy.js --name foucauld-proxy --compatibility-date 2024-01-01 --no-bundle
 *
 * Monitoring :
 *   GET /health → { status: "ok", crumbCached: bool, uptime: timestamp }
 *   Configurer un check externe (UptimeRobot, Better Uptime, etc.) sur :
 *     https://foucauld-proxy.foucauld-finance.workers.dev/health
 *   Alerte si status != 200 pendant 2 minutes consécutives.
 *
 * Rate limiting :
 *   30 requêtes/minute par IP. Retourne 429 si dépassé.
 */

const ALLOWED_HOSTS = [
  "query1.finance.yahoo.com",
  "query2.finance.yahoo.com",
  "data.sec.gov",
  "www.sec.gov",
  "efts.sec.gov",
  "api.anthropic.com",
  "financialmodelingprep.com",
  "www.macrotrends.net",
];

// ── Rate limiter par IP (en mémoire, reset au redéploiement) ──
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30;  // 30 req/min par IP

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  // Nettoyage périodique (évite fuite mémoire)
  if (rateLimitMap.size > 10_000) {
    for (const [key, val] of rateLimitMap) {
      if (now - val.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(key);
    }
  }
  return entry.count <= RATE_LIMIT_MAX_REQUESTS;
}

// Cache crumb + cookie en mémoire (persiste entre les requêtes sur le même isolate)
let cachedCrumb = null;
let cachedCookie = null;
let crumbExpiry = 0;

async function getCrumb() {
  if (cachedCrumb && Date.now() < crumbExpiry) {
    return { crumb: cachedCrumb, cookie: cachedCookie };
  }

  // 1. Récupérer un cookie Yahoo
  const cookieResp = await fetch("https://fc.yahoo.com", {
    redirect: "manual",
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  const setCookie = cookieResp.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0]; // ex: "A3=d=AQ..."

  // 2. Récupérer le crumb avec ce cookie
  const crumbResp = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Cookie": cookie,
    },
  });
  const crumb = await crumbResp.text();

  if (!crumb || crumb.includes("Too Many") || crumb.length > 50) {
    throw new Error("Impossible d'obtenir le crumb Yahoo");
  }

  // Cache pour 30 minutes
  cachedCrumb = crumb;
  cachedCookie = cookie;
  crumbExpiry = Date.now() + 30 * 60 * 1000;

  return { crumb, cookie };
}

// ── Origines autorisées (CORS) ──
const ALLOWED_ORIGINS = [
  "https://thekow16.github.io",
  "http://localhost:5173",   // Vite dev server
  "http://localhost:4173",   // Vite preview
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
];

function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access",
    "Vary": "Origin",
  };
}

// ── Cache edge partagé (Cache API Cloudflare) ──
// TTL par source : les états financiers changent rarement, les prix souvent.
function cacheTtlFor(targetUrl) {
  const h = targetUrl.hostname;
  const p = targetUrl.pathname;
  if (h.endsWith("sec.gov")) return 86400;                       // 24 h
  if (h === "financialmodelingprep.com") return 21600;           // 6 h (économise le quota 250/j)
  if (h === "www.macrotrends.net") return 604800;                // 7 j
  if (h.endsWith("yahoo.com")) {
    if (p.includes("fundamentals-timeseries")) return 21600;     // 6 h
    if (p.includes("quoteSummary")) return 600;                  // 10 min
    return 120;                                                  // chart/quote/search : 2 min
  }
  return 0;
}

// Clé de cache : URL cible sans les paramètres volatils (crumb, apikey)
function buildCacheKey(targetUrl) {
  const ku = new URL(targetUrl.toString());
  ku.searchParams.delete("crumb");
  ku.searchParams.delete("apikey");
  return new Request(`https://edge-cache.internal/${encodeURIComponent(ku.toString())}`, { method: "GET" });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...getCorsHeaders(request), "Access-Control-Max-Age": "86400" } });
    }

    // HEAD request for health check — pas de log 400 dans la console
    if (request.method === "HEAD") {
      return new Response(null, { status: 200, headers: getCorsHeaders(request) });
    }

    const url = new URL(request.url);

    // Endpoint /health explicite
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", crumbCached: !!cachedCrumb, uptime: Date.now() }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      });
    }

    const target = url.searchParams.get("url");

    if (!target) {
      return new Response(JSON.stringify({ error: "Paramètre ?url= manquant" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      });
    }

    let targetUrl;
    try { targetUrl = new URL(target); } catch {
      return new Response(JSON.stringify({ error: "URL invalide" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      });
    }

    if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
      return new Response(JSON.stringify({ error: "Hôte non autorisé" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      });
    }

    // ── Cache edge : vérifié AVANT le rate limit (les hits ne consomment pas de quota) ──
    const ttl = request.method === "GET" && targetUrl.hostname !== "api.anthropic.com"
      ? cacheTtlFor(targetUrl) : 0;
    const cacheKey = ttl > 0 ? buildCacheKey(targetUrl) : null;
    if (cacheKey) {
      try {
        const hit = await caches.default.match(cacheKey);
        if (hit) {
          const body = await hit.text();
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": hit.headers.get("Content-Type") || "application/json",
              ...getCorsHeaders(request),
              "X-Cache": "HIT",
            },
          });
        }
      } catch (_) { /* Cache API indisponible — on continue sans cache */ }
    }

    // Rate limiting par IP
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!checkRateLimit(clientIP)) {
      return new Response(JSON.stringify({ error: "Rate limit dépassé. Réessayez dans 1 minute." }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request), "Retry-After": "60" },
      });
    }

    // Construit la réponse finale + stocke en cache edge si succès
    const finish = (body, status, contentType = "application/json") => {
      // Ne pas cacher : erreurs HTTP, ou réponses FMP 200 contenant un message d'erreur (quota)
      const cacheable = cacheKey && status === 200 &&
        !(targetUrl.hostname === "financialmodelingprep.com" && body.includes("Error Message"));
      if (cacheable) {
        const toStore = new Response(body, {
          status: 200,
          headers: { "Content-Type": contentType, "Cache-Control": `public, max-age=${ttl}` },
        });
        const putPromise = caches.default.put(cacheKey, toStore).catch(() => {});
        if (ctx?.waitUntil) ctx.waitUntil(putPromise);
      }
      return new Response(body, {
        status,
        headers: { "Content-Type": contentType, ...getCorsHeaders(request), "X-Cache": cacheKey ? "MISS" : "BYPASS" },
      });
    };

    try {
      const isYahoo = targetUrl.hostname.endsWith("yahoo.com");
      const isSec = targetUrl.hostname.endsWith("sec.gov");

      if (isYahoo) {
        // ── Yahoo Finance : crumb + cookie ──
        const { crumb, cookie } = await getCrumb();

        if (!targetUrl.searchParams.has("crumb")) {
          targetUrl.searchParams.set("crumb", crumb);
        }

        const resp = await fetch(targetUrl.toString(), {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Cookie": cookie,
          },
        });

        // Si crumb invalide, réessayer avec un nouveau crumb
        if (resp.status === 401) {
          cachedCrumb = null;
          crumbExpiry = 0;
          const fresh = await getCrumb();
          targetUrl.searchParams.set("crumb", fresh.crumb);
          const retry = await fetch(targetUrl.toString(), {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "application/json",
              "Cookie": fresh.cookie,
            },
          });
          const body = await retry.text();
          return finish(body, retry.status);
        }

        const body = await resp.text();
        return finish(body, resp.status);
      }

      if (isSec) {
        // ── SEC EDGAR : User-Agent obligatoire ──
        const resp = await fetch(targetUrl.toString(), {
          headers: {
            "User-Agent": "FoucauldFinance admin@foucauld.finance",
            "Accept": "application/json",
          },
        });
        const body = await resp.text();
        return finish(body, resp.status);
      }

      // ── FMP (Financial Modeling Prep) : injection clé API côté serveur ──
      if (targetUrl.hostname === "financialmodelingprep.com") {
        const fmpKey = env?.FMP_API_KEY;
        if (!fmpKey) {
          return new Response(JSON.stringify({ error: "FMP API key not configured on server" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
          });
        }
        // Inject API key server-side (never exposed to client)
        targetUrl.searchParams.set("apikey", fmpKey);
        const resp = await fetch(targetUrl.toString(), {
          headers: { "Accept": "application/json" },
        });
        const body = await resp.text();
        return finish(body, resp.status);
      }

      // ── Anthropic API : proxy POST avec headers ──
      if (targetUrl.hostname === "api.anthropic.com") {
        const reqHeaders = {
          "Content-Type": "application/json",
          "anthropic-version": request.headers.get("anthropic-version") || "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        };
        const apiKey = request.headers.get("x-api-key");
        if (apiKey) reqHeaders["x-api-key"] = apiKey;

        const fetchOpts = { method: request.method, headers: reqHeaders };
        if (request.method === "POST") {
          fetchOpts.body = await request.text();
        }

        const resp = await fetch(targetUrl.toString(), fetchOpts);
        const body = await resp.text();
        return new Response(body, {
          status: resp.status,
          headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
        });
      }

      // ── Macrotrends : proxy HTML avec headers navigateur ──
      if (targetUrl.hostname === "www.macrotrends.net") {
        const resp = await fetch(targetUrl.toString(), {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
        });
        const body = await resp.text();
        const ct = resp.headers.get("Content-Type") || "text/html";
        return finish(body, resp.status, ct);
      }

      // ── Autre hôte autorisé : proxy simple ──
      const resp = await fetch(targetUrl.toString(), {
        headers: { "Accept": "application/json" },
      });
      const body = await resp.text();
      return finish(body, resp.status);
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      });
    }
  },
};

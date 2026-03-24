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

export default {
  async fetch(request, env) {
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

    // Rate limiting par IP
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!checkRateLimit(clientIP)) {
      return new Response(JSON.stringify({ error: "Rate limit dépassé. Réessayez dans 1 minute." }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request), "Retry-After": "60" },
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
          return new Response(body, {
            status: retry.status,
            headers: { "Content-Type": "application/json", ...getCorsHeaders(request), "Cache-Control": "public, max-age=60" },
          });
        }

        const body = await resp.text();
        return new Response(body, {
          status: resp.status,
          headers: { "Content-Type": "application/json", ...getCorsHeaders(request), "Cache-Control": "public, max-age=60" },
        });
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
        return new Response(body, {
          status: resp.status,
          headers: { "Content-Type": "application/json", ...getCorsHeaders(request), "Cache-Control": "public, max-age=300" },
        });
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
        return new Response(body, {
          status: resp.status,
          headers: { "Content-Type": "application/json", ...getCorsHeaders(request), "Cache-Control": "public, max-age=300" },
        });
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

      // ── Autre hôte autorisé : proxy simple ──
      const resp = await fetch(targetUrl.toString(), {
        headers: { "Accept": "application/json" },
      });
      const body = await resp.text();
      return new Response(body, {
        status: resp.status,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request), "Cache-Control": "public, max-age=60" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      });
    }
  },
};

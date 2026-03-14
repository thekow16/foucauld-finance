/**
 * Cloudflare Worker — Proxy CORS pour Yahoo Finance avec gestion du crumb
 *
 * Redéploiement :
 *   cd worker
 *   wrangler deploy cors-proxy.js --name foucauld-proxy --compatibility-date 2024-01-01 --no-bundle
 */

const ALLOWED_HOSTS = [
  "query1.finance.yahoo.com",
  "query2.finance.yahoo.com",
  "data.sec.gov",
  "www.sec.gov",
  "efts.sec.gov",
];

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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...CORS_HEADERS, "Access-Control-Max-Age": "86400" } });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get("url");

    if (!target) {
      return new Response(JSON.stringify({ error: "Paramètre ?url= manquant" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    let targetUrl;
    try { targetUrl = new URL(target); } catch {
      return new Response(JSON.stringify({ error: "URL invalide" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
      return new Response(JSON.stringify({ error: "Hôte non autorisé" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
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
            headers: { "Content-Type": "application/json", ...CORS_HEADERS, "Cache-Control": "public, max-age=60" },
          });
        }

        const body = await resp.text();
        return new Response(body, {
          status: resp.status,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS, "Cache-Control": "public, max-age=60" },
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
          headers: { "Content-Type": "application/json", ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
        });
      }

      // ── Autre hôte autorisé : proxy simple ──
      const resp = await fetch(targetUrl.toString(), {
        headers: { "Accept": "application/json" },
      });
      const body = await resp.text();
      return new Response(body, {
        status: resp.status,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS, "Cache-Control": "public, max-age=60" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
  },
};

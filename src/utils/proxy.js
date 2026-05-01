import { warn } from "./log";
import { rateLimited } from "./rateLimiter";

export const WORKER_URL = "https://foucauld-proxy.foucauld-finance.workers.dev";

export const FREE_PROXIES = [
  url => ({ url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` }),
  url => ({ url: `https://corsproxy.io/?url=${encodeURIComponent(url)}` }),
  url => ({ url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` }),
  url => ({ url: `https://thingproxy.freeboard.io/fetch/${url}` }),
  url => ({ url: `https://everyorigin.jwvbremen.nl/api/get?url=${encodeURIComponent(url)}`, unwrap: true }),
];

export const YF = "https://query2.finance.yahoo.com";

export async function checkWorkerHealth() {
  if (!WORKER_URL) return false;
  try {
    const res = await fetch(`${WORKER_URL}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function tryFetch(url, unwrap = false) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { "Accept": "application/json" },
  });
  if (res.status === 429) throw new Error("Rate limit serveur dépassé. Patientez 1 minute.");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  let data = JSON.parse(text);
  if (unwrap && typeof data.contents === "string") {
    data = JSON.parse(data.contents);
  }
  return data;
}

export async function proxyFetch(targetUrl) {
  return rateLimited(async () => {
    if (WORKER_URL) {
      try {
        const data = await tryFetch(`${WORKER_URL}?url=${encodeURIComponent(targetUrl)}`);
        return data;
      } catch (e) {
        warn("[FF] Worker échoué:", e.message);
      }
    }

    for (let i = 0; i < FREE_PROXIES.length; i++) {
      const { url, unwrap } = FREE_PROXIES[i](targetUrl);
      const label = new URL(url).hostname;
      try {
        const data = await tryFetch(url, unwrap);
        return data;
      } catch (e) {
        warn(`[FF] ${label} → ${e.message}`);
      }
    }

    throw new Error("Impossible de contacter Yahoo Finance.");
  });
}

export async function yfFetch(path) {
  for (const host of [YF, YF.replace("query2", "query1")]) {
    try {
      return await proxyFetch(`${host}${path}`);
    } catch (_) {}
  }
  throw new Error("Impossible de contacter Yahoo Finance.");
}

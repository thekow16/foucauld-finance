// ──────────────────────────────────────────────
// Cloudflare Worker URL — À REMPLIR après déploiement
// Exemple : "https://foucauld-proxy.moncompte.workers.dev"
// ──────────────────────────────────────────────
const WORKER_URL = "https://foucauld-proxy.foucauld-finance.workers.dev";

// Proxies CORS gratuits en fallback
const FREE_PROXIES = [
  url => ({ url: `https://proxy.corsfix.com/?${url}` }),
  url => ({ url: `https://corsproxy.org/?${url}` }),
  url => ({ url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` }),
  url => ({ url: `https://corsproxy.io/?url=${encodeURIComponent(url)}` }),
  url => ({ url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` }),
  url => ({ url: `https://thingproxy.freeboard.io/fetch/${url}` }),
  url => ({ url: `https://everyorigin.jwvbremen.nl/api/get?url=${encodeURIComponent(url)}`, unwrap: true }),
];

const YF_HOSTS = [
  "https://query2.finance.yahoo.com",
  "https://query1.finance.yahoo.com",
];

async function tryFetch(url, unwrap = false) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  let data = JSON.parse(text);
  if (unwrap && typeof data.contents === "string") {
    data = JSON.parse(data.contents);
  }
  return data;
}

export async function proxyFetch(targetUrl) {
  console.log("[FF] proxyFetch:", targetUrl);

  // 1) Essayer le Cloudflare Worker en priorité
  if (WORKER_URL) {
    try {
      console.log("[FF] Essai via Worker…");
      const data = await tryFetch(`${WORKER_URL}?url=${encodeURIComponent(targetUrl)}`);
      console.log("[FF] Succès via Worker");
      return data;
    } catch (e) {
      console.warn("[FF] Worker échoué:", e.message);
    }
  }

  // 2) Fallback sur les proxies gratuits
  const errors = [];
  for (let i = 0; i < FREE_PROXIES.length; i++) {
    const { url, unwrap } = FREE_PROXIES[i](targetUrl);
    const label = new URL(url).hostname;
    console.log(`[FF] Essai ${i + 1}/${FREE_PROXIES.length}: ${label}`);
    try {
      const data = await tryFetch(url, unwrap);
      console.log(`[FF] Succès via ${label}`);
      return data;
    } catch (e) {
      const msg = `${label} → ${e.message}`;
      console.warn("[FF]", msg);
      errors.push(msg);
    }
  }

  console.error("[FF] TOUS LES PROXIES ONT ÉCHOUÉ:", errors);
  throw new Error("Impossible de contacter Yahoo Finance. Réessayez dans quelques secondes.");
}

async function yfFetch(path) {
  console.log("[FF] yfFetch:", path);
  for (const host of YF_HOSTS) {
    try {
      return await proxyFetch(`${host}${path}`);
    } catch (e) {
      console.warn("[FF] Échec pour", host, e.message);
    }
  }
  throw new Error("Impossible de contacter Yahoo Finance. Réessayez dans quelques secondes.");
}

export async function fetchChartData(sym, interval, range) {
  const json = await yfFetch(`/v8/finance/chart/${sym}?interval=${interval}&range=${range}`);
  const result = json.chart?.result?.[0];
  if (!result) return [];
  const ts = result.timestamp || [];
  const cl = result.indicators.quote[0].close || [];
  return ts
    .map((t, i) => ({
      date: new Date(t * 1000).toLocaleDateString("fr-FR", { month: "short", day: "numeric" }),
      price: cl[i] ? +cl[i].toFixed(2) : null,
    }))
    .filter(d => d.price !== null);
}

export async function fetchStockData(sym) {
  console.log("[FF] fetchStockData:", sym);
  const modules = "price,financialData,defaultKeyStatistics,balanceSheetHistory,incomeStatementHistory,cashflowStatementHistory,summaryDetail,assetProfile";
  const json = await yfFetch(`/v10/finance/quoteSummary/${sym}?modules=${modules}`);
  console.log("[FF] quoteSummary response:", JSON.stringify(json).slice(0, 500));
  if (json.quoteSummary?.error) throw new Error("Symbole introuvable — essayez : AAPL, MC.PA, TSLA…");
  const result = json.quoteSummary?.result?.[0];
  if (!result) throw new Error("Aucune donnée reçue pour ce symbole.");
  return result;
}

export async function fetchCandleData(sym, interval, range) {
  const json = await yfFetch(`/v8/finance/chart/${sym}?interval=${interval}&range=${range}`);
  const result = json.chart?.result?.[0];
  if (!result) return [];
  const ts = result.timestamp || [];
  const q = result.indicators.quote[0];
  const op = q.open || [], hi = q.high || [], lo = q.low || [], cl = q.close || [];
  return ts
    .map((t, i) => {
      if (op[i] == null || hi[i] == null || lo[i] == null || cl[i] == null) return null;
      return {
        time: new Date(t * 1000).toISOString().slice(0, 10),
        open: +op[i].toFixed(2),
        high: +hi[i].toFixed(2),
        low: +lo[i].toFixed(2),
        close: +cl[i].toFixed(2),
      };
    })
    .filter(Boolean);
}

export async function searchSymbols(query) {
  console.log("[FF] searchSymbols:", query);
  try {
    const json = await yfFetch(`/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0`);
    return (json.quotes || []).filter(q => q.quoteType === "EQUITY").slice(0, 6);
  } catch (_) {
    return [];
  }
}

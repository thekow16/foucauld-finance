const PROXIES = [
  // corsfix: URL non encodée
  url => ({ url: `https://proxy.corsfix.com/?${url}` }),
  // corsproxy.org: URL non encodée
  url => ({ url: `https://corsproxy.org/?${url}` }),
  // allorigins: URL encodée, retourne le JSON directement en mode /raw
  url => ({ url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` }),
  // corsproxy.io: URL encodée
  url => ({ url: `https://corsproxy.io/?url=${encodeURIComponent(url)}` }),
  // codetabs: URL encodée
  url => ({ url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` }),
  // thingproxy: URL directe dans le path
  url => ({ url: `https://thingproxy.freeboard.io/fetch/${url}` }),
  // everyorigin: retourne { contents: "..." } — nécessite unwrap
  url => ({ url: `https://everyorigin.jwvbremen.nl/api/get?url=${encodeURIComponent(url)}`, unwrap: true }),
];

const YF_HOSTS = [
  "https://query2.finance.yahoo.com",
  "https://query1.finance.yahoo.com",
];

export async function proxyFetch(targetUrl) {
  const errors = [];
  for (const make of PROXIES) {
    const { url, unwrap } = make(targetUrl);
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { "Accept": "application/json" },
      });
      if (!res.ok) {
        errors.push(`${url.slice(0, 40)}… → ${res.status}`);
        continue;
      }
      let data;
      const text = await res.text();
      try { data = JSON.parse(text); } catch (_) {
        errors.push(`${url.slice(0, 40)}… → pas du JSON`);
        continue;
      }
      // everyorigin wraps response in { contents: "..." }
      if (unwrap && typeof data.contents === "string") {
        try { data = JSON.parse(data.contents); } catch (_) {
          errors.push(`${url.slice(0, 40)}… → unwrap échoué`);
          continue;
        }
      }
      return data;
    } catch (e) {
      errors.push(`${url.slice(0, 40)}… → ${e.name || "erreur"}`);
    }
  }
  console.warn("[Foucauld Finance] Tous les proxies ont échoué:", errors);
  throw new Error("Impossible de contacter Yahoo Finance. Réessayez dans quelques secondes.");
}

async function yfFetch(path) {
  for (const host of YF_HOSTS) {
    try {
      return await proxyFetch(`${host}${path}`);
    } catch (_) {}
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
  const modules = "price,financialData,defaultKeyStatistics,balanceSheetHistory,incomeStatementHistory,cashflowStatementHistory,summaryDetail,assetProfile";
  const json = await yfFetch(`/v10/finance/quoteSummary/${sym}?modules=${modules}`);
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
  try {
    const json = await yfFetch(`/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0`);
    return (json.quotes || []).filter(q => q.quoteType === "EQUITY").slice(0, 6);
  } catch (_) {
    return [];
  }
}

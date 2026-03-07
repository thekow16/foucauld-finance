const PROXIES = [
  url => `https://proxy.corsfix.com/?${encodeURIComponent(url)}`,
  url => `https://api.cors.lol/?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.org/?${encodeURIComponent(url)}`,
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  url => `https://everyorigin.jwvbremen.nl/api/get?url=${encodeURIComponent(url)}`,
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  url => `https://thingproxy.freeboard.io/fetch/${url}`,
];

const YF_HOSTS = [
  "https://query1.finance.yahoo.com",
  "https://query2.finance.yahoo.com",
];

export async function proxyFetch(targetUrl) {
  for (const make of PROXIES) {
    try {
      const res = await fetch(make(targetUrl), { signal: AbortSignal.timeout(9000) });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("json")) return await res.json();
      const text = await res.text();
      try { return JSON.parse(text); } catch (_) { continue; }
    } catch (_) {}
  }
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

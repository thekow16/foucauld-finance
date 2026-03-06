const PROXIES = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

export async function proxyFetch(targetUrl) {
  for (const make of PROXIES) {
    try {
      const res = await fetch(make(targetUrl), { signal: AbortSignal.timeout(9000) });
      if (!res.ok) continue;
      return await res.json();
    } catch (_) {}
  }
  throw new Error("Impossible de contacter Yahoo Finance. Réessayez dans quelques secondes.");
}

const YF = "https://query1.finance.yahoo.com";

export async function fetchChartData(sym, interval, range) {
  const url = `${YF}/v8/finance/chart/${sym}?interval=${interval}&range=${range}`;
  const json = await proxyFetch(url);
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
  const url = `${YF}/v10/finance/quoteSummary/${sym}?modules=${modules}`;
  const json = await proxyFetch(url);
  if (json.quoteSummary?.error) throw new Error("Symbole introuvable — essayez : AAPL, MC.PA, TSLA…");
  const result = json.quoteSummary?.result?.[0];
  if (!result) throw new Error("Aucune donnée reçue pour ce symbole.");
  return result;
}

export async function searchSymbols(query) {
  const url = `${YF}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0`;
  try {
    const json = await proxyFetch(url);
    return (json.quotes || []).filter(q => q.quoteType === "EQUITY").slice(0, 6);
  } catch (_) {
    return [];
  }
}

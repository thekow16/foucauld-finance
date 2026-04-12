// ──────────────────────────────────────────────
// Market-wide API functions for the landing page
// Uses FMP endpoints proxied through Cloudflare Worker
// ──────────────────────────────────────────────

const FMP_BASE = "https://financialmodelingprep.com/api/v3";
const WORKER_URL = "https://foucauld-proxy.foucauld-finance.workers.dev";

// ── Cache helper (sessionStorage, TTL-based) ──
function cached(key, ttlMs, fetcher) {
  return async () => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < ttlMs) return data;
      }
    } catch { /* ignore */ }
    const data = await fetcher();
    try { sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch { /* quota */ }
    return data;
  };
}

async function fmpMarketFetch(endpoint) {
  const url = `${FMP_BASE}${endpoint}`;
  const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data && !Array.isArray(data) && data["Error Message"]) {
    throw new Error(data["Error Message"]);
  }
  return data;
}

// ── Top Gainers ──
export const fetchGainers = cached("av-gainers", 5 * 60 * 1000, async () => {
  const data = await fmpMarketFetch("/stock_market/gainers");
  return Array.isArray(data) ? data.slice(0, 10) : [];
});

// ── Top Losers ──
export const fetchLosers = cached("av-losers", 5 * 60 * 1000, async () => {
  const data = await fmpMarketFetch("/stock_market/losers");
  return Array.isArray(data) ? data.slice(0, 10) : [];
});

// ── Sector Performance ──
export const fetchSectorPerformance = cached("av-sectors", 10 * 60 * 1000, async () => {
  const data = await fmpMarketFetch("/sector-performance");
  return Array.isArray(data) ? data : [];
});

// ── Upcoming Earnings (next 7 days) ──
export const fetchUpcomingEarnings = cached("av-earnings", 15 * 60 * 1000, async () => {
  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const to = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const data = await fmpMarketFetch(`/earning_calendar?from=${from}&to=${to}`);
  if (!Array.isArray(data)) return [];
  // Filter to known large-caps and sort by date
  return data
    .filter(e => e.symbol && e.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 20);
});

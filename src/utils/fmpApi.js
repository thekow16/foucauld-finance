// ──────────────────────────────────────────────
// Financial Modeling Prep API — proxied through Cloudflare Worker
// La clé API est injectée côté serveur (jamais exposée au client)
// ──────────────────────────────────────────────

const FMP_BASE = "https://financialmodelingprep.com/api/v3";
const FMP_V4 = "https://financialmodelingprep.com/api/v4";
const WORKER_URL = "https://foucauld-proxy.foucauld-finance.workers.dev";

// ── Legacy: support clé locale (migration) ──
const STORAGE_KEY = "fmp_api_key";

export function getFmpApiKey() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function setFmpApiKey(key) {
  localStorage.setItem(STORAGE_KEY, key || "");
}

// FMP est toujours disponible via le Worker (clé serveur)
export function hasFmpApiKey() {
  return true;
}

// ── Compteur journalier FMP (protection 250 req/jour partagées) ──
const FMP_COUNTER_KEY = "fmp_daily_count";
const FMP_DAILY_LIMIT = 230; // marge de sécurité (limite réelle 250)

function getFmpDailyCount() {
  try {
    const raw = localStorage.getItem(FMP_COUNTER_KEY);
    if (!raw) return { count: 0, date: "" };
    return JSON.parse(raw);
  } catch { return { count: 0, date: "" }; }
}

function incrementFmpCount() {
  const today = new Date().toISOString().slice(0, 10);
  const stored = getFmpDailyCount();
  const count = stored.date === today ? stored.count + 1 : 1;
  localStorage.setItem(FMP_COUNTER_KEY, JSON.stringify({ count, date: today }));
  return count;
}

export function getFmpUsage() {
  const today = new Date().toISOString().slice(0, 10);
  const stored = getFmpDailyCount();
  return stored.date === today ? stored.count : 0;
}

async function fmpFetch(endpoint, base = FMP_BASE) {
  // Vérif quota journalier (client-side, approximatif)
  const today = new Date().toISOString().slice(0, 10);
  const stored = getFmpDailyCount();
  if (stored.date === today && stored.count >= FMP_DAILY_LIMIT) {
    console.warn(`[FMP] Limite journalière atteinte (${stored.count}/${FMP_DAILY_LIMIT})`);
    throw new Error("Limite FMP atteinte pour aujourd'hui (250 req/jour). Les données Yahoo Finance restent disponibles.");
  }
  incrementFmpCount();

  // Build FMP URL without API key (Worker injects it server-side)
  const fmpUrl = `${base}${endpoint}`;
  const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(fmpUrl)}`;

  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error("Clé API FMP invalide côté serveur");
    if (res.status === 500) throw new Error("FMP API key not configured on server");
    throw new Error(`FMP HTTP ${res.status}`);
  }
  const data = await res.json();
  // FMP returns {"Error Message": "..."} on expired/rate-limited keys with 200 OK
  if (data && !Array.isArray(data) && data["Error Message"]) {
    console.warn("[FMP] API error:", data["Error Message"]);
    throw new Error(`FMP: ${data["Error Message"]}`);
  }
  return data;
}

// ── Compte de résultat (Income Statement) ──
export async function fetchIncomeStatement(symbol, limit = 40) {
  return fmpFetch(`/income-statement/${symbol}?period=annual&limit=${limit}`);
}

// ── Bilan (Balance Sheet) ──
export async function fetchBalanceSheet(symbol, limit = 40) {
  return fmpFetch(`/balance-sheet-statement/${symbol}?period=annual&limit=${limit}`);
}

// ── Flux de trésorerie (Cash Flow) ──
export async function fetchCashFlow(symbol, limit = 40) {
  return fmpFetch(`/cash-flow-statement/${symbol}?period=annual&limit=${limit}`);
}

// ── Ratios financiers ──
export async function fetchRatios(symbol, limit = 40) {
  return fmpFetch(`/ratios/${symbol}?period=annual&limit=${limit}`);
}

// ── Métriques clés ──
export async function fetchKeyMetrics(symbol, limit = 40) {
  return fmpFetch(`/key-metrics/${symbol}?period=annual&limit=${limit}`);
}

// ── Profil de l'entreprise ──
export async function fetchProfile(symbol) {
  return fmpFetch(`/profile/${symbol}`);
}

// ── Résultats trimestriels (Earnings) ──
export async function fetchEarningsHistory(symbol) {
  return fmpFetch(`/historical/earning_calendar/${symbol}?limit=20`);
}

// ── Données trimestrielles (Income, Balance, Cashflow) ──
export async function fetchQuarterlyIncome(symbol, limit = 40) {
  return fmpFetch(`/income-statement/${symbol}?period=quarter&limit=${limit}`);
}
export async function fetchQuarterlyBalance(symbol, limit = 40) {
  return fmpFetch(`/balance-sheet-statement/${symbol}?period=quarter&limit=${limit}`);
}
export async function fetchQuarterlyCashflow(symbol, limit = 40) {
  return fmpFetch(`/cash-flow-statement/${symbol}?period=quarter&limit=${limit}`);
}

export async function fetchAllQuarterlyFinancials(symbol) {
  const [income, balance, cashflow] = await Promise.all([
    fetchQuarterlyIncome(symbol).catch(() => []),
    fetchQuarterlyBalance(symbol).catch(() => []),
    fetchQuarterlyCashflow(symbol).catch(() => []),
  ]);
  return { income, balance, cashflow };
}

// ── Communiqués de presse ──
export async function fetchPressReleases(symbol, limit = 40) {
  return fmpFetch(`/press-releases/${symbol}?page=0&limit=${limit}`);
}

// ── SEC Filings (10-K, 10-Q, 8-K) ──
export async function fetchSecFilings(symbol, limit = 40) {
  return fmpFetch(`/sec_filings/${symbol}?type=&page=0&limit=${limit}`);
}

// ── Segmentation du CA par produit ──
export async function fetchRevenueProductSegmentation(symbol) {
  return fmpFetch(`/revenue-product-segmentation?symbol=${symbol}&structure=flat&period=annual`, FMP_V4);
}

// ── Segmentation du CA par zone géographique ──
export async function fetchRevenueGeoSegmentation(symbol) {
  return fmpFetch(`/revenue-geographic-segmentation?symbol=${symbol}&structure=flat&period=annual`, FMP_V4);
}

// ── Fetch toutes les données financières d'un coup ──
export async function fetchAllFinancials(symbol) {
  const limit = 40;
  const [income, balance, cashflow, ratios, keyMetrics, productSegments, geoSegments] = await Promise.all([
    fetchIncomeStatement(symbol, limit).catch(e => { console.warn("[FMP] income err:", e.message); return []; }),
    fetchBalanceSheet(symbol, limit).catch(e => { console.warn("[FMP] balance err:", e.message); return []; }),
    fetchCashFlow(symbol, limit).catch(e => { console.warn("[FMP] cashflow err:", e.message); return []; }),
    fetchRatios(symbol, limit).catch(e => { console.warn("[FMP] ratios err:", e.message); return []; }),
    fetchKeyMetrics(symbol, limit).catch(e => { console.warn("[FMP] keyMetrics err:", e.message); return []; }),
    fetchRevenueProductSegmentation(symbol).catch(e => { console.warn("[FMP] productSeg err:", e.message); return []; }),
    fetchRevenueGeoSegmentation(symbol).catch(e => { console.warn("[FMP] geoSeg err:", e.message); return []; }),
  ]);
  return { income, balance, cashflow, ratios, keyMetrics, productSegments, geoSegments };
}

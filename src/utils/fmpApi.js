// ──────────────────────────────────────────────
// Financial Modeling Prep API
// Clé gratuite : 250 requêtes/jour sur financialmodelingprep.com
// ──────────────────────────────────────────────

const FMP_BASE = "https://financialmodelingprep.com/api/v3";

// Clé par défaut intégrée — peut être remplacée via localStorage
const DEFAULT_KEY = "HeV5JAyBATbX07V8hRmxeYjSWIxaZgWl";
const STORAGE_KEY = "fmp_api_key";

export function getFmpApiKey() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_KEY;
}

export function setFmpApiKey(key) {
  localStorage.setItem(STORAGE_KEY, key);
}

export function hasFmpApiKey() {
  return !!getFmpApiKey();
}

async function fmpFetch(endpoint) {
  const key = getFmpApiKey();
  if (!key) throw new Error("Clé API FMP manquante");
  const url = `${FMP_BASE}${endpoint}${endpoint.includes("?") ? "&" : "?"}apikey=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error("Clé API FMP invalide");
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
export async function fetchIncomeStatement(symbol, limit = 20) {
  return fmpFetch(`/income-statement/${symbol}?period=annual&limit=${limit}`);
}

// ── Bilan (Balance Sheet) ──
export async function fetchBalanceSheet(symbol, limit = 20) {
  return fmpFetch(`/balance-sheet-statement/${symbol}?period=annual&limit=${limit}`);
}

// ── Flux de trésorerie (Cash Flow) ──
export async function fetchCashFlow(symbol, limit = 20) {
  return fmpFetch(`/cash-flow-statement/${symbol}?period=annual&limit=${limit}`);
}

// ── Ratios financiers ──
export async function fetchRatios(symbol, limit = 20) {
  return fmpFetch(`/ratios/${symbol}?period=annual&limit=${limit}`);
}

// ── Métriques clés ──
export async function fetchKeyMetrics(symbol, limit = 20) {
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

// ── Communiqués de presse ──
export async function fetchPressReleases(symbol, limit = 20) {
  return fmpFetch(`/press-releases/${symbol}?page=0&limit=${limit}`);
}

// ── SEC Filings (10-K, 10-Q, 8-K) ──
export async function fetchSecFilings(symbol, limit = 20) {
  return fmpFetch(`/sec_filings/${symbol}?type=&page=0&limit=${limit}`);
}

// ── Fetch toutes les données financières d'un coup ──
export async function fetchAllFinancials(symbol) {
  const [income, balance, cashflow, ratios, keyMetrics] = await Promise.all([
    fetchIncomeStatement(symbol, 20).catch(e => { console.warn("[FMP] income err:", e.message); return []; }),
    fetchBalanceSheet(symbol, 20).catch(e => { console.warn("[FMP] balance err:", e.message); return []; }),
    fetchCashFlow(symbol, 20).catch(e => { console.warn("[FMP] cashflow err:", e.message); return []; }),
    fetchRatios(symbol, 20).catch(e => { console.warn("[FMP] ratios err:", e.message); return []; }),
    fetchKeyMetrics(symbol, 20).catch(e => { console.warn("[FMP] keyMetrics err:", e.message); return []; }),
  ]);
  console.log("[FMP] fetchAllFinancials result:", symbol,
    "income:", income?.length || 0,
    "balance:", balance?.length || 0,
    "cashflow:", cashflow?.length || 0);
  return { income, balance, cashflow, ratios, keyMetrics };
}

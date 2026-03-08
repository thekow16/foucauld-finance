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
  return res.json();
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

// ── Fetch toutes les données financières d'un coup ──
export async function fetchAllFinancials(symbol) {
  const [income, balance, cashflow, ratios, keyMetrics] = await Promise.all([
    fetchIncomeStatement(symbol, 20).catch(() => []),
    fetchBalanceSheet(symbol, 20).catch(() => []),
    fetchCashFlow(symbol, 20).catch(() => []),
    fetchRatios(symbol, 20).catch(() => []),
    fetchKeyMetrics(symbol, 20).catch(() => []),
  ]);
  return { income, balance, cashflow, ratios, keyMetrics };
}

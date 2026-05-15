import { warn } from "./log";
import { WORKER_URL, FREE_PROXIES, tryFetch } from "./proxy";

// SEC EDGAR — 10-20+ ans de données financières US gratuites
// Utilise companyfacts (toutes les données XBRL en un appel)
// Tente le Worker proxy puis les free CORS proxies en fallback

let tickerMap = null;

async function secFetch(url) {
  const SEC_TIMEOUT = 25000;
  // 1. Worker proxy
  if (WORKER_URL) {
    try {
      return await tryFetch(`${WORKER_URL}?url=${encodeURIComponent(url)}`, false, SEC_TIMEOUT);
    } catch (e) {
      warn("[SEC] Worker proxy échoué:", e.message);
    }
  }
  // 2. Free CORS proxies (même logique que pour Yahoo)
  for (let i = 0; i < FREE_PROXIES.length; i++) {
    const { url: proxyUrl, unwrap } = FREE_PROXIES[i](url);
    try {
      return await tryFetch(proxyUrl, unwrap, SEC_TIMEOUT);
    } catch (e) {
      warn(`[SEC] proxy ${i} échoué:`, e.message);
    }
  }
  throw new Error("SEC EDGAR inaccessible via tous les proxies");
}

async function loadTickerMap() {
  if (tickerMap) return tickerMap;
  const data = await secFetch("https://www.sec.gov/files/company_tickers.json");
  tickerMap = {};
  for (const entry of Object.values(data)) {
    tickerMap[entry.ticker.toUpperCase()] = String(entry.cik_str).padStart(10, "0");
  }
  warn(`[SEC] Ticker map chargé: ${Object.keys(tickerMap).length} symboles`);
  return tickerMap;
}

async function getCik(ticker) {
  const clean = ticker.replace(/\..+$/, "").toUpperCase();
  const map = await loadTickerMap();
  return map[clean] || null;
}

function extractAnnual(concept, unit = "USD") {
  if (!concept?.units) return new Map();
  let entries = concept.units[unit];
  if (!entries || entries.length === 0) {
    for (const key of Object.keys(concept.units)) {
      if (key !== "shares" || unit === "shares") {
        entries = concept.units[key];
        if (entries?.length > 0) break;
      }
    }
  }
  if (!entries) return new Map();
  const byFy = new Map();
  for (const e of entries) {
    if (e.form !== "10-K" && e.form !== "10-K/A" && e.form !== "10-KT" && e.form !== "10-KSB") continue;
    if (e.fp !== "FY") continue;
    const fy = String(e.fy);
    const existing = byFy.get(fy);
    if (!existing || e.filed > existing.filed) {
      byFy.set(fy, e);
    }
  }
  return byFy;
}

function tryExtract(gaap, names, unit = "USD") {
  const merged = new Map();
  for (const name of names) {
    if (!gaap[name]) continue;
    const result = extractAnnual(gaap[name], unit);
    for (const [fy, entry] of result) {
      if (!merged.has(fy)) merged.set(fy, entry);
    }
  }
  return merged;
}

export async function fetchSecFinancials(ticker) {
  const cik = await getCik(ticker);
  if (!cik) {
    warn(`[SEC] ${ticker}: pas de CIK trouvé (non-US ?)`);
    return null;
  }

  warn(`[SEC] ${ticker}: CIK=${cik}, chargement companyfacts...`);
  const data = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
  const gaap = data?.facts?.["us-gaap"];
  if (!gaap) {
    warn(`[SEC] ${ticker}: pas de données us-gaap`);
    return null;
  }

  const revenue = tryExtract(gaap, ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet", "SalesRevenueGoodsNet", "SalesRevenueServicesNet"]);
  const opIncome = tryExtract(gaap, ["OperatingIncomeLoss", "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest"]);
  const shares = tryExtract(gaap, ["WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfShareOutstandingBasicAndDiluted", "CommonStockSharesOutstanding", "EntityCommonStockSharesOutstanding"], "shares");
  const ocf = tryExtract(gaap, ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"]);
  const capex = tryExtract(gaap, ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsForCapitalImprovements"]);
  const sbc = tryExtract(gaap, ["ShareBasedCompensation", "AllocatedShareBasedCompensationExpense"]);
  const divs = tryExtract(gaap, ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock", "PaymentsOfOrdinaryDividends"]);
  const cash = tryExtract(gaap, ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsAndShortTermInvestments", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"]);
  const debt = tryExtract(gaap, ["LongTermDebt", "LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations"]);
  const assets = tryExtract(gaap, ["Assets"]);
  const curLiab = tryExtract(gaap, ["LiabilitiesCurrent"]);

  const allYears = new Set();
  for (const m of [revenue, opIncome, ocf, assets]) {
    for (const fy of m.keys()) allYears.add(fy);
  }
  if (allYears.size === 0) return null;

  const sorted = [...allYears].sort().reverse();
  const v = (map, fy) => map.get(fy)?.val ?? null;

  const income = [];
  const cashflow = [];
  const balance = [];

  for (const fy of sorted) {
    const date = revenue.get(fy)?.end || opIncome.get(fy)?.end || ocf.get(fy)?.end || assets.get(fy)?.end;
    const ocfVal = v(ocf, fy);
    const capexVal = v(capex, fy);
    const fcf = ocfVal != null && capexVal != null ? ocfVal - Math.abs(capexVal) : null;
    const divVal = v(divs, fy);

    income.push({
      date,
      calendarYear: fy,
      revenue: v(revenue, fy),
      operatingIncome: v(opIncome, fy),
      weightedAverageShsOutDil: v(shares, fy),
      _source: "sec",
    });
    cashflow.push({
      date,
      calendarYear: fy,
      operatingCashFlow: ocfVal,
      capitalExpenditure: capexVal != null ? -Math.abs(capexVal) : null,
      freeCashFlow: fcf,
      stockBasedCompensation: v(sbc, fy),
      dividendsPaid: divVal != null ? -Math.abs(divVal) : null,
      _source: "sec",
    });
    balance.push({
      date,
      calendarYear: fy,
      totalAssets: v(assets, fy),
      cashAndCashEquivalents: v(cash, fy),
      totalDebt: v(debt, fy),
      totalCurrentLiabilities: v(curLiab, fy),
      _source: "sec",
    });
  }

  warn(`[SEC] ${ticker}: ${sorted.length} ans (${sorted[sorted.length - 1]}–${sorted[0]})`);
  return { income, balance, cashflow };
}

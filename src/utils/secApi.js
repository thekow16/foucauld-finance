import { warn } from "./log";
import { WORKER_URL } from "./proxy";

// SEC EDGAR — 10-20+ ans de données financières US gratuites
// Endpoint companyfacts : toutes les données XBRL d'un émetteur en un seul appel

let tickerMap = null;

async function secFetch(url) {
  const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`SEC HTTP ${res.status}`);
  return res.json();
}

async function loadTickerMap() {
  if (tickerMap) return tickerMap;
  const data = await secFetch("https://www.sec.gov/files/company_tickers.json");
  tickerMap = {};
  for (const entry of Object.values(data)) {
    tickerMap[entry.ticker.toUpperCase()] = String(entry.cik_str).padStart(10, "0");
  }
  return tickerMap;
}

async function getCik(ticker) {
  const clean = ticker.replace(/\..+$/, "").toUpperCase();
  const map = await loadTickerMap();
  return map[clean] || null;
}

// Extract annual 10-K values from a GAAP concept, deduplicated by fiscal year
function extractAnnual(concept, unit = "USD") {
  if (!concept?.units) return [];
  const entries = concept.units[unit] || concept.units.shares || [];
  const byFy = new Map();
  for (const e of entries) {
    if (e.form !== "10-K" && e.form !== "10-K/A") continue;
    if (e.fp !== "FY") continue;
    const fy = String(e.fy);
    const existing = byFy.get(fy);
    if (!existing || e.filed > existing.filed) {
      byFy.set(fy, e);
    }
  }
  return byFy;
}

// Try multiple GAAP concept names (companies use different terms)
function tryExtract(gaap, names, unit = "USD") {
  for (const name of names) {
    if (gaap[name]) {
      const result = extractAnnual(gaap[name], unit);
      if (result.size > 0) return result;
    }
  }
  return new Map();
}

export async function fetchSecFinancials(ticker) {
  const cik = await getCik(ticker);
  if (!cik) return null;

  const data = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
  const gaap = data?.facts?.["us-gaap"];
  if (!gaap) return null;

  const revenue = tryExtract(gaap, ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet", "SalesRevenueGoodsNet"]);
  const opIncome = tryExtract(gaap, ["OperatingIncomeLoss"]);
  const shares = tryExtract(gaap, ["WeightedAverageNumberOfDilutedSharesOutstanding", "CommonStockSharesOutstanding"], "shares");
  const ocf = tryExtract(gaap, ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"]);
  const capex = tryExtract(gaap, ["PaymentsToAcquirePropertyPlantAndEquipment"]);
  const sbc = tryExtract(gaap, ["AllocatedShareBasedCompensationExpense", "ShareBasedCompensation"]);
  const divs = tryExtract(gaap, ["PaymentsOfDividendsCommonStock", "PaymentsOfDividends", "PaymentsOfOrdinaryDividends"]);
  const cash = tryExtract(gaap, ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsAndShortTermInvestments"]);
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

  warn(`[SEC] ${ticker}: ${sorted.length} ans de données (${sorted[sorted.length - 1]}–${sorted[0]})`);
  return { income, balance, cashflow };
}

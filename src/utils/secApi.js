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
    if (e.form !== "10-K" && e.form !== "10-K/A" && e.form !== "10-KT" && e.form !== "10-KSB" && e.form !== "20-F" && e.form !== "20-F/A") continue;
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

// Parse a companyfacts payload (us-gaap ou ifrs-full) en états financiers.
// Séparé de fetchSecFinancials pour être testable sans réseau.
export function parseSecFacts(facts, { gaap, ifrs } = {}) {
  if (!facts) return null;

  const revenue = gaap
    ? tryExtract(gaap, ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet", "SalesRevenueGoodsNet", "SalesRevenueServicesNet"])
    : tryExtract(ifrs, ["Revenue", "RevenueFromContractsWithCustomers"]);
  const opIncome = gaap
    ? tryExtract(gaap, ["OperatingIncomeLoss", "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest"])
    : tryExtract(ifrs, ["ProfitLossFromOperatingActivities", "OperatingProfit"]);
  const shares = tryExtract(facts, ["WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfShareOutstandingBasicAndDiluted", "CommonStockSharesOutstanding", "EntityCommonStockSharesOutstanding", "WeightedAverageShares"], "shares");
  const ocf = gaap
    ? tryExtract(gaap, ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"])
    : tryExtract(ifrs, ["CashFlowsFromUsedInOperatingActivities"]);
  // Capex : couvre les variantes télécom/industrie (Verizon, AT&T → PaymentsToAcquireProductiveAssets)
  const capex = gaap
    ? tryExtract(gaap, [
        "PaymentsToAcquirePropertyPlantAndEquipment",
        "PaymentsToAcquireProductiveAssets",
        "PaymentsForProceedsFromProductiveAssets",
        "PaymentsToAcquireOtherPropertyPlantAndEquipment",
        "PaymentsToAcquireMachineryAndEquipment",
        "PaymentsForCapitalImprovements",
      ])
    : tryExtract(ifrs, ["PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"]);
  const sbc = tryExtract(facts, [
    "ShareBasedCompensation",
    "AllocatedShareBasedCompensationExpense",
    "ShareBasedCompensationArrangementByShareBasedPaymentAwardCompensationCost1",
    "EmployeeBenefitsAndShareBasedCompensation",
  ]);
  const divs = gaap
    ? tryExtract(gaap, ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock", "PaymentsOfOrdinaryDividends"])
    : tryExtract(ifrs, ["DividendsPaidClassifiedAsFinancingActivities", "DividendsPaid"]);
  const cash = gaap
    ? tryExtract(gaap, ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsAndShortTermInvestments", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"])
    : tryExtract(ifrs, ["CashAndCashEquivalents"]);
  // Dette : un total direct si disponible, sinon somme (non-courant + courant).
  // Couvre les tags post-ASC842 incluant les locations financières (Verizon ≥2022).
  const debtTotal = gaap
    ? tryExtract(gaap, [
        "LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities",
        "DebtLongtermAndShorttermCombinedAmount",
        "LongTermDebt",
        "LongTermDebtAndCapitalLeaseObligations",
      ])
    : tryExtract(ifrs, ["NoncurrentLiabilities", "LongtermBorrowings"]);
  const debtNoncurrent = gaap
    ? tryExtract(gaap, [
        "LongTermDebtNoncurrent",
        "LongTermDebtAndFinanceLeaseObligationsNoncurrent",
        "LongTermDebtAndCapitalLeaseObligations",
      ])
    : new Map();
  const debtCurrent = gaap
    ? tryExtract(gaap, [
        "LongTermDebtCurrent",
        "LongTermDebtAndCapitalLeaseObligationsCurrent",
        "DebtCurrent",
      ])
    : new Map();
  const assets = tryExtract(facts, ["Assets"]);
  const curLiab = gaap
    ? tryExtract(gaap, ["LiabilitiesCurrent"])
    : tryExtract(ifrs, ["CurrentLiabilities"]);

  const allYears = new Set();
  for (const m of [revenue, opIncome, shares, ocf, capex, sbc, divs, cash, debtTotal, debtNoncurrent, debtCurrent, assets, curLiab]) {
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

    // Dette : total direct, sinon non-courant (+ courant si présent)
    let debtVal = v(debtTotal, fy);
    if (debtVal == null) {
      const nc = v(debtNoncurrent, fy);
      const cu = v(debtCurrent, fy);
      if (nc != null || cu != null) debtVal = (nc ?? 0) + (cu ?? 0);
    }

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
      totalDebt: debtVal,
      totalCurrentLiabilities: v(curLiab, fy),
      _source: "sec",
    });
  }

  return { income, balance, cashflow, _years: sorted };
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
  const ifrs = data?.facts?.["ifrs-full"];
  const facts = gaap || ifrs;
  if (!facts) {
    warn(`[SEC] ${ticker}: pas de données us-gaap ni ifrs-full`);
    return null;
  }

  const parsed = parseSecFacts(facts, { gaap, ifrs });
  if (!parsed) return null;

  const sorted = parsed._years;
  warn(`[SEC] ${ticker}: ${sorted.length} ans (${sorted[sorted.length - 1]}–${sorted[0]})`);
  return { income: parsed.income, balance: parsed.balance, cashflow: parsed.cashflow };
}

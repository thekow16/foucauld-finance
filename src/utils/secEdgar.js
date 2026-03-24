// ──────────────────────────────────────────────
// SEC EDGAR XBRL API — 20+ ans de données US gratuites
// Source: https://data.sec.gov/api/xbrl/companyfacts/
// ──────────────────────────────────────────────

const WORKER_URL = "https://foucauld-proxy.foucauld-finance.workers.dev";

// ── CIK cache (ticker → CIK mapping) ──
const cikCache = new Map();

async function fetchJson(url) {
  const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`SEC HTTP ${res.status}`);
  return res.json();
}

// ── Look up CIK for a ticker ──
export async function lookupCik(ticker) {
  const t = ticker.toUpperCase().replace(/\..*$/, ""); // strip exchange suffix (.PA, etc.)
  if (cikCache.has(t)) return cikCache.get(t);

  // Use SEC company tickers endpoint
  const data = await fetchJson("https://www.sec.gov/files/company_tickers.json");
  // data is { "0": { "cik_str": 320193, "ticker": "AAPL", "title": "..." }, ... }
  for (const entry of Object.values(data)) {
    if (entry.ticker === t) {
      const cik = String(entry.cik_str).padStart(10, "0");
      cikCache.set(t, cik);
      return cik;
    }
  }
  return null;
}

// ── Fetch company facts from SEC EDGAR XBRL ──
export async function fetchCompanyFacts(cik) {
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
  return fetchJson(url);
}

// ── Extract annual 10-K values for a given XBRL concept ──
function getAnnualValues(facts, ...conceptNames) {
  const gaap = facts?.facts?.["us-gaap"] || {};
  for (const name of conceptNames) {
    const concept = gaap[name];
    if (!concept) continue;
    const usdEntries = concept.units?.USD || [];
    // Filter: only annual (10-K, fp=FY), deduplicate by fiscal year
    const annuals = usdEntries.filter(e => e.form === "10-K" && e.fp === "FY");
    if (annuals.length === 0) continue;
    // Deduplicate by fiscal year (keep the latest filing per year)
    const byYear = new Map();
    for (const e of annuals) {
      const year = e.fy;
      if (!byYear.has(year) || e.filed > byYear.get(year).filed) {
        byYear.set(year, e);
      }
    }
    return byYear;
  }
  return new Map();
}

// Same for share-based values (EPS etc.)
function getAnnualShareValues(facts, ...conceptNames) {
  const gaap = facts?.facts?.["us-gaap"] || {};
  for (const name of conceptNames) {
    const concept = gaap[name];
    if (!concept) continue;
    const entries = concept.units?.["USD/shares"] || [];
    const annuals = entries.filter(e => e.form === "10-K" && e.fp === "FY");
    if (annuals.length === 0) continue;
    const byYear = new Map();
    for (const e of annuals) {
      if (!byYear.has(e.fy) || e.filed > byYear.get(e.fy).filed) {
        byYear.set(e.fy, e);
      }
    }
    return byYear;
  }
  return new Map();
}

// Pure number values (shares outstanding)
function getAnnualPureValues(facts, ...conceptNames) {
  const gaap = facts?.facts?.["us-gaap"] || {};
  const dei = facts?.facts?.["dei"] || {};
  for (const name of conceptNames) {
    const concept = gaap[name] || dei[name];
    if (!concept) continue;
    const entries = concept.units?.shares || concept.units?.USD || [];
    const annuals = entries.filter(e => e.form === "10-K" && e.fp === "FY");
    if (annuals.length === 0) continue;
    const byYear = new Map();
    for (const e of annuals) {
      if (!byYear.has(e.fy) || e.filed > byYear.get(e.fy).filed) {
        byYear.set(e.fy, e);
      }
    }
    return byYear;
  }
  return new Map();
}

// ── Convert SEC EDGAR facts to FMP-format data ──
export function edgarToFmpData(facts) {
  if (!facts?.facts?.["us-gaap"]) return null;

  // Income Statement concepts
  const revenue = getAnnualValues(facts,
    "RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues",
    "SalesRevenueNet", "SalesRevenueGoodsNet", "RevenueFromContractWithCustomerIncludingAssessedTax");
  const costOfRevenue = getAnnualValues(facts, "CostOfGoodsAndServicesSold", "CostOfRevenue", "CostOfGoodsSold");
  const grossProfit = getAnnualValues(facts, "GrossProfit");
  const operatingIncome = getAnnualValues(facts, "OperatingIncomeLoss");
  const netIncome = getAnnualValues(facts, "NetIncomeLoss");
  const rd = getAnnualValues(facts, "ResearchAndDevelopmentExpense");
  const sga = getAnnualValues(facts, "SellingGeneralAndAdministrativeExpense");
  const opExpenses = getAnnualValues(facts, "OperatingExpenses", "CostsAndExpenses");
  const interestExpense = getAnnualValues(facts, "InterestExpense", "InterestExpenseDebt");
  const pretaxIncome = getAnnualValues(facts, "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments");
  const taxExpense = getAnnualValues(facts, "IncomeTaxExpenseBenefit");
  const epsDiluted = getAnnualShareValues(facts, "EarningsPerShareDiluted");
  const epsBasic = getAnnualShareValues(facts, "EarningsPerShareBasic");
  const sharesOut = getAnnualPureValues(facts, "CommonStockSharesOutstanding",
    "WeightedAverageNumberOfDilutedSharesOutstanding", "EntityCommonStockSharesOutstanding");

  // Balance Sheet concepts
  const totalAssets = getAnnualValues(facts, "Assets");
  const currentAssets = getAnnualValues(facts, "AssetsCurrent");
  const cash = getAnnualValues(facts, "CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsAndShortTermInvestments");
  const shortTermInvestments = getAnnualValues(facts, "ShortTermInvestments", "AvailableForSaleSecuritiesCurrent");
  const receivables = getAnnualValues(facts, "AccountsReceivableNetCurrent", "AccountsReceivableNet");
  const inventory = getAnnualValues(facts, "InventoryNet", "Inventory");
  const ppe = getAnnualValues(facts, "PropertyPlantAndEquipmentNet");
  const goodwill = getAnnualValues(facts, "Goodwill");
  const totalLiabilities = getAnnualValues(facts, "Liabilities");
  const currentLiabilities = getAnnualValues(facts, "LiabilitiesCurrent");
  const longTermDebt = getAnnualValues(facts, "LongTermDebtNoncurrent", "LongTermDebt");
  const shortTermDebt = getAnnualValues(facts, "ShortTermBorrowings", "DebtCurrent", "CommercialPaper");
  const equity = getAnnualValues(facts, "StockholdersEquity");
  const retainedEarnings = getAnnualValues(facts, "RetainedEarningsAccumulatedDeficit");
  const commonStock = getAnnualValues(facts, "CommonStocksIncludingAdditionalPaidInCapital", "CommonStockValue");
  const minorityInterest = getAnnualValues(facts, "MinorityInterest", "RedeemableNoncontrollingInterest");

  // Cash Flow concepts
  const opCashFlow = getAnnualValues(facts, "NetCashProvidedByUsedInOperatingActivities");
  const capex = getAnnualValues(facts, "PaymentsToAcquirePropertyPlantAndEquipment");
  const investingCF = getAnnualValues(facts, "NetCashProvidedByUsedInInvestingActivities");
  const financingCF = getAnnualValues(facts, "NetCashProvidedByUsedInFinancingActivities");
  const dividends = getAnnualValues(facts, "PaymentsOfDividendsCommonStock", "PaymentsOfDividends");
  const buybacks = getAnnualValues(facts, "PaymentsForRepurchaseOfCommonStock");
  const depreciation = getAnnualValues(facts, "DepreciationDepletionAndAmortization", "DepreciationAndAmortization");
  const sbc = getAnnualValues(facts, "ShareBasedCompensation", "StockBasedCompensation");

  // Collect all fiscal years from all concepts
  const allYears = new Set();
  const allMaps = [revenue, costOfRevenue, grossProfit, operatingIncome, netIncome,
    totalAssets, currentAssets, cash, totalLiabilities, equity,
    opCashFlow, capex, investingCF, financingCF];
  for (const m of allMaps) for (const y of m.keys()) allYears.add(y);

  const years = [...allYears].sort((a, b) => b - a); // descending
  if (years.length === 0) return null;

  const v = (map, year) => map.get(year)?.val ?? null;

  // Build FMP-format arrays
  const income = years
    .filter(y => v(revenue, y) != null || v(netIncome, y) != null || v(operatingIncome, y) != null)
    .map(y => {
      const rev = v(revenue, y);
      const gp = v(grossProfit, y);
      const oi = v(operatingIncome, y);
      const ni = v(netIncome, y);
      const endDate = revenue.get(y)?.end || netIncome.get(y)?.end || totalAssets.get(y)?.end || `${y}-12-31`;
      return {
        date: endDate,
        calendarYear: String(y),
        revenue: rev,
        costOfRevenue: v(costOfRevenue, y),
        grossProfit: gp,
        researchAndDevelopmentExpenses: v(rd, y),
        sellingGeneralAndAdministrativeExpenses: v(sga, y),
        operatingExpenses: v(opExpenses, y),
        operatingIncome: oi,
        interestExpense: v(interestExpense, y),
        incomeBeforeTax: v(pretaxIncome, y),
        incomeTaxExpense: v(taxExpense, y),
        netIncome: ni,
        epsdiluted: v(epsDiluted, y),
        eps: v(epsBasic, y),
        weightedAverageShsOutDil: v(sharesOut, y),
        grossProfitRatio: rev && gp ? gp / rev : null,
        operatingIncomeRatio: rev && oi ? oi / rev : null,
        netIncomeRatio: rev && ni ? ni / rev : null,
        _source: "edgar",
      };
    });

  const balance = years
    .filter(y => v(totalAssets, y) != null || v(equity, y) != null || v(totalLiabilities, y) != null)
    .map(y => {
      const endDate = totalAssets.get(y)?.end || equity.get(y)?.end || `${y}-12-31`;
      const cashVal = v(cash, y);
      const stInv = v(shortTermInvestments, y);
      const ltd = v(longTermDebt, y);
      const std = v(shortTermDebt, y);
      return {
        date: endDate,
        calendarYear: String(y),
        totalAssets: v(totalAssets, y),
        totalCurrentAssets: v(currentAssets, y),
        cashAndCashEquivalents: cashVal,
        shortTermInvestments: stInv,
        cashAndShortTermInvestments: (cashVal || 0) + (stInv || 0) || null,
        netReceivables: v(receivables, y),
        inventory: v(inventory, y),
        propertyPlantEquipmentNet: v(ppe, y),
        goodwill: v(goodwill, y),
        totalLiabilities: v(totalLiabilities, y),
        totalCurrentLiabilities: v(currentLiabilities, y),
        shortTermDebt: std,
        longTermDebt: ltd,
        totalDebt: (ltd || 0) + (std || 0) || null,
        totalStockholdersEquity: v(equity, y),
        retainedEarnings: v(retainedEarnings, y),
        commonStock: v(commonStock, y),
        minorityInterest: v(minorityInterest, y),
        _source: "edgar",
      };
    });

  const cashflow = years
    .filter(y => v(opCashFlow, y) != null || v(capex, y) != null || v(dividends, y) != null)
    .map(y => {
      const ocf = v(opCashFlow, y);
      const cx = v(capex, y);
      const endDate = opCashFlow.get(y)?.end || capex.get(y)?.end || `${y}-12-31`;
      return {
        date: endDate,
        calendarYear: String(y),
        operatingCashFlow: ocf,
        capitalExpenditure: cx ? -Math.abs(cx) : null,
        freeCashFlow: ocf != null && cx != null ? ocf - Math.abs(cx) : null,
        netCashUsedForInvestingActivites: v(investingCF, y),
        netCashUsedProvidedByFinancingActivities: v(financingCF, y),
        dividendsPaid: v(dividends, y),
        commonStockRepurchased: v(buybacks, y),
        depreciationAndAmortization: v(depreciation, y),
        stockBasedCompensation: v(sbc, y),
        _source: "edgar",
      };
    });

  console.log(`[EDGAR] Parsed: ${income.length} IS, ${balance.length} BS, ${cashflow.length} CF years (${years[years.length - 1]}-${years[0]})`);

  return {
    income,
    balance,
    cashflow,
    ratios: [],
    keyMetrics: [],
  };
}

// ── Main entry: fetch SEC EDGAR data for a ticker ──
export async function fetchEdgarFinancials(ticker) {
  // Only works for US stocks (no exchange suffix like .PA)
  if (ticker.includes(".")) {
    console.log("[EDGAR] Skipping non-US ticker:", ticker);
    return null;
  }

  try {
    const cik = await lookupCik(ticker);
    if (!cik) {
      console.log("[EDGAR] CIK not found for:", ticker);
      return null;
    }
    console.log(`[EDGAR] CIK for ${ticker}: ${cik}`);

    const facts = await fetchCompanyFacts(cik);
    return edgarToFmpData(facts);
  } catch (e) {
    console.warn("[EDGAR] Error:", e.message);
    return null;
  }
}

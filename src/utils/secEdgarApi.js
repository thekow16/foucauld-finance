// ──────────────────────────────────────────────
// SEC EDGAR XBRL API — Données financières gratuites, sans clé API
// 15+ ans d'historique pour les entreprises US
// ──────────────────────────────────────────────

const EDGAR_BASE = "https://data.sec.gov";
const USER_AGENT = "FoucauldFinance contact@foucauld.finance";

// ── Cache ticker → CIK ──
let tickerToCikMap = null;

async function loadTickerMap() {
  if (tickerToCikMap) return tickerToCikMap;
  const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error("Impossible de charger la table ticker→CIK");
  const data = await res.json();
  tickerToCikMap = {};
  for (const entry of Object.values(data)) {
    tickerToCikMap[entry.ticker?.toUpperCase()] = String(entry.cik_str);
  }
  return tickerToCikMap;
}

async function getCik(ticker) {
  const clean = ticker.toUpperCase().split(".")[0]; // MC.PA → MC (won't work for non-US)
  const map = await loadTickerMap();
  const cik = map[clean];
  if (!cik) return null;
  return cik.padStart(10, "0");
}

// ── Fetch companyfacts ──
async function fetchCompanyFacts(cik) {
  const res = await fetch(`${EDGAR_BASE}/api/xbrl/companyfacts/CIK${cik}.json`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`EDGAR companyfacts error: ${res.status}`);
  return res.json();
}

// ── Extract annual values for a given XBRL tag ──
function extractAnnualValues(facts, ...tagNames) {
  const gaap = facts?.facts?.["us-gaap"];
  if (!gaap) return [];

  for (const tag of tagNames) {
    const concept = gaap[tag];
    if (!concept) continue;
    const units = concept.units?.USD || concept.units?.["USD/shares"] || concept.units?.shares || concept.units?.pure;
    if (!units?.length) continue;

    // Filter: only 10-K filings, annual period (fp=FY)
    const annual = units.filter(e => e.form === "10-K" && e.fp === "FY");
    if (annual.length === 0) continue;

    // Deduplicate by fiscal year — keep the last filed
    const byYear = {};
    for (const e of annual) {
      const fy = e.fy;
      if (!byYear[fy] || e.filed > byYear[fy].filed) {
        byYear[fy] = e;
      }
    }
    return Object.values(byYear).sort((a, b) => b.fy - a.fy);
  }
  return [];
}

// ── Build fiscal year date map ──
function buildDateMap(facts) {
  // Get all fiscal year-end dates from Assets (most reliable tag)
  const assetEntries = extractAnnualValues(facts, "Assets");
  const dateMap = {};
  for (const e of assetEntries) {
    const date = e.end;
    if (!date) continue;
    dateMap[e.fy] = { date, fy: e.fy };
  }

  // If no Assets, try Revenue
  if (Object.keys(dateMap).length === 0) {
    const revEntries = extractAnnualValues(facts,
      "RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax");
    for (const e of revEntries) {
      if (e.end && !dateMap[e.fy]) dateMap[e.fy] = { date: e.end, fy: e.fy };
    }
  }

  return dateMap;
}

function getVal(facts, fy, ...tags) {
  for (const tag of tags) {
    const entries = extractAnnualValues(facts, tag);
    const match = entries.find(e => e.fy === fy);
    if (match?.val != null) return match.val;
  }
  return null;
}

// ── Parse into Yahoo-compatible format ──
function parseEdgarToYahoo(facts) {
  const dateMap = buildDateMap(facts);
  const years = Object.keys(dateMap).map(Number).sort((a, b) => b - a);

  if (years.length === 0) return null;

  const w = (v) => v != null ? { raw: v } : undefined;

  const balanceSheetStatements = [];
  const incomeStatements = [];
  const cashflowStatements = [];

  for (const fy of years) {
    const { date } = dateMap[fy];
    const endDate = { raw: Math.floor(new Date(date).getTime() / 1000), fmt: date };

    // ── Balance Sheet ──
    const totalAssets = getVal(facts, fy, "Assets");
    const totalCurrentAssets = getVal(facts, fy, "AssetsCurrent");
    const cash = getVal(facts, fy, "CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsAndShortTermInvestments", "Cash");
    const shortTermInvestments = getVal(facts, fy, "ShortTermInvestments", "AvailableForSaleSecuritiesCurrent", "MarketableSecuritiesCurrent");
    const netReceivables = getVal(facts, fy, "AccountsReceivableNetCurrent", "AccountsReceivableNet", "ReceivablesNetCurrent");
    const inventory = getVal(facts, fy, "InventoryNet", "Inventory");
    const ppe = getVal(facts, fy, "PropertyPlantAndEquipmentNet");
    const goodwill = getVal(facts, fy, "Goodwill");
    const intangibles = getVal(facts, fy, "IntangibleAssetsNetExcludingGoodwill", "FiniteLivedIntangibleAssetsNet");
    const totalLiab = getVal(facts, fy, "Liabilities");
    const totalCurrentLiabilities = getVal(facts, fy, "LiabilitiesCurrent");
    const accountsPayable = getVal(facts, fy, "AccountsPayableCurrent", "AccountsPayable");
    const shortTermDebt = getVal(facts, fy, "ShortTermBorrowings", "CommercialPaper", "ShortTermDebtCurrent");
    const longTermDebt = getVal(facts, fy, "LongTermDebtNoncurrent", "LongTermDebt");
    const totalEquity = getVal(facts, fy, "StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest");
    const retainedEarnings = getVal(facts, fy, "RetainedEarningsAccumulatedDeficit");
    const commonStock = getVal(facts, fy, "CommonStocksIncludingAdditionalPaidInCapital", "CommonStockValue");

    const totalDebt = (shortTermDebt || 0) + (longTermDebt || 0) || null;

    balanceSheetStatements.push({
      endDate,
      totalAssets: w(totalAssets),
      totalCurrentAssets: w(totalCurrentAssets),
      cash: w(cash),
      shortTermInvestments: w(shortTermInvestments),
      netReceivables: w(netReceivables),
      inventory: w(inventory),
      propertyPlantEquipment: w(ppe),
      goodWill: w(goodwill),
      intangibleAssets: w(intangibles),
      totalLiab: w(totalLiab),
      totalCurrentLiabilities: w(totalCurrentLiabilities),
      accountsPayable: w(accountsPayable),
      shortLongTermDebt: w(shortTermDebt),
      longTermDebt: w(longTermDebt),
      totalDebt: w(totalDebt),
      totalStockholderEquity: w(totalEquity),
      retainedEarnings: w(retainedEarnings),
      commonStock: w(commonStock),
      nonCurrentLiabilities: w(totalLiab && totalCurrentLiabilities ? totalLiab - totalCurrentLiabilities : null),
    });

    // ── Income Statement ──
    const revenue = getVal(facts, fy,
      "RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet",
      "RevenueFromContractWithCustomerIncludingAssessedTax");
    const costOfRevenue = getVal(facts, fy, "CostOfGoodsAndServicesSold", "CostOfRevenue", "CostOfGoodsSold");
    const grossProfit = getVal(facts, fy, "GrossProfit") || (revenue && costOfRevenue ? revenue - costOfRevenue : null);
    const rd = getVal(facts, fy, "ResearchAndDevelopmentExpense");
    const sga = getVal(facts, fy, "SellingGeneralAndAdministrativeExpense");
    const opExpenses = getVal(facts, fy, "OperatingExpenses", "CostsAndExpenses");
    const operatingIncome = getVal(facts, fy, "OperatingIncomeLoss");
    const interestExpense = getVal(facts, fy, "InterestExpense", "InterestExpenseDebt");
    const incomeBeforeTax = getVal(facts, fy, "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest", "IncomeLossFromContinuingOperationsBeforeIncomeTaxes");
    const incomeTax = getVal(facts, fy, "IncomeTaxExpenseBenefit");
    const netIncome = getVal(facts, fy, "NetIncomeLoss", "NetIncome", "ProfitLoss");
    const epsBasic = getVal(facts, fy, "EarningsPerShareBasic");
    const epsDiluted = getVal(facts, fy, "EarningsPerShareDiluted");
    const sharesOut = getVal(facts, fy, "WeightedAverageNumberOfDilutedSharesOutstanding", "CommonStockSharesOutstanding");
    const depreciation = getVal(facts, fy, "DepreciationDepletionAndAmortization", "DepreciationAndAmortization", "Depreciation");
    const ebitda = operatingIncome != null && depreciation != null ? operatingIncome + depreciation : null;

    incomeStatements.push({
      endDate,
      totalRevenue: w(revenue),
      costOfRevenue: w(costOfRevenue),
      grossProfit: w(grossProfit),
      researchDevelopment: w(rd),
      sellingGeneralAdministrative: w(sga),
      totalOperatingExpenses: w(opExpenses),
      operatingIncome: w(operatingIncome),
      ebit: w(operatingIncome),
      interestExpense: w(interestExpense ? -Math.abs(interestExpense) : null),
      incomeBeforeTax: w(incomeBeforeTax),
      incomeTaxExpense: w(incomeTax),
      netIncome: w(netIncome),
      netIncomeApplicableToCommonShares: w(netIncome),
      netIncomeFromContinuingOps: w(netIncome),
      ebitda: w(ebitda),
      basicEPS: w(epsBasic),
      dilutedEPS: w(epsDiluted),
      dilutedAverageShares: w(sharesOut),
    });

    // ── Cash Flow ──
    const opCashFlow = getVal(facts, fy,
      "NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByOperatingActivities");
    const capex = getVal(facts, fy,
      "PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsForCapitalImprovements");
    const fcf = opCashFlow != null && capex != null ? opCashFlow - Math.abs(capex) : null;
    const investingCF = getVal(facts, fy,
      "NetCashProvidedByUsedInInvestingActivities", "NetCashUsedInInvestingActivities");
    const financingCF = getVal(facts, fy,
      "NetCashProvidedByUsedInFinancingActivities", "NetCashUsedInFinancingActivities");
    const dividendsPaid = getVal(facts, fy,
      "PaymentsOfDividendsCommonStock", "PaymentsOfDividends", "Dividends");
    const repurchase = getVal(facts, fy,
      "PaymentsForRepurchaseOfCommonStock", "StockRepurchasedDuringPeriodValue");
    const sbc = getVal(facts, fy, "ShareBasedCompensation", "StockBasedCompensation", "AllocatedShareBasedCompensationExpense");

    cashflowStatements.push({
      endDate,
      totalCashFromOperatingActivities: w(opCashFlow),
      depreciation: w(depreciation),
      capitalExpenditures: w(capex ? -Math.abs(capex) : null),
      freeCashFlow: w(fcf),
      totalCashflowsFromInvestingActivities: w(investingCF),
      totalCashFromFinancingActivities: w(financingCF),
      dividendsPaid: w(dividendsPaid ? -Math.abs(dividendsPaid) : null),
      repurchaseOfStock: w(repurchase ? -Math.abs(repurchase) : null),
      stockBasedCompensation: w(sbc),
    });
  }

  return { balanceSheetStatements, incomeStatements, cashflowStatements };
}

// ── API publique ──
export async function fetchEdgarFinancials(ticker) {
  const cik = await getCik(ticker);
  if (!cik) {
    console.log("[FF][EDGAR] Ticker non trouvé dans SEC (non-US?):", ticker);
    return null;
  }
  console.log("[FF][EDGAR] Fetch companyfacts CIK", cik, "pour", ticker);
  const facts = await fetchCompanyFacts(cik);
  const result = parseEdgarToYahoo(facts);
  if (result) {
    console.log("[FF][EDGAR] Parsed:", result.balanceSheetStatements.length, "ans BS,",
      result.incomeStatements.length, "ans IS,",
      result.cashflowStatements.length, "ans CF");
  }
  return result;
}

export { getCik };

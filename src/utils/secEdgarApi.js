// ──────────────────────────────────────────────
// SEC EDGAR XBRL API — Données financières gratuites, sans clé API
// 15+ ans d'historique pour entreprises US + étrangères cotées aux US (20-F)
// Supporte US-GAAP et IFRS
// Tous les appels passent par le proxy CORS (proxyFetch)
// ──────────────────────────────────────────────

import { proxyFetch } from "./proxyFetch";

const EDGAR_BASE = "https://data.sec.gov";
const EDGAR_TIMEOUT = 8000; // 8s max pour ne pas bloquer l'UX

// Annual filing form types
const ANNUAL_FORMS = new Set(["10-K", "10-KT", "20-F", "20-FT", "40-F"]);

// ── Cache ticker → CIK (mémoire + localStorage) ──
let tickerToCikMap = null;
const TICKER_MAP_CACHE_KEY = "ff_edgar_tickers";
const TICKER_MAP_TTL = 7 * 24 * 60 * 60 * 1000; // 7 jours

async function loadTickerMap() {
  if (tickerToCikMap) return tickerToCikMap;

  // Essayer localStorage d'abord
  try {
    const cached = localStorage.getItem(TICKER_MAP_CACHE_KEY);
    if (cached) {
      const { data, ts } = JSON.parse(cached);
      if (Date.now() - ts < TICKER_MAP_TTL && data && Object.keys(data).length > 1000) {
        tickerToCikMap = data;
        console.log("[FF][EDGAR] Ticker map chargé depuis cache (" + Object.keys(data).length + " tickers)");
        return tickerToCikMap;
      }
    }
  } catch { /* ignore */ }

  // Fetch via proxy CORS
  const data = await proxyFetch("https://www.sec.gov/files/company_tickers.json");
  tickerToCikMap = {};
  for (const entry of Object.values(data)) {
    tickerToCikMap[entry.ticker?.toUpperCase()] = String(entry.cik_str);
  }

  // Sauvegarder en localStorage
  try {
    localStorage.setItem(TICKER_MAP_CACHE_KEY, JSON.stringify({ data: tickerToCikMap, ts: Date.now() }));
  } catch { /* localStorage plein */ }

  console.log("[FF][EDGAR] Ticker map chargé (" + Object.keys(tickerToCikMap).length + " tickers)");
  return tickerToCikMap;
}

// Common international ticker → US ticker/ADR mappings
const INTL_TICKER_ALIASES = {
  // French stocks
  "MC": ["LVMUY", "LVMHF"], // LVMH
  "OR": ["LRLCY", "LRLCF"],  // L'Oréal
  "SAN": ["SNYNF", "SNY"],    // Sanofi
  "AI": ["AIQUF", "AIRP"],    // Air Liquide
  "SU": ["SBGSY", "SBGSF"],   // Schneider Electric
  "BN": ["BNPQY", "BNPQF"],   // Danone / BNP
  "TTE": ["TTE"],              // TotalEnergies (same ticker)
  "HO": ["THLLY", "THLLF"],   // Thales
  "RMS": ["HESAY", "HESAF"],   // Hermès
  "CDI": ["CDIOF"],            // Christian Dior
  "KER": ["PPRUY", "PPRUF"],   // Kering
  "CAP": ["CAPMF", "CGEMY"],   // Capgemini
  "VIV": ["VIVHY", "VIVEF"],   // Vivendi
  "DG": ["VEOEY", "VEOEF"],    // Vinci

  // German stocks
  "SAP": ["SAP"],               // SAP (same ticker)
  "SIE": ["SIEGY", "SMAWF"],    // Siemens
  "ALV": ["ALIZY", "ALIZF"],    // Allianz
  "BAS": ["BASFY", "BFFAF"],    // BASF
  "DTE": ["DTEGY", "DTEGF"],    // Deutsche Telekom
  "MBG": ["MBGYY", "MBGAF"],    // Mercedes-Benz
  "BMW": ["BMWYY", "BAMXF"],    // BMW
  "ADS": ["ADDYY", "ADDDF"],    // Adidas
  "MRK": ["MKKGY", "MKGAF"],    // Merck KGaA

  // Dutch stocks
  "ASML": ["ASML"],              // ASML (same ticker)
  "PHIA": ["PHG"],               // Philips
  "UNA": ["UL"],                 // Unilever

  // Swiss stocks
  "NESN": ["NSRGY", "NSRGF"],   // Nestlé
  "ROG": ["RHHBY", "RHHBF"],    // Roche
  "NOVN": ["NVS", "NVSEF"],     // Novartis
  "ABBN": ["ABB"],               // ABB

  // UK stocks
  "SHEL": ["SHEL"],              // Shell (same ticker)
  "AZN": ["AZN"],                // AstraZeneca (same ticker)
  "HSBA": ["HSBC"],              // HSBC
  "BP": ["BP"],                  // BP (same ticker)
  "GSK": ["GSK"],                // GSK (same ticker)
  "ULVR": ["UL"],                // Unilever
  "RIO": ["RIO"],                // Rio Tinto (same ticker)
  "BATS": ["BTI"],               // British American Tobacco
  "DGE": ["DEO"],                // Diageo

  // Japanese stocks (common ADRs)
  "7203": ["TM"],                // Toyota
  "6758": ["SONY"],              // Sony
  "9984": ["SFTBY"],             // SoftBank
  "6861": ["KSRYF"],             // Keyence
  "9432": ["NTTYY"],             // NTT

  // Other
  "NOVO-B": ["NVO"],             // Novo Nordisk
  "ASML": ["ASML"],
};

async function getCik(ticker) {
  const upper = ticker.toUpperCase();
  const clean = upper.split(".")[0]; // MC.PA → MC
  const map = await loadTickerMap();

  // Try direct match first
  if (map[clean]) return map[clean].padStart(10, "0");

  // Try the full ticker (some have dots in SEC too)
  if (map[upper]) return map[upper].padStart(10, "0");

  // Try international aliases
  const aliases = INTL_TICKER_ALIASES[clean];
  if (aliases) {
    for (const alt of aliases) {
      if (map[alt]) return map[alt].padStart(10, "0");
    }
  }

  return null;
}

// ── Fetch companyfacts via proxy CORS ──
async function fetchCompanyFacts(cik) {
  return proxyFetch(`${EDGAR_BASE}/api/xbrl/companyfacts/CIK${cik}.json`);
}

// ── Detect taxonomy: us-gaap or ifrs-full ──
function detectTaxonomy(facts) {
  const gaap = facts?.facts?.["us-gaap"];
  const ifrs = facts?.facts?.["ifrs-full"];
  // Prefer us-gaap if it has Assets; otherwise ifrs-full
  if (gaap?.Assets) return "us-gaap";
  if (ifrs?.Assets) return "ifrs-full";
  // Check which has more data
  const gaapCount = gaap ? Object.keys(gaap).length : 0;
  const ifrsCount = ifrs ? Object.keys(ifrs).length : 0;
  return ifrsCount > gaapCount ? "ifrs-full" : "us-gaap";
}

// ── Extract annual values for a given XBRL tag ──
function extractAnnualValues(facts, taxonomy, ...tagNames) {
  const ns = facts?.facts?.[taxonomy];
  if (!ns) return [];

  for (const tag of tagNames) {
    const concept = ns[tag];
    if (!concept) continue;
    const units = concept.units?.USD || concept.units?.EUR || concept.units?.GBP
      || concept.units?.JPY || concept.units?.CHF || concept.units?.["USD/shares"]
      || concept.units?.["EUR/shares"] || concept.units?.shares || concept.units?.pure;
    if (!units?.length) continue;

    // Filter: annual filings (10-K, 20-F, 40-F), annual period (fp=FY)
    const annual = units.filter(e => ANNUAL_FORMS.has(e.form) && e.fp === "FY");
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

// ── Tag name mapping: US-GAAP vs IFRS ──
const TAG_MAP = {
  "us-gaap": {
    // Balance Sheet
    assets: ["Assets"],
    currentAssets: ["AssetsCurrent"],
    cash: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsAndShortTermInvestments", "Cash"],
    shortTermInvestments: ["ShortTermInvestments", "AvailableForSaleSecuritiesCurrent", "MarketableSecuritiesCurrent"],
    receivables: ["AccountsReceivableNetCurrent", "AccountsReceivableNet", "ReceivablesNetCurrent"],
    inventory: ["InventoryNet", "Inventory"],
    ppe: ["PropertyPlantAndEquipmentNet"],
    goodwill: ["Goodwill"],
    intangibles: ["IntangibleAssetsNetExcludingGoodwill", "FiniteLivedIntangibleAssetsNet"],
    liabilities: ["Liabilities"],
    currentLiabilities: ["LiabilitiesCurrent"],
    accountsPayable: ["AccountsPayableCurrent", "AccountsPayable"],
    shortTermDebt: ["ShortTermBorrowings", "CommercialPaper", "ShortTermDebtCurrent"],
    longTermDebt: ["LongTermDebtNoncurrent", "LongTermDebt"],
    equity: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
    retainedEarnings: ["RetainedEarningsAccumulatedDeficit"],
    commonStock: ["CommonStocksIncludingAdditionalPaidInCapital", "CommonStockValue"],
    // Income Statement
    revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax"],
    costOfRevenue: ["CostOfGoodsAndServicesSold", "CostOfRevenue", "CostOfGoodsSold"],
    grossProfit: ["GrossProfit"],
    rd: ["ResearchAndDevelopmentExpense"],
    sga: ["SellingGeneralAndAdministrativeExpense"],
    opExpenses: ["OperatingExpenses", "CostsAndExpenses"],
    operatingIncome: ["OperatingIncomeLoss"],
    interestExpense: ["InterestExpense", "InterestExpenseDebt"],
    incomeBeforeTax: ["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest", "IncomeLossFromContinuingOperationsBeforeIncomeTaxes"],
    incomeTax: ["IncomeTaxExpenseBenefit"],
    netIncome: ["NetIncomeLoss", "NetIncome", "ProfitLoss"],
    epsBasic: ["EarningsPerShareBasic"],
    epsDiluted: ["EarningsPerShareDiluted"],
    sharesOut: ["WeightedAverageNumberOfDilutedSharesOutstanding", "CommonStockSharesOutstanding"],
    depreciation: ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization", "Depreciation"],
    // Cash Flow
    opCashFlow: ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByOperatingActivities"],
    capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsForCapitalImprovements"],
    investingCF: ["NetCashProvidedByUsedInInvestingActivities", "NetCashUsedInInvestingActivities"],
    financingCF: ["NetCashProvidedByUsedInFinancingActivities", "NetCashUsedInFinancingActivities"],
    dividendsPaid: ["PaymentsOfDividendsCommonStock", "PaymentsOfDividends", "Dividends"],
    repurchase: ["PaymentsForRepurchaseOfCommonStock", "StockRepurchasedDuringPeriodValue"],
    sbc: ["ShareBasedCompensation", "StockBasedCompensation", "AllocatedShareBasedCompensationExpense"],
  },
  "ifrs-full": {
    // Balance Sheet (IFRS taxonomy)
    assets: ["Assets"],
    currentAssets: ["CurrentAssets"],
    cash: ["CashAndCashEquivalents"],
    shortTermInvestments: ["CurrentFinancialAssets", "OtherCurrentFinancialAssets"],
    receivables: ["TradeAndOtherCurrentReceivables", "CurrentTradeReceivables"],
    inventory: ["Inventories"],
    ppe: ["PropertyPlantAndEquipment"],
    goodwill: ["Goodwill"],
    intangibles: ["IntangibleAssetsOtherThanGoodwill", "OtherIntangibleAssets"],
    liabilities: ["Liabilities"],
    currentLiabilities: ["CurrentLiabilities"],
    accountsPayable: ["TradeAndOtherCurrentPayables", "CurrentTradePayables"],
    shortTermDebt: ["CurrentBorrowings", "ShorttermBorrowings"],
    longTermDebt: ["NoncurrentBorrowings", "LongtermBorrowings"],
    equity: ["Equity", "EquityAttributableToOwnersOfParent"],
    retainedEarnings: ["RetainedEarnings"],
    commonStock: ["IssuedCapital", "ShareCapital"],
    // Income Statement (IFRS)
    revenue: ["Revenue", "RevenueFromContractsWithCustomers"],
    costOfRevenue: ["CostOfSales"],
    grossProfit: ["GrossProfit"],
    rd: ["ResearchAndDevelopmentExpense"],
    sga: ["SellingGeneralAndAdministrativeExpense", "AdministrativeExpense"],
    opExpenses: ["OtherExpenseByFunction"],
    operatingIncome: ["ProfitLossFromOperatingActivities", "OperatingProfitLoss"],
    interestExpense: ["InterestExpense", "FinanceCosts"],
    incomeBeforeTax: ["ProfitLossBeforeTax"],
    incomeTax: ["IncomeTaxExpenseContinuingOperations", "TaxExpenseIncome"],
    netIncome: ["ProfitLoss", "ProfitLossAttributableToOwnersOfParent"],
    epsBasic: ["BasicEarningsLossPerShare"],
    epsDiluted: ["DilutedEarningsLossPerShare"],
    sharesOut: ["WeightedAverageShares", "NumberOfSharesOutstanding"],
    depreciation: ["DepreciationAndAmortisationExpense", "DepreciationExpense"],
    // Cash Flow (IFRS)
    opCashFlow: ["CashFlowsFromUsedInOperatingActivities"],
    capex: ["PurchaseOfPropertyPlantAndEquipment", "PaymentsForPropertyPlantAndEquipment"],
    investingCF: ["CashFlowsFromUsedInInvestingActivities"],
    financingCF: ["CashFlowsFromUsedInFinancingActivities"],
    dividendsPaid: ["DividendsPaid", "DividendsPaidClassifiedAsFinancingActivities"],
    repurchase: ["PurchaseOfTreasuryShares", "PaymentsForRepurchaseOfEquity"],
    sbc: ["SharebasedPaymentArrangementExpense"],
  },
};

// ── Build fiscal year date map ──
function buildDateMap(facts, taxonomy) {
  const dateMap = {};
  // Try Assets first (most reliable for balance sheet)
  const tags = TAG_MAP[taxonomy];
  const assetEntries = extractAnnualValues(facts, taxonomy, ...tags.assets);
  for (const e of assetEntries) {
    if (e.end) dateMap[e.fy] = { date: e.end, fy: e.fy };
  }

  // Fallback to Revenue
  if (Object.keys(dateMap).length === 0) {
    const revEntries = extractAnnualValues(facts, taxonomy, ...tags.revenue);
    for (const e of revEntries) {
      if (e.end && !dateMap[e.fy]) dateMap[e.fy] = { date: e.end, fy: e.fy };
    }
  }

  return dateMap;
}

function getVal(facts, taxonomy, fy, key) {
  const tags = TAG_MAP[taxonomy]?.[key];
  if (!tags) return null;
  for (const tag of tags) {
    const entries = extractAnnualValues(facts, taxonomy, tag);
    const match = entries.find(e => e.fy === fy);
    if (match?.val != null) return match.val;
  }
  return null;
}

// ── Parse into Yahoo-compatible format ──
function parseEdgarToYahoo(facts) {
  const taxonomy = detectTaxonomy(facts);
  console.log("[FF][EDGAR] Taxonomie détectée:", taxonomy);

  const dateMap = buildDateMap(facts, taxonomy);
  const years = Object.keys(dateMap).map(Number).sort((a, b) => b - a);

  if (years.length === 0) return null;

  const w = (v) => v != null ? { raw: v } : undefined;
  const g = (fy, key) => getVal(facts, taxonomy, fy, key);

  const balanceSheetStatements = [];
  const incomeStatements = [];
  const cashflowStatements = [];

  for (const fy of years) {
    const { date } = dateMap[fy];
    const endDate = { raw: Math.floor(new Date(date).getTime() / 1000), fmt: date };

    // ── Balance Sheet ──
    const totalAssets = g(fy, "assets");
    const totalCurrentAssets = g(fy, "currentAssets");
    const cash = g(fy, "cash");
    const shortTermInvestments = g(fy, "shortTermInvestments");
    const netReceivables = g(fy, "receivables");
    const inventory = g(fy, "inventory");
    const ppe = g(fy, "ppe");
    const goodwill = g(fy, "goodwill");
    const intangibles = g(fy, "intangibles");
    const totalLiab = g(fy, "liabilities");
    const totalCurrentLiabilities = g(fy, "currentLiabilities");
    const accountsPayable = g(fy, "accountsPayable");
    const shortTermDebt = g(fy, "shortTermDebt");
    const longTermDebt = g(fy, "longTermDebt");
    const totalEquity = g(fy, "equity");
    const retainedEarnings = g(fy, "retainedEarnings");
    const commonStock = g(fy, "commonStock");
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
    const revenue = g(fy, "revenue");
    const costOfRevenue = g(fy, "costOfRevenue");
    const grossProfit = g(fy, "grossProfit") || (revenue && costOfRevenue ? revenue - costOfRevenue : null);
    const rd = g(fy, "rd");
    const sga = g(fy, "sga");
    const opExpenses = g(fy, "opExpenses");
    const operatingIncome = g(fy, "operatingIncome");
    const interestExpense = g(fy, "interestExpense");
    const incomeBeforeTax = g(fy, "incomeBeforeTax");
    const incomeTax = g(fy, "incomeTax");
    const netIncome = g(fy, "netIncome");
    const epsBasic = g(fy, "epsBasic");
    const epsDiluted = g(fy, "epsDiluted");
    const sharesOut = g(fy, "sharesOut");
    const depreciation = g(fy, "depreciation");
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
    const opCashFlow = g(fy, "opCashFlow");
    const capex = g(fy, "capex");
    const fcf = opCashFlow != null && capex != null ? opCashFlow - Math.abs(capex) : null;
    const investingCF = g(fy, "investingCF");
    const financingCF = g(fy, "financingCF");
    const dividendsPaid = g(fy, "dividendsPaid");
    const repurchase = g(fy, "repurchase");
    const sbc = g(fy, "sbc");

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

// ── Timeout helper ──
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`EDGAR timeout (${ms}ms)`)), ms)),
  ]);
}

// ── API publique ──
export async function fetchEdgarFinancials(ticker) {
  const cik = await withTimeout(getCik(ticker), EDGAR_TIMEOUT);
  if (!cik) {
    console.log("[FF][EDGAR] Ticker non trouvé dans SEC:", ticker);
    return null;
  }
  console.log("[FF][EDGAR] Fetch companyfacts CIK", cik, "pour", ticker);
  const facts = await withTimeout(fetchCompanyFacts(cik), EDGAR_TIMEOUT);
  const result = parseEdgarToYahoo(facts);
  if (result) {
    console.log("[FF][EDGAR] Parsed:", result.balanceSheetStatements.length, "ans BS,",
      result.incomeStatements.length, "ans IS,",
      result.cashflowStatements.length, "ans CF");
  }
  return result;
}

export { getCik };

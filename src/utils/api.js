import { hasFmpApiKey, fetchProfile, fetchAllFinancials, fetchAllQuarterlyFinancials } from "./fmpApi";

// ──────────────────────────────────────────────
// Cloudflare Worker URL
// ──────────────────────────────────────────────
const WORKER_URL = "https://foucauld-proxy.foucauld-finance.workers.dev";

// Proxies CORS gratuits — allorigins en premier (confirmé fonctionnel)
const FREE_PROXIES = [
  url => ({ url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` }),
  url => ({ url: `https://corsproxy.io/?url=${encodeURIComponent(url)}` }),
  url => ({ url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` }),
  url => ({ url: `https://thingproxy.freeboard.io/fetch/${url}` }),
  url => ({ url: `https://everyorigin.jwvbremen.nl/api/get?url=${encodeURIComponent(url)}`, unwrap: true }),
];

const YF = "https://query2.finance.yahoo.com";

// ── Worker health check ──
export async function checkWorkerHealth() {
  if (!WORKER_URL) return false;
  try {
    const res = await fetch(`${WORKER_URL}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function tryFetch(url, unwrap = false) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { "Accept": "application/json" },
  });
  if (res.status === 429) throw new Error("Rate limit serveur dépassé. Patientez 1 minute.");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  let data = JSON.parse(text);
  if (unwrap && typeof data.contents === "string") {
    data = JSON.parse(data.contents);
  }
  return data;
}

export async function proxyFetch(targetUrl) {
  // 1) Cloudflare Worker (gère le crumb automatiquement)
  if (WORKER_URL) {
    try {
      const data = await tryFetch(`${WORKER_URL}?url=${encodeURIComponent(targetUrl)}`);
      console.log("[FF] Succès via Worker");
      return data;
    } catch (e) {
      console.warn("[FF] Worker échoué:", e.message);
    }
  }

  // 2) Fallback proxies gratuits
  for (let i = 0; i < FREE_PROXIES.length; i++) {
    const { url, unwrap } = FREE_PROXIES[i](targetUrl);
    const label = new URL(url).hostname;
    try {
      const data = await tryFetch(url, unwrap);
      console.log(`[FF] Succès via ${label}`);
      return data;
    } catch (e) {
      console.warn(`[FF] ${label} → ${e.message}`);
    }
  }

  throw new Error("Impossible de contacter Yahoo Finance.");
}

// ── Fetch Yahoo Finance (essaie query2 puis query1) ──
async function yfFetch(path) {
  for (const host of [YF, YF.replace("query2", "query1")]) {
    try {
      return await proxyFetch(`${host}${path}`);
    } catch (_) {}
  }
  throw new Error("Impossible de contacter Yahoo Finance.");
}

// ── Chart data (fonctionne SANS crumb) ──
export async function fetchChartData(sym, interval, range) {
  const json = await yfFetch(`/v8/finance/chart/${sym}?interval=${interval}&range=${range}`);
  const result = json.chart?.result?.[0];
  if (!result) return [];
  const ts = result.timestamp || [];
  const cl = result.indicators.quote[0].close || [];
  return ts
    .map((t, i) => ({
      date: new Date(t * 1000).toLocaleDateString("fr-FR", { month: "short", day: "numeric" }),
      price: cl[i] ? +cl[i].toFixed(2) : null,
    }))
    .filter(d => d.price !== null);
}

export async function fetchCandleData(sym, interval, range) {
  const json = await yfFetch(`/v8/finance/chart/${sym}?interval=${interval}&range=${range}`);
  const result = json.chart?.result?.[0];
  if (!result) return [];
  const ts = result.timestamp || [];
  const q = result.indicators.quote[0];
  const op = q.open || [], hi = q.high || [], lo = q.low || [], cl = q.close || [];
  return ts
    .map((t, i) => {
      if (op[i] == null || hi[i] == null || lo[i] == null || cl[i] == null) return null;
      return {
        time: new Date(t * 1000).toISOString().slice(0, 10),
        open: +op[i].toFixed(2),
        high: +hi[i].toFixed(2),
        low: +lo[i].toFixed(2),
        close: +cl[i].toFixed(2),
      };
    })
    .filter(Boolean);
}

// ── Yahoo Timeseries API — retourne les données financières détaillées ──
// L'API quoteSummary ne retourne plus les valeurs financières (seulement endDate),
// donc on utilise fundamentals-timeseries comme source alternative.
// Les requêtes sont divisées en 2 lots parallèles pour réduire la taille des URLs.
async function fetchYahooTimeseries(sym) {
  const now = Math.floor(Date.now() / 1000);
  const fortyYearsAgo = now - 40 * 365 * 86400;

  // Batch 1: Income + Cashflow (essential for charts)
  const batch1Fields = [
    "annualTotalRevenue", "annualCostOfRevenue", "annualGrossProfit",
    "annualResearchAndDevelopment", "annualSellingGeneralAndAdministration",
    "annualOperatingExpense", "annualOperatingIncome", "annualInterestExpense",
    "annualPretaxIncome", "annualTaxProvision", "annualNetIncome",
    "annualEBITDA", "annualDilutedEPS", "annualBasicEPS",
    "annualDilutedAverageShares",
    "annualOperatingCashFlow", "annualCapitalExpenditure", "annualFreeCashFlow",
    "annualInvestingCashFlow", "annualFinancingCashFlow",
    "annualRepurchaseOfCapitalStock", "annualCashDividendsPaid",
    "annualChangeInCashSupplementalAsReported", "annualStockBasedCompensation",
  ];

  // Batch 2: Balance sheet
  const batch2Fields = [
    "annualTotalAssets", "annualTotalCurrentAssets", "annualCashAndCashEquivalents",
    "annualShortTermInvestments", "annualNetReceivables", "annualInventory",
    "annualOtherCurrentAssets", "annualNetPPE", "annualGoodwillAndOtherIntangibleAssets",
    "annualTotalNonCurrentAssets", "annualTotalLiabilitiesNetMinorityInterest",
    "annualCurrentLiabilities", "annualCurrentDebt", "annualAccountsPayable",
    "annualNonCurrentLiabilitiesTotal", "annualLongTermDebt", "annualTotalDebt",
    "annualStockholdersEquity", "annualRetainedEarnings", "annualCommonStock",
    "annualMinorityInterest",
  ];

  // Batch 3: Quarterly data (key metrics only for charts toggle)
  const batch3Fields = [
    "quarterlyTotalRevenue", "quarterlyOperatingIncome", "quarterlyNetIncome",
    "quarterlyDilutedEPS", "quarterlyDilutedAverageShares",
    "quarterlyOperatingCashFlow", "quarterlyCapitalExpenditure", "quarterlyFreeCashFlow",
    "quarterlyStockBasedCompensation", "quarterlyCashDividendsPaid",
    "quarterlyTotalAssets", "quarterlyTotalCurrentAssets", "quarterlyCashAndCashEquivalents",
    "quarterlyTotalDebt", "quarterlyCurrentLiabilities", "quarterlyStockholdersEquity",
  ];

  const baseUrl = `${YF}/ws/fundamentals-timeseries/v1/finance/timeseries/${sym}?period1=${fortyYearsAgo}&period2=${now}&merge=false&padTimeSeries=false&type=`;

  // Retry helper for timeseries batches (network can be flaky)
  const fetchWithRetry = async (url, label, retries = 2) => {
    for (let i = 0; i <= retries; i++) {
      try {
        return await proxyFetch(url);
      } catch (e) {
        console.warn(`[FF] timeseries ${label} attempt ${i + 1}/${retries + 1} failed:`, e.message);
        if (i < retries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
    return null;
  };

  try {
    // Fetch all batches in parallel with retry for reliability
    const [json1, json2, json3] = await Promise.all([
      fetchWithRetry(baseUrl + batch1Fields.join(","), "batch1 (IS+CF)"),
      fetchWithRetry(baseUrl + batch2Fields.join(","), "batch2 (BS)"),
      fetchWithRetry(baseUrl + batch3Fields.join(","), "batch3 (quarterly)"),
    ]);

    // Merge results from all batches (annual)
    const allSeries = [
      ...(json1?.timeseries?.result || []),
      ...(json2?.timeseries?.result || []),
    ];

    // Quarterly series (separate)
    const quarterlySeries = json3?.timeseries?.result || [];

    console.log("[FF] timeseries fetched, batch1:", json1?.timeseries?.result?.length ?? "FAIL",
      "batch2:", json2?.timeseries?.result?.length ?? "FAIL",
      "batch3 (quarterly):", quarterlySeries.length, "total annual:", allSeries.length);

    if (allSeries.length === 0) return null;

    // Organize data by date
    const dateMap = {};
    for (const s of allSeries) {
      const fieldName = s.meta?.type?.[0];
      if (!fieldName) continue;
      const entries = s[fieldName] || [];
      for (const entry of entries) {
        const date = entry.asOfDate;
        if (!date) continue;
        if (!dateMap[date]) dateMap[date] = {};
        dateMap[date][fieldName] = entry.reportedValue?.raw;
      }
    }

    const dates = Object.keys(dateMap).sort().reverse();
    console.log(`[FF] timeseries dates (${dates.length} years):`, dates.join(", "));
    if (dates.length === 0) return null;

    const w = (v) => v != null ? { raw: v } : undefined;

    // Build balance sheet statements
    const balanceSheetStatements = dates.map(date => {
      const d = dateMap[date];
      return {
        endDate: { raw: Math.floor(new Date(date).getTime() / 1000), fmt: date },
        totalAssets: w(d.annualTotalAssets),
        totalCurrentAssets: w(d.annualTotalCurrentAssets),
        cash: w(d.annualCashAndCashEquivalents),
        shortTermInvestments: w(d.annualShortTermInvestments),
        netReceivables: w(d.annualNetReceivables),
        inventory: w(d.annualInventory),
        otherCurrentAssets: w(d.annualOtherCurrentAssets),
        propertyPlantEquipment: w(d.annualNetPPE),
        goodWill: w(d.annualGoodwillAndOtherIntangibleAssets),
        totalNonCurrentAssets: w(d.annualTotalNonCurrentAssets),
        totalLiab: w(d.annualTotalLiabilitiesNetMinorityInterest),
        totalCurrentLiabilities: w(d.annualCurrentLiabilities),
        shortLongTermDebt: w(d.annualCurrentDebt),
        accountsPayable: w(d.annualAccountsPayable),
        longTermDebt: w(d.annualLongTermDebt),
        totalDebt: w(d.annualTotalDebt),
        totalStockholderEquity: w(d.annualStockholdersEquity),
        retainedEarnings: w(d.annualRetainedEarnings),
        commonStock: w(d.annualCommonStock),
        minorityInterest: w(d.annualMinorityInterest),
        nonCurrentLiabilities: w(d.annualNonCurrentLiabilitiesTotal),
      };
    });

    // Build income statements
    const incomeStatements = dates.map(date => {
      const d = dateMap[date];
      return {
        endDate: { raw: Math.floor(new Date(date).getTime() / 1000), fmt: date },
        totalRevenue: w(d.annualTotalRevenue),
        costOfRevenue: w(d.annualCostOfRevenue),
        grossProfit: w(d.annualGrossProfit),
        researchDevelopment: w(d.annualResearchAndDevelopment),
        sellingGeneralAdministrative: w(d.annualSellingGeneralAndAdministration),
        totalOperatingExpenses: w(d.annualOperatingExpense),
        operatingIncome: w(d.annualOperatingIncome),
        interestExpense: w(d.annualInterestExpense),
        incomeBeforeTax: w(d.annualPretaxIncome),
        incomeTaxExpense: w(d.annualTaxProvision),
        netIncome: w(d.annualNetIncome),
        ebitda: w(d.annualEBITDA),
        dilutedEPS: w(d.annualDilutedEPS),
        basicEPS: w(d.annualBasicEPS),
        dilutedAverageShares: w(d.annualDilutedAverageShares),
      };
    });

    // Build cashflow statements
    const cashflowStatements = dates.map(date => {
      const d = dateMap[date];
      return {
        endDate: { raw: Math.floor(new Date(date).getTime() / 1000), fmt: date },
        totalCashFromOperatingActivities: w(d.annualOperatingCashFlow),
        capitalExpenditures: w(d.annualCapitalExpenditure),
        freeCashFlow: w(d.annualFreeCashFlow),
        totalCashflowsFromInvestingActivities: w(d.annualInvestingCashFlow),
        totalCashFromFinancingActivities: w(d.annualFinancingCashFlow),
        repurchaseOfStock: w(d.annualRepurchaseOfCapitalStock),
        dividendsPaid: w(d.annualCashDividendsPaid),
        changeInCash: w(d.annualChangeInCashSupplementalAsReported),
        stockBasedCompensation: w(d.annualStockBasedCompensation),
      };
    });

    console.log("[FF] timeseries parsed:", dates.length, "years,",
      "bs sample:", balanceSheetStatements[0]?.totalAssets?.raw,
      "is sample:", incomeStatements[0]?.totalRevenue?.raw);

    // Parse quarterly data
    let quarterlyData = null;
    if (quarterlySeries.length > 0) {
      const qDateMap = {};
      for (const s of quarterlySeries) {
        const fieldName = s.meta?.type?.[0];
        if (!fieldName) continue;
        const entries = s[fieldName] || [];
        for (const entry of entries) {
          const date = entry.asOfDate;
          if (!date) continue;
          if (!qDateMap[date]) qDateMap[date] = {};
          qDateMap[date][fieldName] = entry.reportedValue?.raw;
        }
      }
      const qDates = Object.keys(qDateMap).sort().reverse();
      if (qDates.length > 0) {
        quarterlyData = qDates.map(date => {
          const d = qDateMap[date];
          return {
            endDate: { raw: Math.floor(new Date(date).getTime() / 1000), fmt: date },
            totalRevenue: w(d.quarterlyTotalRevenue),
            operatingIncome: w(d.quarterlyOperatingIncome),
            netIncome: w(d.quarterlyNetIncome),
            dilutedEPS: w(d.quarterlyDilutedEPS),
            dilutedAverageShares: w(d.quarterlyDilutedAverageShares),
            totalCashFromOperatingActivities: w(d.quarterlyOperatingCashFlow),
            capitalExpenditures: w(d.quarterlyCapitalExpenditure),
            freeCashFlow: w(d.quarterlyFreeCashFlow),
            stockBasedCompensation: w(d.quarterlyStockBasedCompensation),
            dividendsPaid: w(d.quarterlyCashDividendsPaid),
            totalAssets: w(d.quarterlyTotalAssets),
            totalCurrentAssets: w(d.quarterlyTotalCurrentAssets),
            cash: w(d.quarterlyCashAndCashEquivalents),
            totalDebt: w(d.quarterlyTotalDebt),
            totalCurrentLiabilities: w(d.quarterlyCurrentLiabilities),
            totalStockholderEquity: w(d.quarterlyStockholdersEquity),
          };
        });
        console.log("[FF] quarterly parsed:", quarterlyData.length, "quarters");
      }
    }

    return { balanceSheetStatements, incomeStatements, cashflowStatements, quarterlyData };
  } catch (e) {
    console.warn("[FF] timeseries fetch failed:", e.message);
    return null;
  }
}

// ── Build quarterly data from FMP (fallback when Yahoo timeseries batch3 fails) ──
function buildFmpQuarterlyData({ income, balance, cashflow }) {
  const dateMap = {};
  const addToDate = (arr, mapper) => {
    for (const d of (arr || [])) {
      const date = d.date;
      if (!date) continue;
      if (!dateMap[date]) dateMap[date] = {};
      Object.assign(dateMap[date], mapper(d));
    }
  };
  addToDate(income, d => ({
    totalRevenue: yw(d.revenue),
    operatingIncome: yw(d.operatingIncome),
    netIncome: yw(d.netIncome),
    dilutedEPS: yw(d.epsdiluted),
    dilutedAverageShares: yw(d.weightedAverageShsOutDil),
  }));
  addToDate(balance, d => ({
    totalAssets: yw(d.totalAssets),
    totalCurrentAssets: yw(d.totalCurrentAssets),
    cash: yw(d.cashAndCashEquivalents),
    totalDebt: yw(d.totalDebt),
    totalCurrentLiabilities: yw(d.totalCurrentLiabilities),
    totalStockholderEquity: yw(d.totalStockholdersEquity),
  }));
  addToDate(cashflow, d => ({
    totalCashFromOperatingActivities: yw(d.operatingCashFlow),
    capitalExpenditures: yw(d.capitalExpenditure),
    freeCashFlow: yw(d.freeCashFlow),
    stockBasedCompensation: yw(d.stockBasedCompensation),
    dividendsPaid: yw(d.dividendsPaid),
  }));
  return Object.entries(dateMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, d]) => ({
      endDate: { raw: Math.floor(new Date(date).getTime() / 1000), fmt: date },
      ...d,
    }));
}

// ── Convertisseurs FMP → Yahoo format ──
function yw(v) { return v != null ? { raw: v } : undefined; }

function fmpToYahooBalance(arr) {
  if (!arr?.length) return [];
  return arr.map(d => ({
    endDate: { raw: d.date ? Math.floor(new Date(d.date).getTime() / 1000) : 0 },
    totalAssets: yw(d.totalAssets),
    totalCurrentAssets: yw(d.totalCurrentAssets),
    cash: yw(d.cashAndCashEquivalents),
    shortTermInvestments: yw(d.shortTermInvestments),
    netReceivables: yw(d.netReceivables),
    inventory: yw(d.inventory),
    otherCurrentAssets: yw(d.otherCurrentAssets),
    propertyPlantEquipment: yw(d.propertyPlantEquipmentNet),
    goodWill: yw(d.goodwill),
    intangibleAssets: yw(d.intangibleAssets),
    longTermInvestments: yw(d.longTermInvestments),
    otherAssets: yw(d.otherNonCurrentAssets),
    totalLiab: yw(d.totalLiabilities),
    totalCurrentLiabilities: yw(d.totalCurrentLiabilities),
    accountsPayable: yw(d.accountPayables),
    shortLongTermDebt: yw(d.shortTermDebt),
    otherCurrentLiab: yw(d.otherCurrentLiabilities),
    longTermDebt: yw(d.longTermDebt),
    otherLiab: yw(d.otherNonCurrentLiabilities),
    totalStockholderEquity: yw(d.totalStockholdersEquity),
    commonStock: yw(d.commonStock),
    retainedEarnings: yw(d.retainedEarnings),
    treasuryStock: yw(d.treasuryStock),
    capitalSurplus: yw(d.additionalPaidInCapital),
    otherStockholderEquity: yw(d.accumulatedOtherComprehensiveIncomeLoss),
    netTangibleAssets: yw(d.totalStockholdersEquity != null && d.goodwill != null && d.intangibleAssets != null
      ? d.totalStockholdersEquity - d.goodwill - d.intangibleAssets : null),
  }));
}

function fmpToYahooIncome(arr) {
  if (!arr?.length) return [];
  return arr.map(d => ({
    endDate: { raw: d.date ? Math.floor(new Date(d.date).getTime() / 1000) : 0 },
    totalRevenue: yw(d.revenue),
    costOfRevenue: yw(d.costOfRevenue),
    grossProfit: yw(d.grossProfit),
    researchDevelopment: yw(d.researchAndDevelopmentExpenses),
    sellingGeneralAdministrative: yw(d.sellingGeneralAndAdministrativeExpenses),
    otherOperatingExpenses: yw(d.otherExpenses),
    totalOperatingExpenses: yw(d.operatingExpenses),
    operatingIncome: yw(d.operatingIncome),
    ebit: yw(d.operatingIncome),
    interestExpense: yw(d.interestExpense ? -Math.abs(d.interestExpense) : null),
    totalOtherIncomeExpenseNet: yw(d.totalOtherIncomeExpensesNet),
    incomeBeforeTax: yw(d.incomeBeforeTax),
    incomeTaxExpense: yw(d.incomeTaxExpense),
    netIncomeFromContinuingOps: yw(d.netIncome),
    discontinuedOperations: undefined,
    extraordinaryItems: undefined,
    netIncome: yw(d.netIncome),
    netIncomeApplicableToCommonShares: yw(d.netIncome),
  }));
}

function fmpToYahooCashflow(arr) {
  if (!arr?.length) return [];
  return arr.map(d => ({
    endDate: { raw: d.date ? Math.floor(new Date(d.date).getTime() / 1000) : 0 },
    totalCashFromOperatingActivities: yw(d.operatingCashFlow),
    depreciation: yw(d.depreciationAndAmortization),
    changeToAccountReceivables: yw(d.accountsReceivables ? -d.accountsReceivables : null),
    changeToInventory: yw(d.inventory ? -d.inventory : null),
    changeToLiabilities: yw(d.accountsPayables),
    changeToOperatingActivities: yw(d.changeInWorkingCapital),
    otherCashflowsFromOperatingActivities: yw(d.otherNonCashItems),
    totalCashFromInvestingActivities: yw(d.netCashUsedForInvestingActivites),
    capitalExpenditures: yw(d.capitalExpenditure),
    otherCashflowsFromInvestingActivities: yw(d.otherInvestingActivites),
    totalCashFromFinancingActivities: yw(d.netCashUsedProvidedByFinancingActivities),
    netBorrowings: yw(d.debtRepayment),
    issuanceOfStock: yw(d.commonStockIssued),
    repurchaseOfStock: yw(d.commonStockRepurchased),
    dividendsPaid: yw(d.dividendsPaid),
    otherCashflowsFromFinancingActivities: yw(d.otherFinancingActivites),
    freeCashFlow: yw(d.freeCashFlow),
    changeInCash: yw(d.netChangeInCash),
  }));
}

// ── Extend FMP data with older Yahoo Timeseries years ──
// Yahoo Timeseries often provides 10-20 years of history for free,
// while FMP free plan only returns 5 years. This function converts
// Yahoo's older years to FMP format and appends them.
function extendFmpWithYahoo(fmpData, yahooResult) {
  if (!fmpData || !yahooResult) return fmpData;

  // Collect all years already present in FMP data
  const fmpYears = new Set();
  for (const arr of [fmpData.income, fmpData.balance, fmpData.cashflow]) {
    for (const d of (arr || [])) {
      const year = d.calendarYear || d.date?.substring(0, 4);
      if (year) fmpYears.add(year);
    }
  }

  const yahooBsCount = (yahooResult.balanceSheetHistory?.balanceSheetStatements || []).length;
  const yahooIsCount = (yahooResult.incomeStatementHistory?.incomeStatementHistory || []).length;
  const yahooCfCount = (yahooResult.cashflowStatementHistory?.cashflowStatements || []).length;
  console.log(`[FF] extendFmpWithYahoo: FMP years: [${[...fmpYears].sort().join(",")}], Yahoo BS: ${yahooBsCount}, IS: ${yahooIsCount}, CF: ${yahooCfCount}`);

  const r = (obj) => obj?.raw; // extract raw value from Yahoo {raw} format

  // Convert Yahoo balance sheet entries not already in FMP
  const yahooBs = yahooResult.balanceSheetHistory?.balanceSheetStatements || [];
  const extraBalance = yahooBs
    .filter(s => {
      const year = s.endDate?.fmt?.substring(0, 4);
      return year && !fmpYears.has(year) && s.totalAssets?.raw != null;
    })
    .map(s => ({
      date: s.endDate?.fmt,
      calendarYear: s.endDate?.fmt?.substring(0, 4),
      totalAssets: r(s.totalAssets),
      totalCurrentAssets: r(s.totalCurrentAssets),
      cashAndCashEquivalents: r(s.cash),
      shortTermInvestments: r(s.shortTermInvestments),
      cashAndShortTermInvestments: ((r(s.cash) || 0) + (r(s.shortTermInvestments) || 0)) || null,
      netReceivables: r(s.netReceivables),
      inventory: r(s.inventory),
      otherCurrentAssets: r(s.otherCurrentAssets),
      propertyPlantEquipmentNet: r(s.propertyPlantEquipment),
      goodwill: r(s.goodWill),
      totalNonCurrentAssets: r(s.totalNonCurrentAssets),
      totalLiabilities: r(s.totalLiab),
      totalCurrentLiabilities: r(s.totalCurrentLiabilities),
      shortTermDebt: r(s.shortLongTermDebt),
      accountPayables: r(s.accountsPayable),
      totalNonCurrentLiabilities: r(s.nonCurrentLiabilities),
      longTermDebt: r(s.longTermDebt),
      totalDebt: r(s.totalDebt),
      totalStockholdersEquity: r(s.totalStockholderEquity),
      retainedEarnings: r(s.retainedEarnings),
      commonStock: r(s.commonStock),
      minorityInterest: r(s.minorityInterest),
      _source: "yahoo",
    }));

  // Convert Yahoo income statement entries
  const yahooIs = yahooResult.incomeStatementHistory?.incomeStatementHistory || [];
  const extraIncome = yahooIs
    .filter(s => {
      const year = s.endDate?.fmt?.substring(0, 4);
      return year && !fmpYears.has(year) && s.totalRevenue?.raw != null;
    })
    .map(s => {
      const rev = r(s.totalRevenue);
      const gp = r(s.grossProfit);
      const oi = r(s.operatingIncome);
      const ni = r(s.netIncome);
      const ebitda = r(s.ebitda);
      return {
        date: s.endDate?.fmt,
        calendarYear: s.endDate?.fmt?.substring(0, 4),
        revenue: rev,
        costOfRevenue: r(s.costOfRevenue),
        grossProfit: gp,
        researchAndDevelopmentExpenses: r(s.researchDevelopment),
        sellingGeneralAndAdministrativeExpenses: r(s.sellingGeneralAdministrative),
        operatingExpenses: r(s.totalOperatingExpenses),
        operatingIncome: oi,
        interestExpense: r(s.interestExpense),
        incomeBeforeTax: r(s.incomeBeforeTax),
        incomeTaxExpense: r(s.incomeTaxExpense),
        netIncome: ni,
        ebitda: ebitda,
        epsdiluted: r(s.dilutedEPS),
        eps: r(s.basicEPS),
        weightedAverageShsOutDil: r(s.dilutedAverageShares),
        // Compute margin ratios
        grossProfitRatio: rev && gp ? gp / rev : null,
        operatingIncomeRatio: rev && oi ? oi / rev : null,
        netIncomeRatio: rev && ni ? ni / rev : null,
        ebitdaratio: rev && ebitda ? ebitda / rev : null,
        _source: "yahoo",
      };
    });

  // Convert Yahoo cashflow entries
  const yahooCf = yahooResult.cashflowStatementHistory?.cashflowStatements || [];
  const extraCashflow = yahooCf
    .filter(s => {
      const year = s.endDate?.fmt?.substring(0, 4);
      return year && !fmpYears.has(year) && (s.totalCashFromOperatingActivities?.raw != null || s.freeCashFlow?.raw != null);
    })
    .map(s => ({
      date: s.endDate?.fmt,
      calendarYear: s.endDate?.fmt?.substring(0, 4),
      operatingCashFlow: r(s.totalCashFromOperatingActivities),
      capitalExpenditure: r(s.capitalExpenditures),
      freeCashFlow: r(s.freeCashFlow),
      netCashUsedForInvestingActivites: r(s.totalCashflowsFromInvestingActivities),
      netCashUsedProvidedByFinancingActivities: r(s.totalCashFromFinancingActivities),
      commonStockRepurchased: r(s.repurchaseOfStock),
      dividendsPaid: r(s.dividendsPaid),
      netChangeInCash: r(s.changeInCash),
      stockBasedCompensation: r(s.stockBasedCompensation),
      depreciationAndAmortization: r(s.depreciation),
      _source: "yahoo",
    }));

  // Merge and sort (newest first)
  const sortDesc = (a, b) => (b.date || "").localeCompare(a.date || "");
  if (extraBalance.length > 0) {
    fmpData.balance = [...(fmpData.balance || []), ...extraBalance].sort(sortDesc);
  }
  if (extraIncome.length > 0) {
    fmpData.income = [...(fmpData.income || []), ...extraIncome].sort(sortDesc);
  }
  if (extraCashflow.length > 0) {
    fmpData.cashflow = [...(fmpData.cashflow || []), ...extraCashflow].sort(sortDesc);
  }

  const totalYears = Math.max(fmpData.income?.length || 0, fmpData.balance?.length || 0, fmpData.cashflow?.length || 0);
  const extraYears = Math.max(extraBalance.length, extraIncome.length, extraCashflow.length);
  console.log(`[FF] extendFmpWithYahoo result: +${extraBalance.length} BS, +${extraIncome.length} IS, +${extraCashflow.length} CF → ${totalYears} total years (FMP had [${[...fmpYears].sort().join(",")}])`);

  return fmpData;
}

// Convert Yahoo data entirely to FMP format (when FMP key missing or FMP fails)
function yahooToFmpData(yahooResult) {
  if (!yahooResult) return null;
  const fmpData = { income: [], balance: [], cashflow: [], ratios: [], keyMetrics: [] };
  return extendFmpWithYahoo(fmpData, yahooResult);
}

// ── Cache sessionStorage (15 min TTL, versionné) ──
const CACHE_TTL = 15 * 60 * 1000;
const CACHE_VERSION = 5; // Incrémenter pour invalider le cache après un fix

function getCachedData(sym) {
  try {
    const raw = sessionStorage.getItem(`ff_${sym}`);
    if (!raw) return null;
    const { data, ts, v } = JSON.parse(raw);
    if (v !== CACHE_VERSION || Date.now() - ts > CACHE_TTL) {
      sessionStorage.removeItem(`ff_${sym}`);
      return null;
    }
    console.log(`[FF] Cache hit for ${sym} (${Math.round((Date.now() - ts) / 1000)}s ago)`);
    return { data, fetchedAt: ts };
  } catch {
    return null;
  }
}

function setCachedData(sym, data) {
  try {
    sessionStorage.setItem(`ff_${sym}`, JSON.stringify({ data, ts: Date.now(), v: CACHE_VERSION }));
  } catch {
    // sessionStorage full — clear old entries
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key?.startsWith("ff_")) sessionStorage.removeItem(key);
      }
      sessionStorage.setItem(`ff_${sym}`, JSON.stringify({ data, ts: Date.now(), v: CACHE_VERSION }));
    } catch { /* ignore */ }
  }
}

// ── Rate limiter (max 3 recherches / 5s côté client) ──
const searchTimestamps = [];
const RATE_LIMIT_WINDOW = 5000;
const RATE_LIMIT_MAX = 3;

function checkRateLimit() {
  const now = Date.now();
  // Purge les entrées hors fenêtre
  while (searchTimestamps.length && now - searchTimestamps[0] > RATE_LIMIT_WINDOW) {
    searchTimestamps.shift();
  }
  if (searchTimestamps.length >= RATE_LIMIT_MAX) {
    const waitSec = Math.ceil((RATE_LIMIT_WINDOW - (now - searchTimestamps[0])) / 1000);
    throw new Error(`Trop de recherches. Patientez ${waitSec}s avant de réessayer.`);
  }
  searchTimestamps.push(now);
}

// ── Détection réseau ──
function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function classifyError(e) {
  if (isOffline()) return "Vous êtes hors ligne. Vérifiez votre connexion Internet.";
  const msg = e?.message || "";
  if (msg.includes("timeout") || msg.includes("Timeout") || msg.includes("AbortError"))
    return "Le serveur met trop de temps à répondre. Réessayez dans un instant.";
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Network request failed"))
    return "Erreur réseau — impossible de joindre les serveurs. Vérifiez votre connexion.";
  if (msg.includes("Impossible de contacter"))
    return "Tous les proxies CORS sont indisponibles. Réessayez dans quelques minutes.";
  if (msg.includes("Rate limit") || msg.includes("429"))
    return "Trop de requêtes envoyées au serveur. Patientez 1 minute avant de réessayer.";
  return msg || "Erreur inconnue.";
}

// ── Données complètes (v10/quoteSummary via Worker, sinon fallback chart) ──
export async function fetchStockData(sym) {
  console.log("[FF] fetchStockData:", sym);

  // Check cache first
  const cached = getCachedData(sym);
  if (cached) return cached;

  // Vérification hors-ligne immédiate
  if (isOffline()) throw new Error("Vous êtes hors ligne. Vérifiez votre connexion Internet.");

  // Rate limiting côté client
  checkRateLimit();

  // Essai 1 : quoteSummary via Worker (qui gère le crumb)
  let yahooResult = null;
  if (WORKER_URL) {
    try {
      const modules = "price,financialData,defaultKeyStatistics,balanceSheetHistory,incomeStatementHistory,cashflowStatementHistory,summaryDetail,assetProfile,earningsTrend,recommendationTrend,calendarEvents";
      const url = `${YF}/v10/finance/quoteSummary/${sym}?modules=${modules}`;
      const json = await tryFetch(`${WORKER_URL}?url=${encodeURIComponent(url)}`);
      yahooResult = json.quoteSummary?.result?.[0];
      if (yahooResult) {
        const bsCount = (yahooResult.balanceSheetHistory?.balanceSheetStatements || []).length;
        const isCount = (yahooResult.incomeStatementHistory?.incomeStatementHistory || []).length;
        const cfCount = (yahooResult.cashflowStatementHistory?.cashflowStatements || []).length;
        // Check if quoteSummary actually has financial values (not just endDate)
        const qsIs0 = (yahooResult.incomeStatementHistory?.incomeStatementHistory || [])[0];
        const qsHasValues = qsIs0?.totalRevenue?.raw != null;
        console.log("[FF] quoteSummary OK via Worker — modules:", Object.keys(yahooResult).join(","),
          "bs:", bsCount, "is:", isCount, "cf:", cfCount,
          "hasValues:", qsHasValues, "revenue[0]:", qsIs0?.totalRevenue?.raw);

        // Always fetch timeseries for full 10+ years of history
        // (quoteSummary only returns ~4 years)
        console.log("[FF] Fetch timeseries pour historique complet (10+ ans)…");
        const ts = await fetchYahooTimeseries(sym).catch(e => {
          console.warn("[FF] timeseries échoué:", e.message);
          return null;
        });
        if (ts) {
          // Merge timeseries (old history) with quoteSummary (recent years)
          // Deep merge: keep non-null values from both sources
          const mergeByDate = (tsArr, qsArr) => {
            const dateMap = new Map();
            const getKey = (s) => s.endDate?.fmt || (s.endDate?.raw ? new Date(s.endDate.raw * 1000).toISOString().slice(0, 10) : null);

            // Add quoteSummary entries first (may have empty values but correct endDate)
            for (const s of (qsArr || [])) {
              const key = getKey(s);
              if (key) dateMap.set(key, { ...s });
            }
            // Deep-merge timeseries: fill in missing values (timeseries has the actual financial data)
            for (const s of (tsArr || [])) {
              const key = getKey(s);
              if (!key) continue;
              const existing = dateMap.get(key);
              if (!existing) {
                dateMap.set(key, { ...s });
              } else {
                // Merge field by field: prefer non-null values
                for (const [k, v] of Object.entries(s)) {
                  if (k === "endDate") continue;
                  if (v != null && (v.raw != null || typeof v !== "object")) {
                    // Only override if existing value is null/undefined
                    if (existing[k] == null || existing[k].raw == null) {
                      existing[k] = v;
                    }
                  }
                }
              }
            }
            return [...dateMap.values()].sort((a, b) => (b.endDate?.raw || 0) - (a.endDate?.raw || 0));
          };

          if (ts.balanceSheetStatements?.length > 0 && ts.balanceSheetStatements.some(s => s.totalAssets?.raw != null)) {
            const existing = yahooResult.balanceSheetHistory?.balanceSheetStatements || [];
            yahooResult.balanceSheetHistory = { balanceSheetStatements: mergeByDate(ts.balanceSheetStatements, existing) };
          }
          if (ts.incomeStatements?.length > 0 && ts.incomeStatements.some(s => s.totalRevenue?.raw != null)) {
            const existing = yahooResult.incomeStatementHistory?.incomeStatementHistory || [];
            yahooResult.incomeStatementHistory = { incomeStatementHistory: mergeByDate(ts.incomeStatements, existing) };
          }
          if (ts.cashflowStatements?.length > 0) {
            const existing = yahooResult.cashflowStatementHistory?.cashflowStatements || [];
            yahooResult.cashflowStatementHistory = { cashflowStatements: mergeByDate(ts.cashflowStatements, existing) };
          }
          // Enrich financialData from timeseries if needed
          const fd = yahooResult.financialData || {};
          const is0 = ts.incomeStatements?.[0];
          const bs0 = ts.balanceSheetStatements?.[0];
          const cf0 = ts.cashflowStatements?.[0];
          if (!fd.totalRevenue?.raw && is0?.totalRevenue?.raw) fd.totalRevenue = is0.totalRevenue;
          if (!fd.ebitda?.raw && is0?.ebitda?.raw) fd.ebitda = is0.ebitda;
          if (!fd.totalCash?.raw && bs0?.cash?.raw) fd.totalCash = bs0.cash;
          if (!fd.totalDebt?.raw && bs0?.totalDebt?.raw) fd.totalDebt = bs0.totalDebt;
          if (!fd.freeCashflow?.raw && cf0?.freeCashFlow?.raw) fd.freeCashflow = cf0.freeCashFlow;
          if (!fd.operatingCashflow?.raw && cf0?.totalCashFromOperatingActivities?.raw) fd.operatingCashflow = cf0.totalCashFromOperatingActivities;
          const bsN = (yahooResult.balanceSheetHistory?.balanceSheetStatements || []).length;
          const isN = (yahooResult.incomeStatementHistory?.incomeStatementHistory || []).length;
          console.log(`[FF] timeseries enrichissement OK — ${bsN} ans bilan, ${isN} ans résultats`);

          // Store quarterly data if available
          if (ts.quarterlyData?.length > 0) {
            yahooResult._quarterlyData = ts.quarterlyData;
            console.log(`[FF] quarterly data stored: ${ts.quarterlyData.length} quarters`);
          }

          // Also fetch FMP for charts + quarterly fallback if key available
          if (hasFmpApiKey()) {
            try {
              const [fins, qFins] = await Promise.all([
                fetchAllFinancials(sym).catch(() => null),
                // FMP quarterly fallback if Yahoo quarterly data is missing
                (!yahooResult._quarterlyData || yahooResult._quarterlyData.length === 0)
                  ? fetchAllQuarterlyFinancials(sym).catch(() => null)
                  : Promise.resolve(null),
              ]);
              if (fins?.income?.length > 0 || fins?.balance?.length > 0) {
                // Extend FMP with older Yahoo Timeseries years for deeper history
                extendFmpWithYahoo(fins, yahooResult);
                yahooResult._fmpData = fins;
                console.log("[FF] FMP charts data OK —", fins.income?.length || 0, "ans (extended with Yahoo)");
              } else {
                // FMP returned nothing usable — build _fmpData entirely from Yahoo
                const converted = yahooToFmpData(yahooResult);
                if (converted && (converted.income?.length > 0 || converted.balance?.length > 0)) {
                  yahooResult._fmpData = converted;
                  console.log("[FF] FMP vide, _fmpData construit depuis Yahoo:", converted.income?.length || 0, "ans");
                }
              }
              // Build quarterly data from FMP if Yahoo didn't provide it
              if (qFins && !yahooResult._quarterlyData?.length) {
                const fmpQuarterly = buildFmpQuarterlyData(qFins);
                if (fmpQuarterly.length > 0) {
                  yahooResult._quarterlyData = fmpQuarterly;
                  console.log(`[FF] FMP quarterly fallback: ${fmpQuarterly.length} quarters`);
                }
              }
            } catch (e) {
              console.warn("[FF] FMP charts fetch échoué:", e.message);
            }
          } else {
            // No FMP key — build _fmpData from Yahoo Timeseries for rich table display
            const converted = yahooToFmpData(yahooResult);
            if (converted && (converted.income?.length > 0 || converted.balance?.length > 0)) {
              yahooResult._fmpData = converted;
              console.log("[FF] Pas de clé FMP, _fmpData construit depuis Yahoo:", converted.income?.length || 0, "ans");
            }
          }
        } else {

          // Try FMP as last resort if timeseries also failed AND FMP key available
          const stillNoBs = !(yahooResult.balanceSheetHistory?.balanceSheetStatements || []).some(s => s.totalAssets?.raw != null);
          if (stillNoBs && hasFmpApiKey()) {
            console.log("[FF] timeseries insuffisant, tentative FMP…");
            try {
              const [prof, fins] = await Promise.all([
                fetchProfile(sym).catch(() => null),
                fetchAllFinancials(sym).catch(() => null),
              ]);
              const fp = Array.isArray(prof) ? prof[0] : prof;
              if (fins?.balance?.length > 0) {
                yahooResult.balanceSheetHistory = { balanceSheetStatements: fmpToYahooBalance(fins.balance) };
              }
              if (fins?.income?.length > 0) {
                yahooResult.incomeStatementHistory = { incomeStatementHistory: fmpToYahooIncome(fins.income) };
              }
              if (fins?.cashflow?.length > 0) {
                yahooResult.cashflowStatementHistory = { cashflowStatements: fmpToYahooCashflow(fins.cashflow) };
              }
              if (fins?.balance?.length > 0 || fins?.income?.length > 0) {
                yahooResult._fmpData = fins;
                console.log("[FF] FMP enrichissement OK");
              }
            } catch (e) {
              console.warn("[FF] FMP échoué:", e.message);
            }
          }
        }
        // Always return Yahoo result (enriched or not)
        setCachedData(sym, yahooResult);
        return { data: yahooResult, fetchedAt: Date.now() };
      }
    } catch (e) {
      console.warn("[FF] quoteSummary via Worker échoué:", e.message);
    }
  }

  // Essai 2 : construire les données depuis /v8/finance/chart (pas besoin de crumb)
  console.log("[FF] Fallback: extraction depuis chart data");
  const json = await yfFetch(`/v8/finance/chart/${sym}?interval=1d&range=1y&includePrePost=false`);
  const result = json.chart?.result?.[0];
  if (!result) throw new Error("Symbole introuvable — essayez : AAPL, MC.PA, TSLA…");

  const meta = result.meta || {};
  const q = result.indicators.quote[0];
  const closes = (q.close || []).filter(v => v != null);
  const currentPrice = meta.regularMarketPrice || closes[closes.length - 1] || 0;
  const prevClose = meta.chartPreviousClose || meta.previousClose || closes[closes.length - 2] || currentPrice;
  const change = currentPrice - prevClose;
  const changePct = prevClose ? (change / prevClose) * 100 : 0;

  // Calculer les stats depuis les données chart
  const highs = (q.high || []).filter(v => v != null);
  const lows = (q.low || []).filter(v => v != null);
  const volumes = (q.volume || []).filter(v => v != null);
  const avgVolume = volumes.length ? Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length) : 0;
  const high52 = highs.length ? Math.max(...highs) : currentPrice;
  const low52 = lows.length ? Math.min(...lows) : currentPrice;

  // Helper: wrap raw value for Yahoo-compatible format
  const w = (v) => v != null && v !== 0 ? { raw: v } : undefined;

  // Essai 3 : enrichir avec FMP si clé disponible
  let fmpProfile = null, fmpFinancials = null;
  if (hasFmpApiKey()) {
    try {
      const [prof, fins] = await Promise.all([
        fetchProfile(sym).catch(() => null),
        fetchAllFinancials(sym).catch(() => null),
      ]);
      fmpProfile = Array.isArray(prof) ? prof[0] : prof;
      fmpFinancials = fins;
      console.log("[FF] FMP enrichissement OK");
    } catch (e) {
      console.warn("[FF] FMP enrichissement échoué:", e.message);
    }
  }

  // Extraire les données FMP les plus récentes
  const inc = fmpFinancials?.income?.[0];
  const inc1 = fmpFinancials?.income?.[1]; // year-1 for growth
  const bal = fmpFinancials?.balance?.[0];
  const cf = fmpFinancials?.cashflow?.[0];
  const rat = fmpFinancials?.ratios?.[0];
  const km = fmpFinancials?.keyMetrics?.[0];
  const fp = fmpProfile;

  // Calculs dérivés
  const mktCap = fp?.mktCap || (inc?.weightedAverageShsOutDil ? currentPrice * inc.weightedAverageShsOutDil : null);
  const evVal = mktCap && bal ? mktCap + (bal.totalDebt || 0) - (bal.cashAndCashEquivalents || 0) : fp?.mktCap;
  const revGrowth = inc && inc1 && inc1.revenue ? (inc.revenue - inc1.revenue) / Math.abs(inc1.revenue) : null;
  const epsVal = inc?.epsdiluted;
  const peRatio = epsVal && currentPrice ? currentPrice / epsVal : null;
  const pbRatio = rat?.priceToBookRatio || (bal?.totalStockholdersEquity && inc?.weightedAverageShsOutDil ? currentPrice / (bal.totalStockholdersEquity / inc.weightedAverageShsOutDil) : null);
  const evToEbitda = inc?.ebitda && evVal ? evVal / inc.ebitda : null;
  const evToRevenue = inc?.revenue && evVal ? evVal / inc.revenue : null;

  // Retourner un objet compatible avec la structure attendue par les composants
  const chartResult = {
    price: {
      regularMarketPrice: { raw: currentPrice, fmt: currentPrice.toFixed(2) },
      regularMarketChange: { raw: change, fmt: change.toFixed(2) },
      regularMarketChangePercent: { raw: changePct / 100, fmt: `${changePct.toFixed(2)}%` },
      regularMarketVolume: { raw: volumes[volumes.length - 1] || 0, fmt: (volumes[volumes.length - 1] || 0).toLocaleString() },
      regularMarketPreviousClose: { raw: prevClose, fmt: prevClose.toFixed(2) },
      regularMarketOpen: { raw: (q.open || [])[closes.length - 1] || currentPrice, fmt: ((q.open || [])[closes.length - 1] || currentPrice).toFixed(2) },
      regularMarketDayHigh: { raw: (q.high || [])[closes.length - 1] || currentPrice, fmt: ((q.high || [])[closes.length - 1] || currentPrice).toFixed(2) },
      regularMarketDayLow: { raw: (q.low || [])[closes.length - 1] || currentPrice, fmt: ((q.low || [])[closes.length - 1] || currentPrice).toFixed(2) },
      shortName: fp?.companyName || meta.shortName || sym,
      longName: fp?.companyName || meta.longName || meta.shortName || sym,
      symbol: meta.symbol || sym,
      currency: fp?.currency || meta.currency || "USD",
      exchangeName: fp?.exchangeShortName || meta.exchangeName || meta.fullExchangeName || "",
      marketCap: w(mktCap),
    },
    summaryDetail: {
      fiftyTwoWeekHigh: { raw: high52, fmt: high52.toFixed(2) },
      fiftyTwoWeekLow: { raw: low52, fmt: low52.toFixed(2) },
      averageVolume: { raw: avgVolume, fmt: avgVolume.toLocaleString() },
      marketCap: w(mktCap),
      dividendYield: w(rat?.dividendYield || fp?.lastDiv && currentPrice ? fp.lastDiv / currentPrice : null),
      dividendRate: w(fp?.lastDiv || km?.dividendPerShare),
      trailingPE: w(peRatio),
      payoutRatio: w(rat?.payoutRatio),
      exDividendDate: undefined,
    },
    defaultKeyStatistics: {
      enterpriseValue: w(evVal),
      forwardPE: undefined,
      trailingPE: w(peRatio),
      trailingEps: w(epsVal),
      priceToBook: w(pbRatio),
      priceToSalesTrailing12Months: w(inc?.revenue && mktCap ? mktCap / inc.revenue : null),
      pegRatio: w(rat?.priceEarningsToGrowthRatio),
      enterpriseToRevenue: w(evToRevenue),
      enterpriseToEbitda: w(evToEbitda),
      beta: w(fp?.beta),
      bookValue: w(bal?.totalStockholdersEquity && inc?.weightedAverageShsOutDil ? bal.totalStockholdersEquity / inc.weightedAverageShsOutDil : null),
      sharesOutstanding: w(inc?.weightedAverageShsOutDil || fp?.volAvg),
      floatShares: undefined,
      heldPercentInsiders: undefined,
      heldPercentInstitutions: undefined,
      shortRatio: undefined,
      sharesShort: undefined,
    },
    financialData: {
      currentPrice: { raw: currentPrice, fmt: currentPrice.toFixed(2) },
      totalRevenue: w(inc?.revenue),
      revenueGrowth: w(revGrowth),
      revenuePerShare: w(inc?.revenue && inc?.weightedAverageShsOutDil ? inc.revenue / inc.weightedAverageShsOutDil : null),
      grossMargins: w(inc?.grossProfitRatio),
      grossProfits: w(inc?.grossProfit),
      operatingMargins: w(inc?.operatingIncomeRatio),
      ebitdaMargins: w(inc?.ebitdaratio),
      profitMargins: w(inc?.netIncomeRatio),
      ebitda: w(inc?.ebitda),
      returnOnEquity: w(rat?.returnOnEquity),
      returnOnAssets: w(rat?.returnOnAssets),
      debtToEquity: w(rat?.debtEquityRatio ? rat.debtEquityRatio * 100 : null),
      currentRatio: w(rat?.currentRatio),
      quickRatio: w(rat?.quickRatio),
      totalCash: w(bal?.cashAndCashEquivalents),
      totalCashPerShare: w(bal?.cashAndCashEquivalents && inc?.weightedAverageShsOutDil ? bal.cashAndCashEquivalents / inc.weightedAverageShsOutDil : null),
      totalDebt: w(bal?.totalDebt),
      freeCashflow: w(cf?.freeCashFlow),
      operatingCashflow: w(cf?.operatingCashFlow),
    },
    balanceSheetHistory: { balanceSheetStatements: fmpToYahooBalance(fmpFinancials?.balance) },
    incomeStatementHistory: { incomeStatementHistory: fmpToYahooIncome(fmpFinancials?.income) },
    cashflowStatementHistory: { cashflowStatements: fmpToYahooCashflow(fmpFinancials?.cashflow) },
    _fmpData: fmpFinancials,
    assetProfile: {
      sector: fp?.sector || "N/A",
      industry: fp?.industry || "N/A",
      longBusinessSummary: fp?.description || "",
      country: fp?.country || "",
      website: fp?.website || "",
      fullTimeEmployees: fp?.fullTimeEmployees || null,
    },
    _fromChart: true,
  };

  // Fetch FMP quarterly data for chart fallback path
  if (hasFmpApiKey()) {
    try {
      const qFins = await fetchAllQuarterlyFinancials(sym).catch(() => null);
      if (qFins) {
        const fmpQuarterly = buildFmpQuarterlyData(qFins);
        if (fmpQuarterly.length > 0) {
          chartResult._quarterlyData = fmpQuarterly;
          console.log(`[FF] FMP quarterly data (chart fallback): ${fmpQuarterly.length} quarters`);
        }
      }
    } catch (e) {
      console.warn("[FF] FMP quarterly fetch échoué:", e.message);
    }
  }

  setCachedData(sym, chartResult);
  return { data: chartResult, fetchedAt: Date.now() };
}

// ── Traduction en français via Google Translate (gratuit) ──
export async function translateToFrench(text) {
  if (!text || text.length < 10) return text;
  const truncated = text.length > 1000 ? text.substring(0, 1000) : text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fr&dt=t&q=${encodeURIComponent(truncated)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    // Google renvoie [[["traduction","source",...], ...], ...]
    if (Array.isArray(json) && Array.isArray(json[0])) {
      return json[0].map(seg => seg[0]).join("");
    }
    return truncated;
  } catch {
    return truncated;
  }
}

export async function searchSymbols(query) {
  try {
    const json = await yfFetch(`/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0`);
    return (json.quotes || []).filter(q => q.quoteType === "EQUITY").slice(0, 6);
  } catch (_) {
    return [];
  }
}

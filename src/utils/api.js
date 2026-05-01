import { warn } from "./log";
import { fetchProfile, fetchAllFinancials, fetchAllQuarterlyFinancials } from "./fmpApi";
import { WORKER_URL, YF, FREE_PROXIES, checkWorkerHealth, tryFetch, yfFetch } from "./proxy";
import { getCachedData, setCachedData } from "./cache";

export { checkWorkerHealth } from "./proxy";

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

  // Try both query2 and query1 hostnames for resilience
  const hosts = [YF, YF.replace("query2", "query1")];

  // Quick fetch: try Worker proxy, then 1 CORS fallback, low timeout for timeseries
  const quickFetch = async (url, label) => {
    // Try Worker proxy first
    if (WORKER_URL) {
      try {
        const data = await tryFetch(`${WORKER_URL}?url=${encodeURIComponent(url)}`);
        return data;
      } catch (e) {
        warn(`[FF] timeseries ${label} Worker failed:`, e.message);
      }
    }
    // Try first CORS proxy as fallback (don't try all 5 — too slow)
    try {
      const { url: proxyUrl, unwrap } = FREE_PROXIES[0](url);
      const data = await tryFetch(proxyUrl, unwrap);
      return data;
    } catch (e) {
      warn(`[FF] timeseries ${label} CORS proxy failed:`, e.message);
    }
    return null;
  };

  // Try a batch on both hostnames
  const fetchBatch = async (fields, label) => {
    for (const host of hosts) {
      const url = `${host}/ws/fundamentals-timeseries/v1/finance/timeseries/${sym}?period1=${fortyYearsAgo}&period2=${now}&merge=false&padTimeSeries=false&type=${fields.join(",")}`;
      const result = await quickFetch(url, `${label} (${host.includes("query1") ? "q1" : "q2"})`);
      if (result?.timeseries?.result?.length > 0) return result;
    }
    return null;
  };

  try {
    // Fetch all batches in parallel — each batch tries query2 then query1
    const [json1, json2, json3] = await Promise.all([
      fetchBatch(batch1Fields, "batch1 (IS+CF)"),
      fetchBatch(batch2Fields, "batch2 (BS)"),
      fetchBatch(batch3Fields, "batch3 (quarterly)"),
    ]);

    // Merge results from all batches (annual)
    const allSeries = [
      ...(json1?.timeseries?.result || []),
      ...(json2?.timeseries?.result || []),
    ];

    // Quarterly series (separate)
    const quarterlySeries = json3?.timeseries?.result || [];

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
      }
    }

    return { balanceSheetStatements, incomeStatements, cashflowStatements, quarterlyData };
  } catch (e) {
    warn("[FF] timeseries fetch failed:", e.message);
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

  const r = (obj) => obj?.raw; // extract raw value from Yahoo {raw} format

  // Convert Yahoo balance sheet entries not already in FMP
  const yahooBs = yahooResult.balanceSheetHistory?.balanceSheetStatements || [];
  const extraBalance = yahooBs
    .filter(s => {
      const year = s.endDate?.fmt?.substring(0, 4);
      const hasData = s.totalAssets?.raw != null || s.cash?.raw != null || s.totalLiab?.raw != null
        || s.totalCurrentAssets?.raw != null || s.totalStockholderEquity?.raw != null
        || s.totalDebt?.raw != null || s.longTermDebt?.raw != null || s.netReceivables?.raw != null
        || s.inventory?.raw != null || s.retainedEarnings?.raw != null || s.propertyPlantEquipment?.raw != null;
      if (year && !fmpYears.has(year) && !hasData) {
      }
      return year && !fmpYears.has(year) && hasData;
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
      const hasData = s.totalRevenue?.raw != null || s.netIncome?.raw != null || s.operatingIncome?.raw != null
        || s.grossProfit?.raw != null || s.ebitda?.raw != null || s.costOfRevenue?.raw != null
        || s.incomeBeforeTax?.raw != null || s.dilutedEPS?.raw != null || s.basicEPS?.raw != null;
      if (year && !fmpYears.has(year) && !hasData) {
      }
      return year && !fmpYears.has(year) && hasData;
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
      const hasData = s.totalCashFromOperatingActivities?.raw != null || s.freeCashFlow?.raw != null || s.dividendsPaid?.raw != null
        || s.capitalExpenditures?.raw != null || s.totalCashflowsFromInvestingActivities?.raw != null
        || s.totalCashFromFinancingActivities?.raw != null || s.repurchaseOfStock?.raw != null
        || s.changeInCash?.raw != null || s.stockBasedCompensation?.raw != null;
      if (year && !fmpYears.has(year) && !hasData) {
      }
      return year && !fmpYears.has(year) && hasData;
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

  return fmpData;
}

// Convert Yahoo data entirely to FMP format (when FMP key missing or FMP fails)
function yahooToFmpData(yahooResult) {
  if (!yahooResult) return null;
  const fmpData = { income: [], balance: [], cashflow: [], ratios: [], keyMetrics: [] };
  return extendFmpWithYahoo(fmpData, yahooResult);
}

export function peekCache(sym) {
  return getCachedData(sym);
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

        // Fetch timeseries and FMP in parallel for speed
        const [ts, fmpResult] = await Promise.all([
          fetchYahooTimeseries(sym).catch(e => {
            warn("[FF] timeseries échoué:", e.message);
            return null;
          }),
          fetchAllFinancials(sym).catch(e => {
            warn("[FF] FMP fetch échoué:", e.message);
            return null;
          }),
        ]);

        // Helper: deep merge timeseries with quoteSummary by date
        const mergeByDate = (tsArr, qsArr) => {
          const dateMap = new Map();
          const getKey = (s) => s.endDate?.fmt || (s.endDate?.raw ? new Date(s.endDate.raw * 1000).toISOString().slice(0, 10) : null);
          for (const s of (qsArr || [])) {
            const key = getKey(s);
            if (key) dateMap.set(key, { ...s });
          }
          for (const s of (tsArr || [])) {
            const key = getKey(s);
            if (!key) continue;
            const existing = dateMap.get(key);
            if (!existing) {
              dateMap.set(key, { ...s });
            } else {
              for (const [k, v] of Object.entries(s)) {
                if (k === "endDate") continue;
                if (v != null && (v.raw != null || typeof v !== "object")) {
                  if (existing[k] == null || existing[k].raw == null) {
                    existing[k] = v;
                  }
                }
              }
            }
          }
          return [...dateMap.values()].sort((a, b) => (b.endDate?.raw || 0) - (a.endDate?.raw || 0));
        };

        // Filter ghost entries — check many fields to avoid dropping valid sparse years
        const hasAnyData = (s, ...keys) => keys.some(k => s[k]?.raw != null);
        const BS_KEYS = ["totalAssets", "cash", "totalLiab", "totalCurrentAssets", "totalStockholderEquity", "totalDebt", "longTermDebt", "propertyPlantEquipment", "netReceivables", "inventory", "retainedEarnings", "shortTermInvestments", "totalCurrentLiabilities", "totalNonCurrentAssets", "nonCurrentLiabilities", "minorityInterest"];
        const IS_KEYS = ["totalRevenue", "netIncome", "operatingIncome", "grossProfit", "ebitda", "costOfRevenue", "totalOperatingExpenses", "incomeBeforeTax", "incomeTaxExpense", "dilutedEPS", "basicEPS", "interestExpense", "researchDevelopment"];
        const CF_KEYS = ["totalCashFromOperatingActivities", "freeCashFlow", "dividendsPaid", "capitalExpenditures", "totalCashflowsFromInvestingActivities", "totalCashFromFinancingActivities", "repurchaseOfStock", "changeInCash", "stockBasedCompensation"];

        // Merge timeseries into yahooResult if available
        if (ts) {
          if (ts.balanceSheetStatements?.length > 0 && ts.balanceSheetStatements.some(s => hasAnyData(s, ...BS_KEYS))) {
            const existing = yahooResult.balanceSheetHistory?.balanceSheetStatements || [];
            const merged = mergeByDate(ts.balanceSheetStatements, existing);
            yahooResult.balanceSheetHistory = { balanceSheetStatements: merged.filter(s => hasAnyData(s, ...BS_KEYS)) };
          }
          if (ts.incomeStatements?.length > 0 && ts.incomeStatements.some(s => hasAnyData(s, ...IS_KEYS))) {
            const existing = yahooResult.incomeStatementHistory?.incomeStatementHistory || [];
            const merged = mergeByDate(ts.incomeStatements, existing);
            yahooResult.incomeStatementHistory = { incomeStatementHistory: merged.filter(s => hasAnyData(s, ...IS_KEYS)) };
          }
          if (ts.cashflowStatements?.length > 0) {
            const existing = yahooResult.cashflowStatementHistory?.cashflowStatements || [];
            const merged = mergeByDate(ts.cashflowStatements, existing);
            yahooResult.cashflowStatementHistory = { cashflowStatements: merged.filter(s => hasAnyData(s, ...CF_KEYS)) };
          }
          // Enrich financialData from timeseries
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
          // Store quarterly data
          if (ts.quarterlyData?.length > 0) {
            yahooResult._quarterlyData = ts.quarterlyData;
          }
          const bsN = (yahooResult.balanceSheetHistory?.balanceSheetStatements || []).length;
          const isN = (yahooResult.incomeStatementHistory?.incomeStatementHistory || []).length;
        } else {
          // If no timeseries and no Yahoo BS data, inject FMP data in Yahoo format
          const stillNoBs = !(yahooResult.balanceSheetHistory?.balanceSheetStatements || []).some(s => s.totalAssets?.raw != null);
          if (stillNoBs && fmpResult) {
            if (fmpResult.balance?.length > 0) yahooResult.balanceSheetHistory = { balanceSheetStatements: fmpToYahooBalance(fmpResult.balance) };
            if (fmpResult.income?.length > 0) yahooResult.incomeStatementHistory = { incomeStatementHistory: fmpToYahooIncome(fmpResult.income) };
            if (fmpResult.cashflow?.length > 0) yahooResult.cashflowStatementHistory = { cashflowStatements: fmpToYahooCashflow(fmpResult.cashflow) };
          }
        }

        // Build _fmpData: combine FMP + Yahoo for year coverage
        let baseFmpData = null;
        if (fmpResult?.income?.length > 0 || fmpResult?.balance?.length > 0) {
          extendFmpWithYahoo(fmpResult, yahooResult);
          baseFmpData = fmpResult;
        } else {
          // FMP empty or failed — build _fmpData from Yahoo
          baseFmpData = yahooToFmpData(yahooResult);
        }
        if (baseFmpData && (baseFmpData.income?.length > 0 || baseFmpData.balance?.length > 0)) {
          yahooResult._fmpData = baseFmpData;
        }

        // Quarterly data fallback from FMP if needed
        if (!yahooResult._quarterlyData?.length) {
          try {
            const qFins = await fetchAllQuarterlyFinancials(sym).catch(() => null);
            if (qFins) {
              const fmpQuarterly = buildFmpQuarterlyData(qFins);
              if (fmpQuarterly.length > 0) {
                yahooResult._quarterlyData = fmpQuarterly;
              }
            }
          } catch (_) {}
        }
        // Always return Yahoo result (enriched or not)
        setCachedData(sym, yahooResult);
        return { data: yahooResult, fetchedAt: Date.now() };
      }
    } catch (e) {
      warn("[FF] quoteSummary via Worker échoué:", e.message);
    }
  }

  // Essai 2 : construire les données depuis /v8/finance/chart (pas besoin de crumb)
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

  // Essai 3 : enrichir avec FMP (proxied via Worker)
  let fmpProfile = null, fmpFinancials = null;
  {
    try {
      const [prof, fins] = await Promise.all([
        fetchProfile(sym).catch(() => null),
        fetchAllFinancials(sym).catch(() => null),
      ]);
      fmpProfile = Array.isArray(prof) ? prof[0] : prof;
      fmpFinancials = fins;
    } catch (e) {
      warn("[FF] FMP enrichissement échoué:", e.message);
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
  {
    try {
      const qFins = await fetchAllQuarterlyFinancials(sym).catch(() => null);
      if (qFins) {
        const fmpQuarterly = buildFmpQuarterlyData(qFins);
        if (fmpQuarterly.length > 0) {
          chartResult._quarterlyData = fmpQuarterly;
        }
      }
    } catch (e) {
      warn("[FF] FMP quarterly fetch échoué:", e.message);
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

// ── Batch quotes (lightweight: price + daily change for N symbols) ──
export async function fetchBatchQuotes(symbols) {
  if (!Array.isArray(symbols) || symbols.length === 0) return [];
  const syms = symbols.slice(0, 20).join(",");
  try {
    const json = await yfFetch(`/v7/finance/quote?symbols=${encodeURIComponent(syms)}`);
    return json.quoteResponse?.result || [];
  } catch (_) {
    return [];
  }
}

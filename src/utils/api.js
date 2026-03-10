import { hasFmpApiKey, fetchProfile, fetchAllFinancials } from "./fmpApi";

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

async function tryFetch(url, unwrap = false) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { "Accept": "application/json" },
  });
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
async function fetchYahooTimeseries(sym) {
  const now = Math.floor(Date.now() / 1000);
  const fiveYearsAgo = now - 5 * 365 * 86400;

  // Balance sheet fields
  const bsFields = [
    "annualTotalAssets", "annualTotalCurrentAssets", "annualCashAndCashEquivalents",
    "annualShortTermInvestments", "annualNetReceivables", "annualInventory",
    "annualOtherCurrentAssets", "annualNetPPE", "annualGoodwillAndOtherIntangibleAssets",
    "annualTotalNonCurrentAssets", "annualTotalLiabilitiesNetMinorityInterest",
    "annualCurrentLiabilities", "annualCurrentDebt", "annualAccountsPayable",
    "annualNonCurrentLiabilitiesTotal", "annualLongTermDebt", "annualTotalDebt",
    "annualStockholdersEquity", "annualRetainedEarnings", "annualCommonStock",
    "annualMinorityInterest",
  ];
  // Income statement fields
  const isFields = [
    "annualTotalRevenue", "annualCostOfRevenue", "annualGrossProfit",
    "annualResearchAndDevelopment", "annualSellingGeneralAndAdministration",
    "annualOperatingExpense", "annualOperatingIncome", "annualInterestExpense",
    "annualPretaxIncome", "annualTaxProvision", "annualNetIncome",
    "annualEBITDA", "annualDilutedEPS", "annualBasicEPS",
    "annualDilutedAverageShares",
  ];
  // Cash flow fields
  const cfFields = [
    "annualOperatingCashFlow", "annualCapitalExpenditure", "annualFreeCashFlow",
    "annualInvestingCashFlow", "annualFinancingCashFlow",
    "annualRepurchaseOfCapitalStock", "annualCashDividendsPaid",
    "annualChangeInCashSupplementalAsReported",
  ];

  const allFields = [...bsFields, ...isFields, ...cfFields];
  const url = `${YF}/ws/fundamentals-timeseries/v1/finance/timeseries/${sym}?period1=${fiveYearsAgo}&period2=${now}&type=${allFields.join(",")}&merge=false&padTimeSeries=false`;

  try {
    const json = await proxyFetch(url);
    const series = json.timeseries?.result || [];
    console.log("[FF] timeseries fetched, series count:", series.length);

    // Organize data by date
    const dateMap = {};
    for (const s of series) {
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

    const dates = Object.keys(dateMap).sort().reverse().slice(0, 5);
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
      };
    });

    console.log("[FF] timeseries parsed:", dates.length, "years,",
      "bs sample:", balanceSheetStatements[0]?.totalAssets?.raw,
      "is sample:", incomeStatements[0]?.totalRevenue?.raw);

    return { balanceSheetStatements, incomeStatements, cashflowStatements };
  } catch (e) {
    console.warn("[FF] timeseries fetch failed:", e.message);
    return null;
  }
}

// ── Convertisseurs FMP → Yahoo format ──
function yw(v) { return v != null ? { raw: v } : undefined; }

function fmpToYahooBalance(arr) {
  if (!arr?.length) return [];
  return arr.slice(0, 5).map(d => ({
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
  return arr.slice(0, 5).map(d => ({
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
  return arr.slice(0, 5).map(d => ({
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

// ── Données complètes (v10/quoteSummary via Worker, sinon fallback chart) ──
export async function fetchStockData(sym) {
  console.log("[FF] fetchStockData:", sym);

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
        console.log("[FF] quoteSummary OK via Worker — modules:", Object.keys(yahooResult).join(","),
          "bs:", bsCount, "is:", isCount, "cf:", cfCount);

        // Check if quoteSummary has real data (not just endDate shells)
        const bsHasData = (yahooResult.balanceSheetHistory?.balanceSheetStatements || []).some(s =>
          s.totalAssets?.raw != null
        );
        const isHasData = (yahooResult.incomeStatementHistory?.incomeStatementHistory || []).some(s =>
          s.totalRevenue?.raw != null
        );

        // If quoteSummary returned shells without data, use timeseries API
        if (!bsHasData || !isHasData) {
          console.log("[FF] quoteSummary données vides, tentative timeseries…");
          const ts = await fetchYahooTimeseries(sym);
          if (ts) {
            if (ts.balanceSheetStatements?.length > 0 && ts.balanceSheetStatements[0].totalAssets?.raw != null) {
              yahooResult.balanceSheetHistory = { balanceSheetStatements: ts.balanceSheetStatements };
            }
            if (ts.incomeStatements?.length > 0 && ts.incomeStatements[0].totalRevenue?.raw != null) {
              yahooResult.incomeStatementHistory = { incomeStatementHistory: ts.incomeStatements };
            }
            if (ts.cashflowStatements?.length > 0) {
              yahooResult.cashflowStatementHistory = { cashflowStatements: ts.cashflowStatements };
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
            console.log("[FF] timeseries enrichissement OK");
          }

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
        return yahooResult;
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
  return {
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

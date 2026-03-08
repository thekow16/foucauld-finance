export const fmt = (v, type = "number") => {
  if (v == null || isNaN(v)) return "—";
  if (type === "currency") {
    const abs = Math.abs(v), sign = v < 0 ? "-" : "";
    if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)} T`;
    if (abs >= 1e9)  return `${sign}${(abs / 1e9).toFixed(2)} Md`;
    if (abs >= 1e6)  return `${sign}${(abs / 1e6).toFixed(2)} M`;
    return `${sign}${abs.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}`;
  }
  if (type === "percent") return `${(v * 100).toFixed(2)} %`;
  if (type === "ratio")   return v.toFixed(2);
  return v.toFixed(2);
};

export const PERIODS = [
  { label: "1S",  range: "5d",   interval: "1d"  },
  { label: "1M",  range: "1mo",  interval: "1d"  },
  { label: "3M",  range: "3mo",  interval: "1d"  },
  { label: "6M",  range: "6mo",  interval: "1wk" },
  { label: "1A",  range: "1y",   interval: "1wk" },
  { label: "5A",  range: "5y",   interval: "1mo" },
  { label: "Max", range: "max",  interval: "1mo" },
];

export const SUGGESTIONS = [
  "AAPL","TSLA","MC.PA","TTE.PA","NVDA","MSFT","BNP.PA","AIR.PA","AMZN","GOOGL"
];

// Score de santé basé sur 6 critères fondamentaux (chacun sur ~17 pts)
export const getScoreDetails = (data) => {
  const fin = data?.financialData;
  if (!fin) return null;

  const cfArr = data?.cashflowStatementHistory?.cashflowStatements || [];
  const bsArr = data?.balanceSheetHistory?.balanceSheetStatements || [];
  const incArr = data?.incomeStatementHistory?.incomeStatementHistory || [];

  const details = {};

  // 1) Croissance du CA (revenueGrowth)
  const rg = fin.revenueGrowth?.raw;
  if (rg != null && !isNaN(rg)) {
    details.revenueGrowth = { val: rg, pts: rg > 0.15 ? 17 : rg > 0.08 ? 13 : rg > 0.03 ? 9 : rg > 0 ? 5 : 0 };
  } else {
    details.revenueGrowth = { val: null, pts: 0 };
  }

  // 2) Croissance du FCF (comparaison année N vs N-1)
  const fcf0 = cfArr[0]?.freeCashFlow?.raw ?? fin.freeCashflow?.raw;
  const fcf1 = cfArr[1]?.freeCashFlow?.raw;
  if (fcf0 != null && fcf1 != null && fcf1 !== 0) {
    const fcfGrowth = (fcf0 - fcf1) / Math.abs(fcf1);
    details.fcfGrowth = { val: fcfGrowth, pts: fcfGrowth > 0.15 ? 17 : fcfGrowth > 0.05 ? 13 : fcfGrowth > 0 ? 9 : fcfGrowth > -0.1 ? 4 : 0 };
  } else {
    details.fcfGrowth = { val: null, pts: 0 };
  }

  // 3) ROIC (approximation : Operating Income / (Total Equity + Total Debt - Cash))
  const opIncome = incArr[0]?.operatingIncome?.raw;
  const equity = bsArr[0]?.totalStockholderEquity?.raw;
  const totalDebt = bsArr[0]?.longTermDebt?.raw ?? 0;
  const shortDebt = bsArr[0]?.shortLongTermDebt?.raw ?? 0;
  const cash = bsArr[0]?.cash?.raw ?? 0;
  const investedCapital = (equity ?? 0) + totalDebt + shortDebt - cash;
  if (opIncome != null && investedCapital > 0) {
    const roic = opIncome / investedCapital;
    details.roic = { val: roic, pts: roic > 0.20 ? 17 : roic > 0.12 ? 13 : roic > 0.07 ? 9 : roic > 0 ? 4 : 0 };
  } else {
    // Fallback ROE si pas de données bilan
    const roe = fin.returnOnEquity?.raw;
    if (roe != null) {
      details.roic = { val: roe, pts: roe > 0.20 ? 17 : roe > 0.12 ? 13 : roe > 0.07 ? 9 : roe > 0 ? 4 : 0, fallback: "ROE" };
    } else {
      details.roic = { val: null, pts: 0 };
    }
  }

  // 4) Dette nette / FCF (plus bas = mieux, négatif = pas de dette nette = excellent)
  const debt = fin.totalDebt?.raw ?? (totalDebt + shortDebt);
  const cashTotal = bsArr[0]?.cash?.raw ?? 0;
  const netDebt = debt - cashTotal;
  const fcfCurrent = fin.freeCashflow?.raw ?? fcf0;
  if (fcfCurrent != null && fcfCurrent > 0) {
    const ratio = netDebt / fcfCurrent;
    details.netDebtFcf = { val: ratio, pts: ratio < 0 ? 17 : ratio < 1 ? 14 : ratio < 2 ? 10 : ratio < 3 ? 6 : ratio < 5 ? 3 : 0 };
  } else if (fcfCurrent != null && fcfCurrent <= 0) {
    details.netDebtFcf = { val: null, pts: 0 };
  } else {
    details.netDebtFcf = { val: null, pts: 0 };
  }

  // 5) Actions en circulation (tendance : stable ou baisse = bien)
  const shares0 = incArr[0]?.dilutedShares?.raw ?? (data?.defaultKeyStatistics?.sharesOutstanding?.raw);
  const shares1 = incArr[1]?.dilutedShares?.raw;
  if (shares0 != null && shares1 != null && shares1 !== 0) {
    const sharesChange = (shares0 - shares1) / Math.abs(shares1);
    details.sharesChange = { val: sharesChange, pts: sharesChange < -0.03 ? 16 : sharesChange < -0.005 ? 12 : sharesChange < 0.01 ? 8 : sharesChange < 0.03 ? 4 : 0 };
  } else {
    details.sharesChange = { val: null, pts: 0 };
  }

  // 6) Marge du FCF (FCF / Revenue)
  const revenue = fin.totalRevenue?.raw;
  if (fcfCurrent != null && revenue != null && revenue > 0) {
    const fcfMargin = fcfCurrent / revenue;
    details.fcfMargin = { val: fcfMargin, pts: fcfMargin > 0.25 ? 16 : fcfMargin > 0.15 ? 12 : fcfMargin > 0.08 ? 8 : fcfMargin > 0 ? 4 : 0 };
  } else {
    details.fcfMargin = { val: null, pts: 0 };
  }

  const total = Object.values(details).reduce((sum, d) => sum + d.pts, 0);
  return { details, score: Math.min(100, Math.max(0, Math.round(total))) };
};

export const getScore = (fin, stats, data) => {
  const result = getScoreDetails(data);
  return result ? result.score : null;
};

export const getScoreColor = (score) =>
  score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

export const getScoreLabel = (score) =>
  score >= 70 ? "Excellente" : score >= 55 ? "Bonne" : score >= 40 ? "Correcte" : "Fragile";

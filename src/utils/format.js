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

export const getScore = (fin, stats) => {
  if (!fin || !stats) return null;
  let s = 40;
  const pe = stats.trailingPE?.raw;
  if (pe > 0 && pe < 20) s += 12; else if (pe > 0 && pe < 35) s += 6;
  const pm = fin.profitMargins?.raw;
  if (pm > 0.2) s += 16; else if (pm > 0.1) s += 9; else if (pm > 0) s += 4;
  const de = fin.debtToEquity?.raw;
  if (de != null && de < 50) s += 16; else if (de != null && de < 100) s += 9; else if (de != null && de < 200) s += 4;
  const cr = fin.currentRatio?.raw;
  if (cr > 2) s += 10; else if (cr > 1.5) s += 7; else if (cr > 1) s += 4;
  const rg = fin.revenueGrowth?.raw;
  if (rg > 0.15) s += 6; else if (rg > 0.05) s += 3;
  return Math.min(100, Math.max(0, Math.round(s)));
};

export const getScoreColor = (score) =>
  score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

export const getScoreLabel = (score) =>
  score >= 70 ? "Excellente" : score >= 55 ? "Bonne" : score >= 40 ? "Correcte" : "Fragile";

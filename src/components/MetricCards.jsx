import { fmt } from "../utils/format";

export default function MetricCards({ data }) {
  const pr = data?.price;
  const stats = data?.defaultKeyStatistics;
  const summ = data?.summaryDetail;
  const fin = data?.financialData;

  const metrics = [
    { label: "Capitalisation", val: fmt(pr?.marketCap?.raw, "currency"), color: "#4f46e5" },
    { label: "Valeur d'entreprise", val: fmt(stats?.enterpriseValue?.raw, "currency"), color: "#312e81" },
    { label: "Chiffre d'affaires", val: fmt(fin?.totalRevenue?.raw, "currency"), color: "#0891b2" },
    { label: "EBITDA", val: fmt(fin?.ebitda?.raw, "currency"), color: "#7c3aed" },
    { label: "Resultat net", val: fmt(fin?.netIncomeToCommon?.raw ?? (fin?.profitMargins?.raw != null && fin?.totalRevenue?.raw != null ? fin.profitMargins.raw * fin.totalRevenue.raw : null), "currency"), color: "#10b981" },
    { label: "Free Cash Flow", val: fmt(fin?.freeCashflow?.raw, "currency"), color: "#0d9488" },
    { label: "P/E Ratio", val: fmt(stats?.trailingPE?.raw, "ratio"), color: "#7c3aed" },
    { label: "P/E Forward", val: fmt(stats?.forwardPE?.raw, "ratio"), color: "#6366f1" },
    { label: "P/B Ratio", val: fmt(stats?.priceToBook?.raw, "ratio"), color: "#0891b2" },
    { label: "EV/EBITDA", val: fmt(stats?.enterpriseToEbitda?.raw, "ratio"), color: "#a855f7" },
    { label: "Marge nette", val: fmt(fin?.profitMargins?.raw, "percent"), color: "#16a34a" },
    { label: "ROE", val: fmt(fin?.returnOnEquity?.raw, "percent"), color: "#ea580c" },
    { label: "Dividende", val: summ?.dividendYield?.raw ? fmt(summ.dividendYield.raw, "percent") : "—", color: "#16a34a" },
    { label: "Beta", val: fmt(stats?.beta?.raw, "ratio"), color: "#f59e0b" },
    { label: "52S Haut", val: summ?.fiftyTwoWeekHigh?.raw ? summ.fiftyTwoWeekHigh.raw.toFixed(2) : "—", color: "#e11d48" },
    { label: "52S Bas", val: summ?.fiftyTwoWeekLow?.raw ? summ.fiftyTwoWeekLow.raw.toFixed(2) : "—", color: "#64748b" },
  ];

  return (
    <div className="grid8">
      {metrics.map(m => (
        <div key={m.label} className="metric-card" style={{ borderTopColor: m.color }}>
          <div className="metric-value">{m.val}</div>
          <div className="metric-label">{m.label}</div>
        </div>
      ))}
    </div>
  );
}

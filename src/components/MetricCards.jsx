import { fmt } from "../utils/format";

export default function MetricCards({ data }) {
  const pr = data?.price;
  const stats = data?.defaultKeyStatistics;
  const summ = data?.summaryDetail;
  const fin = data?.financialData;

  const metrics = [
    { label: "Capitalisation", val: fmt(pr?.marketCap?.raw, "currency"), color: "#4f46e5", icon: "🏦" },
    { label: "Chiffre d'affaires", val: fmt(fin?.totalRevenue?.raw, "currency"), color: "#0891b2", icon: "💵" },
    { label: "EBITDA", val: fmt(fin?.ebitda?.raw, "currency"), color: "#7c3aed", icon: "📊" },
    { label: "Résultat net", val: fmt(fin?.netIncomeToCommon?.raw ?? (fin?.profitMargins?.raw != null && fin?.totalRevenue?.raw != null ? fin.profitMargins.raw * fin.totalRevenue.raw : null), "currency"), color: "#10b981", icon: "💰" },
    { label: "Free Cash Flow", val: fmt(fin?.freeCashflow?.raw, "currency"), color: "#0d9488", icon: "🔄" },
    { label: "P/E Ratio", val: fmt(stats?.trailingPE?.raw, "ratio"), color: "#7c3aed", icon: "📈" },
    { label: "P/E Forward", val: fmt(stats?.forwardPE?.raw, "ratio"), color: "#6366f1", icon: "🔮" },
    { label: "P/B Ratio", val: fmt(stats?.priceToBook?.raw, "ratio"), color: "#0891b2", icon: "📖" },
    { label: "EV/EBITDA", val: fmt(stats?.enterpriseToEbitda?.raw, "ratio"), color: "#a855f7", icon: "⚖️" },
    { label: "Marge nette", val: fmt(fin?.profitMargins?.raw, "percent"), color: "#16a34a", icon: "📐" },
    { label: "ROE", val: fmt(fin?.returnOnEquity?.raw, "percent"), color: "#ea580c", icon: "🎯" },
    { label: "Dividende", val: summ?.dividendYield?.raw ? fmt(summ.dividendYield.raw, "percent") : "—", color: "#16a34a", icon: "🪙" },
  ];

  return (
    <div className="grid8">
      {metrics.map(m => (
        <div key={m.label} className="metric-card" style={{ borderTopColor: m.color }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>{m.icon}</div>
          <div className="metric-value">{m.val}</div>
          <div className="metric-label">{m.label}</div>
        </div>
      ))}
    </div>
  );
}

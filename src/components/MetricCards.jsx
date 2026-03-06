import { fmt } from "../utils/format";

export default function MetricCards({ data }) {
  const pr = data?.price;
  const stats = data?.defaultKeyStatistics;
  const summ = data?.summaryDetail;
  const fin = data?.financialData;

  const metrics = [
    { label: "Capitalisation", val: fmt(pr?.marketCap?.raw, "currency"), color: "#4f46e5", icon: "🏦" },
    { label: "P/E Ratio", val: fmt(stats?.trailingPE?.raw, "ratio"), color: "#7c3aed", icon: "📊" },
    { label: "P/B Ratio", val: fmt(stats?.priceToBook?.raw, "ratio"), color: "#0891b2", icon: "📖" },
    { label: "Dividende", val: summ?.dividendYield?.raw ? fmt(summ.dividendYield.raw, "percent") : "—", color: "#16a34a", icon: "💰" },
    { label: "Beta", val: fmt(stats?.beta?.raw, "ratio"), color: "#f59e0b", icon: "⚡" },
    { label: "52S Haut", val: summ?.fiftyTwoWeekHigh?.raw ? summ.fiftyTwoWeekHigh.raw.toFixed(2) : "—", color: "#e11d48", icon: "📈" },
    { label: "52S Bas", val: summ?.fiftyTwoWeekLow?.raw ? summ.fiftyTwoWeekLow.raw.toFixed(2) : "—", color: "#64748b", icon: "📉" },
    { label: "Moy. 50j", val: summ?.fiftyDayAverage?.raw ? summ.fiftyDayAverage.raw.toFixed(2) : "—", color: "#0d9488", icon: "📏" },
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

import { fmt } from "../utils/format";

function Sparkline({ values, color }) {
  if (!values || values.length < 2) return null;
  const nums = values.filter(v => v != null);
  if (nums.length < 2) return null;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const w = 100;
  const h = 28;
  const pad = 2;

  const points = values.map((v, i) => {
    if (v == null) return null;
    const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / range) * (h - 2 * pad);
    return `${x},${y}`;
  }).filter(Boolean);

  // Determine trend color: green if last > first, red if down, else neutral
  const first = nums[0];
  const last = nums[nums.length - 1];
  const trendColor = last > first ? "#10b981" : last < first ? "#ef4444" : color;

  return (
    <svg width={w} height={h} style={{ display: "block", marginTop: 6, opacity: 0.85 }}>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={trendColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].split(",")[0]}
          cy={points[points.length - 1].split(",")[1]}
          r="2.5"
          fill={trendColor}
        />
      )}
    </svg>
  );
}

function extractHistory(data, key) {
  // Extract historical values from timeseries data (oldest to newest)
  const incArr = data?.incomeStatementHistory?.incomeStatementHistory || [];
  const cfArr = data?.cashflowStatementHistory?.cashflowStatements || [];
  const bsArr = data?.balanceSheetHistory?.balanceSheetStatements || [];

  const map = {
    revenue: () => incArr.map(s => s.totalRevenue?.raw ?? null),
    ebitda: () => incArr.map(s => s.ebitda?.raw ?? null),
    netIncome: () => incArr.map(s => s.netIncome?.raw ?? null),
    fcf: () => cfArr.map(s => s.freeCashFlow?.raw ?? null),
    grossProfit: () => incArr.map(s => s.grossProfit?.raw ?? null),
    operatingIncome: () => incArr.map(s => s.operatingIncome?.raw ?? null),
    eps: () => incArr.map(s => s.dilutedEPS?.raw ?? null),
  };

  const fn = map[key];
  if (!fn) return null;
  const arr = fn();
  // Data comes newest first, reverse to get chronological order
  return arr.length >= 2 ? arr.reverse() : null;
}

export default function MetricCards({ data }) {
  const pr = data?.price;
  const stats = data?.defaultKeyStatistics;
  const summ = data?.summaryDetail;
  const fin = data?.financialData;

  const metrics = [
    { label: "Capitalisation", val: fmt(pr?.marketCap?.raw, "currency"), color: "#4f46e5", icon: "🏦" },
    { label: "Chiffre d'affaires", val: fmt(fin?.totalRevenue?.raw, "currency"), color: "#0891b2", icon: "💵", histKey: "revenue" },
    { label: "EBITDA", val: fmt(fin?.ebitda?.raw, "currency"), color: "#7c3aed", icon: "📊", histKey: "ebitda" },
    { label: "Résultat net", val: fmt(fin?.netIncomeToCommon?.raw ?? (fin?.profitMargins?.raw != null && fin?.totalRevenue?.raw != null ? fin.profitMargins.raw * fin.totalRevenue.raw : null), "currency"), color: "#10b981", icon: "💰", histKey: "netIncome" },
    { label: "Free Cash Flow", val: fmt(fin?.freeCashflow?.raw, "currency"), color: "#0d9488", icon: "🔄", histKey: "fcf" },
    { label: "BPA (dilué)", val: fmt(stats?.trailingEps?.raw, "ratio"), color: "#7c3aed", icon: "📈", histKey: "eps" },
    { label: "Résultat opérationnel", val: fmt(fin?.operatingCashflow?.raw, "currency"), color: "#6366f1", icon: "🔮", histKey: "operatingIncome" },
    { label: "P/B Ratio", val: fmt(stats?.priceToBook?.raw, "ratio"), color: "#0891b2", icon: "📖" },
    { label: "EV/EBITDA", val: fmt(stats?.enterpriseToEbitda?.raw, "ratio"), color: "#a855f7", icon: "⚖️" },
    { label: "Marge nette", val: fmt(fin?.profitMargins?.raw, "percent"), color: "#16a34a", icon: "📐" },
    { label: "ROE", val: fmt(fin?.returnOnEquity?.raw, "percent"), color: "#ea580c", icon: "🎯" },
    { label: "Dividende", val: summ?.dividendYield?.raw ? fmt(summ.dividendYield.raw, "percent") : "—", color: "#16a34a", icon: "🪙" },
  ];

  return (
    <div className="grid8">
      {metrics.map(m => {
        const hist = m.histKey ? extractHistory(data, m.histKey) : null;
        return (
          <div key={m.label} className="metric-card" style={{ borderTopColor: m.color }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{m.icon}</div>
            <div className="metric-value">{m.val}</div>
            <div className="metric-label">{m.label}</div>
            {hist && <Sparkline values={hist} color={m.color} />}
            {hist && (
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
                {hist.filter(v => v != null).length} ans d'historique
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

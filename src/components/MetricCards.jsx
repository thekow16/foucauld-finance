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

  const first = nums[0];
    const last = nums[nums.length - 1];
    const trendColor = last > first ? "#10b981" : last < first ? "#ef4444" : color;

  return (
        <svg width={w} height={h} style={{ display: "block", marginTop: 6, opacity: 0.85 }} aria-hidden="true">
              <polyline
                        points={points.join(" ")}
                        fill="none"
                        stroke={trendColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
          {points.length > 0 && (
                  <circle
                              cx={points[points.length - 1].split(",")[0]}
                              cy={points[points.length - 1].split(",")[1]}
                              r="2.5"
                              fill={trendColor}
                            />
                )}
        </svg>svg>
      );
}

function extractHistory(data, key) {
    const incArr = data?.incomeStatementHistory?.incomeStatementHistory || [];
    const cfArr = data?.cashflowStatementHistory?.cashflowStatements || [];
    const map = {
          revenue: () => incArr.map(s => s.totalRevenue?.raw ?? null),
          ebitda: () => incArr.map(s => s.ebitda?.raw ?? null),
          netIncome: () => incArr.map(s => s.netIncome?.raw ?? null),
          fcf: () => cfArr.map(s => s.freeCashFlow?.raw ?? null),
          grossProfit: () => incArr.map(s => s.grossProfit?.raw ?? null),
          operatingIncome: () => incArr.map(s => s.operatingIncome?.raw ?? null),
          eps: () => incArr.map(s => s.dilutedEPS?.raw ?? null),
          dividendsPaid: () => cfArr.map(s => {
                  const v = s.dividendsPaid?.raw;
                  return v != null ? Math.abs(v) : null;
          }),
    };
    const fn = map[key];
    if (!fn) return null;
    const arr = fn();
    return arr.length >= 2 ? arr.reverse() : null;
}

/* ── Price position within 52-week range ── */
function FiftyTwoWeekBar({ low, high, current }) {
    if (low == null || high == null || current == null || high === low) return null;
    const pct = Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100));
    return (
          <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--muted)", marginBottom: 3 }}>
                        <span>{low.toFixed(2)}</span>span>
                        <span style={{ fontSize: 9, color: "var(--text-secondary)", fontWeight: 600 }}>52 sem.</span>span>
                        <span>{high.toFixed(2)}</span>span>
                </div>div>
                <div style={{ position: "relative", height: 4, borderRadius: 4, background: "var(--border)" }}>
                        <div style={{
                      position: "absolute", top: 0, left: 0,
                      height: "100%", width: `${pct}%`,
                      borderRadius: 4,
                      background: pct < 30 ? "#ef4444" : pct > 70 ? "#10b981" : "#f59e0b",
                      transition: "width .4s ease",
          }} />
                        <div style={{
                      position: "absolute", top: -3, left: `calc(${pct}% - 4px)`,
                      width: 8, height: 8, borderRadius: "50%",
                      background: "var(--accent, #2563eb)", border: "2px solid var(--card)",
          }} />
                </div>div>
          </div>div>
        );
}

export default function MetricCards({ data }) {
    const pr = data?.price;
    const stats = data?.defaultKeyStatistics;
    const summ = data?.summaryDetail;
    const fin = data?.financialData;
  
    /* ── Computed metrics ── */
    const peRatio = summ?.trailingPE?.raw ?? stats?.trailingPE?.raw ?? null;
    const fwdPE = summ?.forwardPE?.raw ?? stats?.forwardPE?.raw ?? null;
    const evEbitda = stats?.enterpriseToEbitda?.raw ?? null;
    const evRevenue = stats?.enterpriseToRevenue?.raw ?? null;
    const roe = fin?.returnOnEquity?.raw ?? null;
    const roa = fin?.returnOnAssets?.raw ?? null;
    const grossMargin = fin?.grossMargins?.raw ?? null;
    const operatingMargin = fin?.operatingMargins?.raw ?? null;
    const low52 = summ?.fiftyTwoWeekLow?.raw ?? pr?.fiftyTwoWeekLow?.raw ?? null;
    const high52 = summ?.fiftyTwoWeekHigh?.raw ?? pr?.fiftyTwoWeekHigh?.raw ?? null;
    const curPrice = pr?.regularMarketPrice?.raw ?? null;
  
    const metrics = [
      {
              label: "Capitalisation",
              val: fmt(pr?.marketCap?.raw, "currency"),
              color: "#4f46e5", icon: "🏦",
              sub: pr?.marketCap?.raw != null && low52 != null && high52 != null
                        ? <FiftyTwoWeekBar low={low52} high={high52} current={curPrice} />
                        : null,
      },
      {
              label: "Chiffre d'affaires",
              val: fmt(fin?.totalRevenue?.raw, "currency"),
              color: "#0891b2", icon: "💵", histKey: "revenue",
      },
      {
              label: "EBITDA",
              val: fmt(fin?.ebitda?.raw, "currency"),
              color: "#7c3aed", icon: "📊", histKey: "ebitda",
      },
      {
              label: "Résultat net",
              val: fmt(
                        fin?.netIncomeToCommon?.raw ??
                        (fin?.profitMargins?.raw != null && fin?.totalRevenue?.raw != null
                                   ? fin.profitMargins.raw * fin.totalRevenue.raw
                                   : null),
                        "currency"
                      ),
              color: "#10b981", icon: "💰", histKey: "netIncome",
      },
      {
              label: "Free Cash Flow",
              val: fmt(fin?.freeCashflow?.raw, "currency"),
              color: "#0d9488", icon: "🔄", histKey: "fcf",
      },
      {
              label: "BPA (dilué)",
              val: fmt(stats?.trailingEps?.raw, "ratio"),
              color: "#7c3aed", icon: "📈", histKey: "eps",
      },
      {
              label: "P/E (trailing)",
              val: peRatio != null ? `${peRatio.toFixed(1)}x` : "—",
              color: "#2563eb", icon: "🔢",
              sub: fwdPE != null ? (
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                                  Fwd P/E : {fwdPE.toFixed(1)}x
                        </div>div>
                      ) : null,
      },
      {
              label: "EV / EBITDA",
              val: evEbitda != null ? `${evEbitda.toFixed(1)}x` : "—",
              color: "#9333ea", icon: "🏢",
              sub: evRevenue != null ? (
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                                  EV/CA : {evRevenue.toFixed(2)}x
                        </div>div>
                      ) : null,
      },
      {
              label: "ROE / ROA",
              val: roe != null ? fmt(roe, "percent") : "—",
              color: "#0891b2", icon: "📖",
              sub: roa != null ? (
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                                  ROA : {fmt(roa, "percent")}
                        </div>div>
                      ) : null,
      },
      {
              label: "Marges",
              val: grossMargin != null ? fmt(grossMargin, "percent") : "—",
              color: "#16a34a", icon: "📐",
              sub: operatingMargin != null ? (
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                                  Marge op. : {fmt(operatingMargin, "percent")}
                        </div>div>
                      ) : null,
      },
      {
              label: "P/B Ratio",
              val: fmt(stats?.priceToBook?.raw, "ratio"),
              color: "#0891b2", icon: "📘",
      },
      {
              label: "Dividendes",
              val: summ?.dividendYield?.raw
                        ? `${fmt(summ.dividendYield.raw, "percent")} (${summ?.dividendRate?.raw ? fmt(summ.dividendRate.raw, "ratio") + "/action" : "—"})`
                        : "—",
              color: "#f59e0b", icon: "🪙", histKey: "dividendsPaid",
      },
        ];
  
    return (
          <div className="grid8">
            {metrics.map(m => {
                    const hist = m.histKey ? extractHistory(data, m.histKey) : null;
                    return (
                                <div key={m.label} className="metric-card" style={{ borderTopColor: m.color }}>
                                            <div style={{ fontSize: 22, marginBottom: 8 }}>{m.icon}</div>div>
                                            <div className="metric-value">{m.val}</div>div>
                                            <div className="metric-label">{m.label}</div>div>
                                  {m.sub}
                                  {hist && <Sparkline values={hist} color={m.color} />}
                                  {hist && (
                                                <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
                                                  {hist.filter(v => v != null).length} ans d'historique
                                                </div>div>
                                            )}
                                </div>div>
                              );
          })}
          </div>div>
        );
}</svg>

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine,
} from "recharts";

/* ── Helpers (exported for testing) ── */

export function compact(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)} T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)} Md`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)} M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)} k`;
  return `${sign}${abs.toFixed(1)}`;
}

function pct(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(1)} %`;
}

function growthLabel(cur, prev) {
  if (cur == null || prev == null || prev === 0) return null;
  const g = ((cur - prev) / Math.abs(prev)) * 100;
  return g >= 0 ? `+${g.toFixed(0)}%` : `${g.toFixed(0)}%`;
}

/* ── CAGR helper (supports both annual "2024" and quarterly "2024-03" labels) ── */
export function cagr(rows, key, isQuarterly = false) {
  const valid = rows.filter((d) => d[key] != null && d[key] > 0);
  if (valid.length < 2) return null;
  const first = valid[0][key];
  const last = valid[valid.length - 1][key];
  let years;
  if (isQuarterly) {
    // Count quarters and convert to years
    const quarters = valid.length - 1;
    years = quarters / 4;
  } else {
    years = Number(valid[valid.length - 1].year) - Number(valid[0].year);
  }
  if (years <= 0 || first <= 0) return null;
  const rate = Math.pow(last / first, 1 / years) - 1;
  const label = isQuarterly ? `CAGR ~${years.toFixed(1)} ans` : `CAGR ${years} ans`;
  return `${label} : ${rate >= 0 ? "+" : ""}${(rate * 100).toFixed(1)}%`;
}

/* ── Quarter label helper: "2024-03" → "Q1 24" ── */
function quarterLabel(val) {
  if (!val || typeof val !== "string" || !val.includes("-")) return val;
  const [y, m] = val.split("-");
  const q = Math.ceil(Number(m) / 3);
  return `Q${q} ${y.slice(-2)}`;
}

/* ── Check if a row has at least one financial value ── */
function hasFinancialData(d) {
  const keys = ["revenue", "fcf", "sbc", "shares", "ebit", "cash", "debt", "assets", "dividendsPaid"];
  return keys.some((k) => d[k] != null);
}

/* ── Data builder (historique complet, 10+ ans) ── */

export function buildSeries(data) {
  const fmp = data?._fmpData;
  // Debug: log what data sources are available
  const bsArr = data?.balanceSheetHistory?.balanceSheetStatements || [];
  const isArr = data?.incomeStatementHistory?.incomeStatementHistory || [];
  const cfArr = data?.cashflowStatementHistory?.cashflowStatements || [];
  const bsDates = bsArr.map(s => s.endDate?.fmt || (s.endDate?.raw ? new Date(s.endDate.raw * 1000).toISOString().slice(0,10) : '?'));
  const isDates = isArr.map(s => s.endDate?.fmt || (s.endDate?.raw ? new Date(s.endDate.raw * 1000).toISOString().slice(0,10) : '?'));

  if (fmp?.income?.length && fmp?.cashflow?.length && fmp?.balance?.length) {
    const byYear = new Map();
    fmp.income.forEach((d) => {
      const y = d?.calendarYear || d?.date?.slice(0, 4);
      if (!y) return;
      byYear.set(y, {
        ...(byYear.get(y) || {}),
        year: y,
        revenue: d.revenue,
        shares: d.weightedAverageShsOutDil,
        ebit: d.operatingIncome,
      });
    });
    fmp.cashflow.forEach((d) => {
      const y = d?.calendarYear || d?.date?.slice(0, 4);
      if (!y) return;
      byYear.set(y, {
        ...(byYear.get(y) || {}),
        year: y,
        fcf: d.freeCashFlow,
        sbc: d.stockBasedCompensation,
        dividendsPaid: d.dividendsPaid,
      });
    });
    fmp.balance.forEach((d) => {
      const y = d?.calendarYear || d?.date?.slice(0, 4);
      if (!y) return;
      byYear.set(y, {
        ...(byYear.get(y) || {}),
        year: y,
        cash: d.cashAndCashEquivalents,
        debt: d.totalDebt,
        assets: d.totalAssets,
        currentLiabilities: d.totalCurrentLiabilities,
      });
    });

    const fmpRows = [...byYear.values()]
      .map((d) => enrich(d))
      .filter((d) => d.year && hasFinancialData(d))
      .sort((a, b) => String(a.year).localeCompare(String(b.year)));
    return fmpRows;
  }

  /* Fallback Yahoo */
  const income = data?.incomeStatementHistory?.incomeStatementHistory || [];
  const cashflow = data?.cashflowStatementHistory?.cashflowStatements || [];
  const balance = data?.balanceSheetHistory?.balanceSheetStatements || [];
  const byYear = new Map();

  income.forEach((d) => {
    const y = d?.endDate?.raw ? new Date(d.endDate.raw * 1000).getFullYear() : null;
    if (!y) return;
    byYear.set(String(y), {
      ...(byYear.get(String(y)) || {}),
      year: String(y),
      revenue: d.totalRevenue?.raw,
      ebit: d.operatingIncome?.raw,
      shares: d.dilutedAverageShares?.raw,
    });
  });
  cashflow.forEach((d) => {
    const y = d?.endDate?.raw ? new Date(d.endDate.raw * 1000).getFullYear() : null;
    if (!y) return;
    byYear.set(String(y), {
      ...(byYear.get(String(y)) || {}),
      year: String(y),
      fcf: d.freeCashFlow?.raw,
      sbc: d.stockBasedCompensation?.raw,
      dividendsPaid: d.dividendsPaid?.raw,
    });
  });
  balance.forEach((d) => {
    const y = d?.endDate?.raw ? new Date(d.endDate.raw * 1000).getFullYear() : null;
    if (!y) return;
    byYear.set(String(y), {
      ...(byYear.get(String(y)) || {}),
      year: String(y),
      cash: d.cash?.raw,
      debt: d.totalDebt?.raw ?? d.longTermDebt?.raw,
      assets: d.totalAssets?.raw,
      currentLiabilities: d.totalCurrentLiabilities?.raw,
    });
  });

  const yahooRows = [...byYear.values()]
    .map((d) => enrich(d))
    .filter((d) => d.year && hasFinancialData(d))
    .sort((a, b) => String(a.year).localeCompare(String(b.year)));
  if (yahooRows.length === 0 && byYear.size > 0) {
    // Log sample row to help debug
    const sample = [...byYear.values()][0];
    console.warn("[FF][Charts] Rows exist but no financial data. Sample:", JSON.stringify(sample));
  }
  return yahooRows;
}

function enrich(d) {
  const investedCapital =
    d.assets != null && d.currentLiabilities != null ? d.assets - d.currentLiabilities : null;
  const roce = investedCapital && d.ebit != null ? d.ebit / investedCapital : null;
  const fcfMargin = d.fcf != null && d.revenue ? d.fcf / d.revenue : null;
  const fcfPerShare = d.fcf != null && d.shares ? d.fcf / d.shares : null;
  const dividendPerShare =
    d.dividendsPaid != null && d.shares ? Math.abs(d.dividendsPaid) / d.shares : null;
  return { ...d, roce, fcfMargin, fcfPerShare, dividendPerShare };
}

/* ── Quarterly data builder ── */
function buildQuarterlySeries(data) {
  const qArr = data?._quarterlyData || [];
  if (!qArr.length) return [];

  const byQuarter = new Map();
  qArr.forEach((d) => {
    const date = d.endDate?.fmt || (d.endDate?.raw ? new Date(d.endDate.raw * 1000).toISOString().slice(0, 10) : null);
    if (!date) return;
    const label = date.slice(0, 7); // "2024-03" format
    byQuarter.set(label, {
      year: label,
      revenue: d.totalRevenue?.raw,
      ebit: d.operatingIncome?.raw,
      shares: d.dilutedAverageShares?.raw,
      fcf: d.freeCashFlow?.raw,
      sbc: d.stockBasedCompensation?.raw,
      dividendsPaid: d.dividendsPaid?.raw,
      cash: d.cash?.raw,
      debt: d.totalDebt?.raw,
      assets: d.totalAssets?.raw,
      currentLiabilities: d.totalCurrentLiabilities?.raw,
    });
  });

  return [...byQuarter.values()]
    .map((d) => enrich(d))
    .filter((d) => d.year && hasFinancialData(d))
    .sort((a, b) => String(a.year).localeCompare(String(b.year)));
}

/* ── Growth label rendered above bars ── */

function GrowthLabels({ data, dataKey }) {
  return data.map((d, i) => {
    if (i === 0 || d[dataKey] == null) return null;
    const prev = data[i - 1][dataKey];
    const label = growthLabel(d[dataKey], prev);
    if (!label) return null;
    const isPos = d[dataKey] >= (prev ?? 0);
    return (
      <text
        key={d.year}
        x={0}
        y={0}
        style={{ fontSize: 9, fontWeight: 700, fill: isPos ? "#10b981" : "#ef4444" }}
      >
        {label}
      </text>
    );
  });
}

/* ── Custom bar shape with rounded top ── */
function RoundedBar(props) {
  const { x, y, width, height, fill } = props;
  if (!height || height <= 0) return null;
  const r = Math.min(4, width / 2, height);
  return (
    <path
      d={`M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`}
      fill={fill}
    />
  );
}

/* ── Custom Tooltip ── */
function BaggrTooltip({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null;
  // Format quarterly labels nicely: "2024-03" → "Q1 2024"
  const displayLabel = typeof label === "string" && label.includes("-")
    ? quarterLabel(label)
    : label;
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "0 4px 16px rgba(0,0,0,.12)",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6, color: "var(--text)" }}>{displayLabel}</div>
      {payload.map((p) => (
        <div key={p.name || p.dataKey} style={{ color: p.color, fontWeight: 600, marginBottom: 2 }}>
          {p.name || p.dataKey}: {fmt ? fmt(p.value) : compact(p.value)}
        </div>
      ))}
    </div>
  );
}

/* ── Chart card with Baggr-style header ── */
function ChartCard({ title, subtitle, accentColor, cagrLabel, children }) {
  return (
    <div
      style={{
        background: "var(--card)",
        borderRadius: 16,
        padding: "20px 18px 16px",
        boxShadow: "0 1px 4px var(--shadow)",
        border: "1px solid var(--border)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Accent bar top */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: accentColor,
          borderRadius: "16px 16px 0 0",
        }}
      />
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", letterSpacing: "-0.2px" }}>
            {title}
          </div>
          {cagrLabel && (
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: cagrLabel.startsWith("CAGR") && cagrLabel.includes("+") ? "#10b981" : "#ef4444",
              background: cagrLabel.startsWith("CAGR") && cagrLabel.includes("+") ? "#10b98118" : "#ef444418",
              padding: "2px 7px",
              borderRadius: 6,
              whiteSpace: "nowrap",
            }}>
              {cagrLabel}
            </div>
          )}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontWeight: 500 }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ width: "100%", height: 240 }}>{children}</div>
    </div>
  );
}

/* ── Custom bar label showing YoY growth ── */
function renderGrowthLabel(data, dataKey) {
  // Skip labels every N bars when data is dense
  const step = data.length > 15 ? 3 : data.length > 10 ? 2 : 1;
  return (props) => {
    const { x, y, width, index, value } = props;
    if (index === 0 || value == null) return null;
    if (step > 1 && index % step !== 0) return null;
    const prev = data[index - 1]?.[dataKey];
    const label = growthLabel(value, prev);
    if (!label) return null;
    const isPos = !label.startsWith("-");
    return (
      <text
        x={x + width / 2}
        y={y - 6}
        textAnchor="middle"
        style={{
          fontSize: data.length > 12 ? 8 : 9,
          fontWeight: 700,
          fill: isPos ? "#10b981" : "#ef4444",
        }}
      >
        {label}
      </text>
    );
  };
}

/* ── Currency symbol lookup ── */
const CURRENCY_SYMBOLS = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "CHF ", CNY: "¥", CAD: "CA$", AUD: "A$", KRW: "₩", INR: "₹", BRL: "R$", SEK: "kr ", DKK: "kr ", NOK: "kr ", HKD: "HK$", SGD: "S$", TWD: "NT$", ZAR: "R " };
export function getCurrencySymbol(code) { return CURRENCY_SYMBOLS[code] || (code ? code + " " : "$"); }

/* ── Main Component ── */

export default function KeyMetricsCharts({ data, currency = "USD" }) {
  const [quarterly, setQuarterly] = useState(false);
  const annualRows = buildSeries(data);
  const quarterlyRows = buildQuarterlySeries(data);
  const hasQuarterly = quarterlyRows.length > 0;
  const rows = quarterly && hasQuarterly ? quarterlyRows : annualRows;
  const cs = getCurrencySymbol(currency);
  if (!annualRows.length) return (
    <div style={{
      background: "var(--card)",
      borderRadius: 16,
      padding: "32px 24px",
      textAlign: "center",
      border: "1px solid var(--border)",
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>📊</div>
      <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
        Données financières indisponibles
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
        Les données historiques (CA, FCF, ROCE…) ne sont pas disponibles pour cette action.
        <br />Vérifiez la console (F12) pour plus de détails.
      </div>
    </div>
  );

  const many = rows.length > 12;
  const axisStyle = { fontSize: many ? 9 : 10, fill: "var(--muted)" };
  const gridProps = { strokeDasharray: "3 3", stroke: "var(--border)", strokeOpacity: 0.6 };
  // Show every Nth label on X axis when there are many data points
  const xTickInterval = many ? Math.max(1, Math.floor(rows.length / 10)) - 1 : 0;
  const yearTick = quarterly
    ? quarterLabel
    : many
      ? (val) => `'${String(val).slice(-2)}`
      : undefined;

  const shortHistory = !quarterly && rows.length > 0 && rows.length <= 5;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
        gap: 16,
        marginBottom: 16,
      }}
    >
      {/* Toggle annuel / trimestriel */}
      {hasQuarterly && (
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 4 }}>
          {["Annuel", "Trimestriel"].map((label, i) => {
            const isActive = i === 0 ? !quarterly : quarterly;
            return (
              <button
                key={label}
                onClick={() => setQuarterly(i === 1)}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: isActive ? "var(--accent, #2563eb)" : "var(--card)",
                  color: isActive ? "#fff" : "var(--muted)",
                  cursor: "pointer",
                  transition: "all .15s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      {shortHistory && (
        <div
          style={{
            gridColumn: "1 / -1",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "10px 16px",
            fontSize: 12,
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>&#9432;</span>
          Historique limité à {rows.length} ans pour cette action.
          Certaines actions ont jusqu'à 20+ ans de données disponibles.
        </div>
      )}
      {/* 1. Chiffre d'affaires */}
      <ChartCard title="Chiffre d'affaires" subtitle={quarterly ? "Évolution trimestrielle du CA" : "Évolution annuelle du CA"} accentColor="#0891b2" cagrLabel={cagr(rows, "revenue", quarterly)}>
        <ResponsiveContainer>
          <BarChart data={rows} barCategoryGap="20%">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" tick={axisStyle} tickLine={false} axisLine={false} interval={xTickInterval} tickFormatter={yearTick} />
            <YAxis tickFormatter={compact} tick={axisStyle} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<BaggrTooltip />} />
            <Bar dataKey="revenue" shape={<RoundedBar />} label={renderGrowthLabel(rows, "revenue")}>
              {rows.map((d, i) => {
                const prev = rows[i - 1]?.revenue;
                const color = i === 0 || d.revenue == null || prev == null ? "#0891b2"
                  : d.revenue >= prev ? "#0891b2" : "#0891b2aa";
                return <Cell key={d.year} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 2. Free Cash Flow & SBC */}
      <ChartCard title="Free Cash Flow & SBC" subtitle={quarterly ? "FCF vs SBC trimestriel" : "FCF vs rémunération en actions"} accentColor="#0d9488" cagrLabel={cagr(rows, "fcf", quarterly)}>
        <ResponsiveContainer>
          <BarChart data={rows} barCategoryGap="20%">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" tick={axisStyle} tickLine={false} axisLine={false} interval={xTickInterval} tickFormatter={yearTick} />
            <YAxis tickFormatter={compact} tick={axisStyle} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<BaggrTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, fontWeight: 600 }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="fcf" name="Free Cash Flow" shape={<RoundedBar />}>
              {rows.map((d) => (
                <Cell key={d.year} fill={d.fcf != null && d.fcf >= 0 ? "#10b981" : "#ef4444"} />
              ))}
            </Bar>
            <Bar dataKey="sbc" name="SBC" fill="#a855f7" shape={<RoundedBar />} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3. FCF par action */}
      <ChartCard title="Free Cash Flow par action" subtitle={quarterly ? "FCF / action (trimestriel)" : "FCF / actions diluées"} accentColor="#2563eb" cagrLabel={cagr(rows, "fcfPerShare", quarterly)}>
        <ResponsiveContainer>
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="gradFcfShare" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" tick={axisStyle} tickLine={false} axisLine={false} interval={xTickInterval} tickFormatter={yearTick} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={52}
              tickFormatter={(v) => v != null ? `${cs}${v.toFixed(1)}` : ""} />
            <Tooltip content={<BaggrTooltip fmt={(v) => v != null ? `${cs}${v.toFixed(2)}` : "—"} />} />
            <Area
              type="monotone"
              dataKey="fcfPerShare"
              stroke="#2563eb"
              strokeWidth={2.5}
              fill="url(#gradFcfShare)"
              dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 4. ROCE */}
      <ChartCard title="ROCE" subtitle={quarterly ? "ROCE trimestriel" : "Return on Capital Employed"} accentColor="#ea580c">
        <ResponsiveContainer>
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="gradRoce" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ea580c" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ea580c" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" tick={axisStyle} tickLine={false} axisLine={false} interval={xTickInterval} tickFormatter={yearTick} />
            <YAxis tickFormatter={pct} tick={axisStyle} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<BaggrTooltip fmt={pct} />} />
            <ReferenceLine y={0.15} stroke="#ea580c" strokeDasharray="4 4" strokeOpacity={0.4} />
            <Area
              type="monotone"
              dataKey="roce"
              stroke="#ea580c"
              strokeWidth={2.5}
              fill="url(#gradRoce)"
              dot={{ r: 3, fill: "#ea580c", strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 5. Marge de FCF */}
      <ChartCard title="Marge de Free Cash Flow" subtitle={quarterly ? "FCF / CA (trimestriel)" : "FCF / Chiffre d'affaires"} accentColor="#16a34a">
        <ResponsiveContainer>
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="gradFcfMargin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" tick={axisStyle} tickLine={false} axisLine={false} interval={xTickInterval} tickFormatter={yearTick} />
            <YAxis tickFormatter={pct} tick={axisStyle} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<BaggrTooltip fmt={pct} />} />
            <Area
              type="monotone"
              dataKey="fcfMargin"
              stroke="#16a34a"
              strokeWidth={2.5}
              fill="url(#gradFcfMargin)"
              dot={{ r: 3, fill: "#16a34a", strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 6. Actions en circulation */}
      <ChartCard title="Actions en circulation" subtitle={quarterly ? "Actions diluées (trimestriel)" : "Nombre d'actions diluées"} accentColor="#6366f1">
        <ResponsiveContainer>
          <BarChart data={rows} barCategoryGap="20%">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" tick={axisStyle} tickLine={false} axisLine={false} interval={xTickInterval} tickFormatter={yearTick} />
            <YAxis tickFormatter={compact} tick={axisStyle} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<BaggrTooltip />} />
            <Bar dataKey="shares" shape={<RoundedBar />} label={renderGrowthLabel(rows, "shares")}>
              {rows.map((d, i) => {
                const prev = rows[i - 1]?.shares;
                const color = i === 0 || d.shares == null || prev == null ? "#6366f1"
                  : d.shares <= prev ? "#10b981" : "#ef4444";
                return <Cell key={d.year} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 7. Cash & Dette */}
      <ChartCard title="Cash & Dette" subtitle={quarterly ? "Trésorerie vs dette (trimestriel)" : "Trésorerie vs dette totale"} accentColor="#14b8a6">
        <ResponsiveContainer>
          <BarChart data={rows} barCategoryGap="20%">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" tick={axisStyle} tickLine={false} axisLine={false} interval={xTickInterval} tickFormatter={yearTick} />
            <YAxis tickFormatter={compact} tick={axisStyle} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<BaggrTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, fontWeight: 600 }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="cash" name="Trésorerie" fill="#14b8a6" shape={<RoundedBar />} />
            <Bar dataKey="debt" name="Dette" fill="#ef4444" shape={<RoundedBar />} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 8. Dividendes par action — uniquement si l'entreprise verse des dividendes */}
      {rows.some((d) => d.dividendPerShare != null && d.dividendPerShare > 0) && (
        <ChartCard title="Dividendes par action" subtitle={quarterly ? "Dividendes / action (trimestriel)" : "Dividendes / actions diluées"} accentColor="#f59e0b" cagrLabel={cagr(rows, "dividendPerShare", quarterly)}>
          <ResponsiveContainer>
            <AreaChart data={rows}>
              <defs>
                <linearGradient id="gradDiv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="year" tick={axisStyle} tickLine={false} axisLine={false} interval={xTickInterval} tickFormatter={yearTick} />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={52}
                tickFormatter={(v) => v != null ? `${cs}${v.toFixed(2)}` : ""} />
              <Tooltip content={<BaggrTooltip fmt={(v) => v != null ? `${cs}${v.toFixed(3)}` : "—"} />} />
              <Area
                type="monotone"
                dataKey="dividendPerShare"
                stroke="#f59e0b"
                strokeWidth={2.5}
                fill="url(#gradDiv)"
                dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

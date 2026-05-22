import { warn } from "../utils/log";
import { useState, useEffect, useCallback } from "react";
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

export function cagrN(rows, key, n) {
  const valid = rows.filter((d) => d[key] != null && d[key] > 0);
  if (valid.length < 2) return null;
  const lastYear = Number(valid[valid.length - 1].year);
  const targetYear = String(lastYear - n);
  const start = valid.find((d) => d.year === targetYear);
  if (!start) return null;
  const last = valid[valid.length - 1][key];
  const first = start[key];
  if (first <= 0) return null;
  const rate = Math.pow(last / first, 1 / n) - 1;
  return { label: `${n}A`, value: `${rate >= 0 ? "+" : ""}${(rate * 100).toFixed(1)}%`, positive: rate >= 0 };
}

function cagrMulti(rows, key) {
  return [5, 10, 20].map((n) => cagrN(rows, key, n)).filter(Boolean);
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

/* ── Stock-split normalization ── */
const COMMON_SPLIT_RATIOS = [2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 50, 100];

function normalizeShares(rows) {
  const withShares = rows.filter(r => r.shares != null && r.shares > 0);
  if (withShares.length < 3) return;
  const recent = withShares.slice(-3).map(r => r.shares).sort((a, b) => a - b);
  const ref = recent[Math.floor(recent.length / 2)];
  for (const row of rows) {
    if (row.shares == null || row.shares <= 0) continue;
    const ratio = ref / row.shares;
    if (ratio > 1.8) {
      const best = COMMON_SPLIT_RATIOS.reduce((b, r) =>
        Math.abs(ratio / r - 1) < Math.abs(ratio / b - 1) ? r : b
      );
      if (Math.abs(ratio / best - 1) < 0.15) row.shares *= best;
    } else if (ratio < 0.55) {
      const invRatio = 1 / ratio;
      const best = COMMON_SPLIT_RATIOS.reduce((b, r) =>
        Math.abs(invRatio / r - 1) < Math.abs(invRatio / b - 1) ? r : b
      );
      if (Math.abs(invRatio / best - 1) < 0.15) row.shares /= best;
    }
  }
}

/* ── Data builder (historique complet, 20+ ans) ── */
/* Fusionne FMP + Yahoo (enrichi par timeseries) pour maximiser la couverture. */

export function buildSeries(data) {
  const fmp = data?._fmpData;
  const byYear = new Map();

  // 1) Yahoo history arrays (includes timeseries data when available → 10-20+ years)
  const income = data?.incomeStatementHistory?.incomeStatementHistory || [];
  const cashflow = data?.cashflowStatementHistory?.cashflowStatements || [];
  const balance = data?.balanceSheetHistory?.balanceSheetStatements || [];

  income.forEach((d) => {
    const y = d?.endDate?.raw ? String(new Date(d.endDate.raw * 1000).getFullYear()) : null;
    if (!y) return;
    const e = byYear.get(y) || {};
    byYear.set(y, {
      ...e,
      year: y,
      revenue: d.totalRevenue?.raw ?? e.revenue,
      ebit: d.operatingIncome?.raw ?? e.ebit,
      shares: d.dilutedAverageShares?.raw ?? e.shares,
    });
  });
  cashflow.forEach((d) => {
    const y = d?.endDate?.raw ? String(new Date(d.endDate.raw * 1000).getFullYear()) : null;
    if (!y) return;
    const e = byYear.get(y) || {};
    byYear.set(y, {
      ...e,
      year: y,
      fcf: d.freeCashFlow?.raw ?? e.fcf,
      sbc: d.stockBasedCompensation?.raw ?? e.sbc,
      dividendsPaid: d.dividendsPaid?.raw ?? e.dividendsPaid,
    });
  });
  balance.forEach((d) => {
    const y = d?.endDate?.raw ? String(new Date(d.endDate.raw * 1000).getFullYear()) : null;
    if (!y) return;
    const e = byYear.get(y) || {};
    byYear.set(y, {
      ...e,
      year: y,
      cash: d.cash?.raw ?? e.cash,
      debt: (d.totalDebt?.raw ?? d.longTermDebt?.raw) ?? e.debt,
      assets: d.totalAssets?.raw ?? e.assets,
      currentLiabilities: d.totalCurrentLiabilities?.raw ?? e.currentLiabilities,
    });
  });

  // 2) FMP data enriches Yahoo (only overwrites when FMP has actual data)
  if (fmp?.income?.length) {
    fmp.income.forEach((d) => {
      const y = d?.calendarYear || d?.date?.slice(0, 4);
      if (!y) return;
      const e = byYear.get(y) || { year: y };
      const fmpShares = d.weightedAverageShsOutDil;
      const shares = (fmpShares != null && e.shares != null && e.shares > 0 &&
        (fmpShares / e.shares > 3 || fmpShares / e.shares < 1 / 3))
        ? e.shares : (fmpShares ?? e.shares);
      byYear.set(y, { ...e, year: y, revenue: d.revenue ?? e.revenue, shares, ebit: d.operatingIncome ?? e.ebit });
    });
  }
  if (fmp?.cashflow?.length) {
    fmp.cashflow.forEach((d) => {
      const y = d?.calendarYear || d?.date?.slice(0, 4);
      if (!y) return;
      const e = byYear.get(y) || { year: y };
      byYear.set(y, { ...e, year: y, fcf: d.freeCashFlow ?? e.fcf, sbc: d.stockBasedCompensation ?? e.sbc, dividendsPaid: d.dividendsPaid ?? e.dividendsPaid });
    });
  }
  if (fmp?.balance?.length) {
    fmp.balance.forEach((d) => {
      const y = d?.calendarYear || d?.date?.slice(0, 4);
      if (!y) return;
      const e = byYear.get(y) || { year: y };
      byYear.set(y, { ...e, year: y, cash: d.cashAndCashEquivalents ?? e.cash, debt: d.totalDebt ?? d.longTermDebt ?? e.debt, assets: d.totalAssets ?? e.assets, currentLiabilities: d.totalCurrentLiabilities ?? e.currentLiabilities });
    });
  }

  const raw = [...byYear.values()]
    .filter((d) => d.year && hasFinancialData(d))
    .sort((a, b) => String(a.year).localeCompare(String(b.year)));
  normalizeShares(raw);
  const rows = raw.map((d) => enrich(d));
  if (typeof console !== "undefined") {
    const yrs = rows.map(r => r.year).join(",");
    console.log(`[FF][Charts] buildSeries: ${rows.length} ans (${yrs}) — Yahoo IS=${income.length} BS=${balance.length} CF=${cashflow.length}, FMP IS=${fmp?.income?.length || 0} BS=${fmp?.balance?.length || 0} CF=${fmp?.cashflow?.length || 0}`);
  }
  return rows;
}

function enrich(d) {
  const investedCapital =
    d.assets != null && d.currentLiabilities != null ? d.assets - d.currentLiabilities : null;
  const roce = investedCapital != null && investedCapital !== 0 && d.ebit != null ? d.ebit / investedCapital : null;
  const fcfMargin = d.fcf != null && d.revenue != null && d.revenue !== 0 ? d.fcf / d.revenue : null;
  const fcfPerShare = d.fcf != null && d.shares != null && d.shares !== 0 ? d.fcf / d.shares : null;
  const dividendPerShare =
    d.dividendsPaid != null && d.shares != null && d.shares !== 0 ? Math.abs(d.dividendsPaid) / d.shares : null;
  const netDebt = d.debt != null && d.cash != null ? d.debt - d.cash : null;
  const debtRepayYears = netDebt != null && d.fcf != null
    ? (netDebt <= 0 ? 0 : (d.fcf > 0 ? netDebt / d.fcf : null))
    : null;
  return { ...d, roce, fcfMargin, fcfPerShare, dividendPerShare, debtRepayYears };
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

/* ── Custom bar shape with rounded corners ── */
function RoundedBar(props) {
  const { x, y, width, height, fill } = props;
  if (!width || !height) return null;
  const top = Math.min(y, y + height);
  const bottom = Math.max(y, y + height);
  const h = bottom - top;
  const r = Math.min(3, width / 2, h);
  if (height >= 0) {
    return (
      <path
        d={`M${x},${bottom} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + width - r},${top} Q${x + width},${top} ${x + width},${top + r} L${x + width},${bottom} Z`}
        fill={fill}
      />
    );
  }
  return (
    <path
      d={`M${x},${top} L${x},${bottom - r} Q${x},${bottom} ${x + r},${bottom} L${x + width - r},${bottom} Q${x + width},${bottom} ${x + width},${bottom - r} L${x + width},${top} Z`}
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
        boxShadow: "0 8px 24px rgba(0,0,0,.15)",
        fontSize: 12,
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--text)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>{displayLabel}</div>
      {payload.map((p) => (
        <div key={p.name || p.dataKey} style={{ color: p.color, fontWeight: 600, marginBottom: 2 }}>
          {p.name || p.dataKey}: {fmt ? fmt(p.value) : compact(p.value)}
        </div>
      ))}
    </div>
  );
}

/* ── Verdict helpers (background tint) ── */
function cagr5Rate(rows, key) {
  const valid = rows.filter(r => r[key] != null && r[key] > 0);
  if (valid.length < 2) return null;
  const lastYear = Number(valid[valid.length - 1].year);
  const start = valid.find(r => r.year === String(lastYear - 5));
  if (!start || start[key] <= 0) return null;
  return Math.pow(valid[valid.length - 1][key] / start[key], 1 / 5) - 1;
}

function avg5(rows, key) {
  const valid = rows.filter(r => r[key] != null);
  const last5 = valid.slice(-5);
  if (last5.length === 0) return null;
  return last5.reduce((s, r) => s + r[key], 0) / last5.length;
}

/* ── Chart card ── */
function ChartCard({ title, subtitle, accentColor, cagrLabel, cagrLabels, expanded, onToggle, verdict, wide, children }) {
  const isPositive = cagrLabel && cagrLabel.includes("+");
  const bgTint = verdict === true ? "rgba(16,185,129,0.06)"
    : verdict === false ? "rgba(239,68,68,0.06)" : undefined;

  const card = (
    <div
      style={{
        background: bgTint || "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
        transition: "box-shadow .2s, transform .2s",
        cursor: "pointer",
        ...(wide ? { gridColumn: "1 / -1" } : {}),
        ...(expanded ? { width: "100%", maxWidth: 960, margin: "0 auto" } : {}),
      }}
      onMouseEnter={(e) => { if (!expanded) { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
      onMouseLeave={(e) => { if (!expanded) { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; } }}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
    >
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: expanded ? "14px 20px 8px" : "10px 12px 6px",
        gap: 6,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: expanded ? 14 : 12, color: "var(--text)", lineHeight: 1.2 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: expanded ? 11 : 9, color: "var(--text-3, var(--muted))", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {subtitle}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap", justifyContent: "flex-end", flexShrink: 0 }}>
          {cagrLabels?.length > 0 && cagrLabels.map((c) => (
            <div key={c.label} style={{
              fontSize: expanded ? 10 : 9,
              fontWeight: 700,
              color: c.positive ? "var(--green)" : "var(--red)",
              background: c.positive ? "var(--green-bg)" : "var(--red-bg)",
              padding: "1px 5px",
              borderRadius: 4,
              whiteSpace: "nowrap",
            }}>
              {c.label} {c.value}
            </div>
          ))}
          {cagrLabel && !cagrLabels?.length && (
            <div style={{
              fontSize: expanded ? 11 : 9,
              fontWeight: 700,
              color: isPositive ? "var(--green)" : "var(--red)",
              background: isPositive ? "var(--green-bg)" : "var(--red-bg)",
              padding: "1px 6px",
              borderRadius: 4,
              whiteSpace: "nowrap",
            }}>
              {cagrLabel}
            </div>
          )}
          {expanded && (
            <div style={{ fontSize: 18, color: "var(--muted)", lineHeight: 1, marginLeft: 4 }} title="Fermer">✕</div>
          )}
        </div>
      </div>
      <div style={{ width: "100%", height: expanded ? "calc(80vh - 80px)" : (wide ? 220 : 260), padding: expanded ? "12px 20px 12px" : "4px 10px 8px" }}>{children}</div>
    </div>
  );

  if (!expanded) return card;

  return (
    <div
      onClick={onToggle}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,.6)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      {card}
    </div>
  );
}

/* ── Revenue chart label: always show %, colored like the bar ── */
function renderRevenueLabel(data) {
  const step = data.length > 15 ? 3 : data.length > 10 ? 2 : 1;
  return (props) => {
    const { x, y, width, index, value } = props;
    if (index === 0 || value == null) return null;
    if (step > 1 && index % step !== 0) return null;
    const prev = data[index - 1]?.revenue;
    const label = growthLabel(value, prev);
    if (!label) return null;
    const isPos = !label.startsWith("-");
    return (
      <text
        x={x + width / 2}
        y={y - 5}
        textAnchor="middle"
        style={{
          fontSize: data.length > 14 ? 7 : data.length > 8 ? 8 : 9,
          fontWeight: 700,
          fill: isPos ? "#10b981" : "#ef4444",
        }}
      >
        {label}
      </text>
    );
  };
}

/* ── Custom bar label showing YoY growth ── */
function renderGrowthLabel(data, dataKey) {
  // Skip labels every N bars when data is dense
  const step = data.length > 15 ? 4 : data.length > 10 ? 3 : data.length > 7 ? 2 : 1;
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
  const [expandedChart, setExpandedChart] = useState(null);
  const toggle = useCallback((id) => setExpandedChart(prev => prev === id ? null : id), []);
  useEffect(() => {
    if (!expandedChart) return;
    const handler = (e) => { if (e.key === "Escape") setExpandedChart(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [expandedChart]);
  const annualRows = buildSeries(data);
  const quarterlyRows = buildQuarterlySeries(data);
  const hasQuarterly = quarterlyRows.length > 0;
  const rows = quarterly && hasQuarterly ? quarterlyRows : annualRows;
  const cs = getCurrencySymbol(currency);
  if (!annualRows.length) return (
    <div style={{
      background: "var(--card)",
      borderRadius: 14,
      padding: "32px 24px",
      textAlign: "center",
      boxShadow: "0 2px 12px rgba(0,0,0,.06), 0 0 0 1px var(--border)",
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

  const n = rows.length;
  const many = n > 10;
  const axisStyle = { fontSize: 10, fill: "var(--muted)" };
  const gridProps = { strokeDasharray: "3 3", stroke: "var(--border)", strokeOpacity: 0.6 };
  const yearTick = quarterly
    ? quarterLabel
    : (val) => `'${String(val).slice(-2)}`;
  const barGap = many ? "8%" : "20%";
  const dotRadius = many ? 2 : 3;
  const activeDotRadius = many ? 4 : 5;
  const strokeW = many ? 2 : 2.5;
  const xInterval = n <= 8 ? 0 : n <= 14 ? 1 : n <= 20 ? 2 : 3;
  const xAxisProps = {
    dataKey: "year", tickLine: false, axisLine: false,
    interval: xInterval,
    tickFormatter: yearTick,
    tick: axisStyle,
    height: 22,
  };

  const shortHistory = !quarterly && rows.length > 0 && rows.length <= 5;

  // Verdicts (fond vert/rouge)
  const v = !quarterly ? {
    revenue: (() => { const r = cagr5Rate(rows, "revenue"); return r != null ? r >= 0.10 : null; })(),
    fcf: (() => { const r = cagr5Rate(rows, "fcf"); return r != null ? r >= 0.10 : null; })(),
    fcfShare: null,
    roce: (() => { const a = avg5(rows, "roce"); return a != null ? a >= 0.15 : null; })(),
    fcfMargin: (() => { const a = avg5(rows, "fcfMargin"); return a != null ? a >= 0.10 : null; })(),
    shares: (() => {
      const valid = rows.filter(r => r.shares != null && r.shares > 0);
      if (valid.length < 2) return null;
      const last = valid[valid.length - 1];
      const start = valid.find(r => r.year === String(Number(last.year) - 5));
      if (!start) return null;
      const growth = (last.shares - start.shares) / start.shares;
      return growth <= 0;
    })(),
    debt: (() => { const last = rows[rows.length - 1]; return last?.debtRepayYears != null ? last.debtRepayYears <= 3 : null; })(),
  } : {};

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))",
        gap: 8,
        marginBottom: 12,
      }}
    >
      {/* Toggle annuel / trimestriel */}
      {hasQuarterly && (
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
          <div style={{
            display: "inline-flex",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 3,
            gap: 2,
          }}>
            {["Annuel", "Trimestriel"].map((label, i) => {
              const isActive = i === 0 ? !quarterly : quarterly;
              return (
                <button
                  key={label}
                  onClick={() => setQuarterly(i === 1)}
                  style={{
                    padding: "5px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 7,
                    border: "none",
                    background: isActive ? "var(--accent, #2563eb)" : "transparent",
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
        </div>
      )}
      {shortHistory && (
        <div
          style={{
            gridColumn: "1 / -1",
            background: "var(--card)",
            boxShadow: "0 2px 12px rgba(0,0,0,.06), 0 0 0 1px var(--border)",
            borderRadius: 10,
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
      <ChartCard title="Chiffre d'affaires" subtitle={quarterly ? "Évolution trimestrielle du CA" : "Évolution annuelle du CA"} accentColor="#0891b2" cagrLabels={quarterly ? undefined : cagrMulti(rows, "revenue")} cagrLabel={quarterly ? cagr(rows, "revenue", true) : undefined} expanded={expandedChart === "revenue"} onToggle={() => toggle("revenue")} verdict={v.revenue}>
        <ResponsiveContainer>
          <BarChart data={rows} barCategoryGap={many ? "12%" : "18%"}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis {...xAxisProps} />
            <YAxis tickFormatter={compact} tick={axisStyle} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<BaggrTooltip />} />
            <Bar dataKey="revenue" fill="var(--accent, #2563eb)" shape={<RoundedBar />} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 2. Free Cash Flow & SBC */}
      <ChartCard title="Free Cash Flow & SBC" subtitle={quarterly ? "FCF vs SBC trimestriel" : "FCF vs rémunération en actions"} accentColor="#0d9488" cagrLabels={quarterly ? undefined : cagrMulti(rows, "fcf")} cagrLabel={quarterly ? cagr(rows, "fcf", true) : undefined} expanded={expandedChart === "fcf"} onToggle={() => toggle("fcf")} verdict={v.fcf}>
        <ResponsiveContainer>
          <BarChart data={rows} barCategoryGap={barGap}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis tickFormatter={compact} tick={axisStyle} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<BaggrTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, fontWeight: 500 }}
              iconType="circle"
              iconSize={6}
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

      {/* 4. ROCE */}
      <ChartCard title="ROCE" subtitle={quarterly ? "ROCE trimestriel" : "Return on Capital Employed"} accentColor="#ea580c" expanded={expandedChart === "roce"} onToggle={() => toggle("roce")} verdict={v.roce}>
        <ResponsiveContainer>
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="gradRoce" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ea580c" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ea580c" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis tickFormatter={pct} tick={axisStyle} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<BaggrTooltip fmt={pct} />} />
            <ReferenceLine y={0.15} stroke="#ea580c" strokeDasharray="4 4" strokeOpacity={0.4} />
            <Area
              type="monotone"
              dataKey="roce"
              stroke="#ea580c"
              strokeWidth={strokeW}
              fill="url(#gradRoce)"
              connectNulls
              dot={{ r: dotRadius, fill: "#ea580c", strokeWidth: 0 }}
              activeDot={{ r: activeDotRadius, stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 5. Marge de FCF */}
      <ChartCard title="Marge de Free Cash Flow" subtitle={quarterly ? "FCF / CA (trimestriel)" : "FCF / Chiffre d'affaires"} accentColor="#16a34a" expanded={expandedChart === "fcfMargin"} onToggle={() => toggle("fcfMargin")} verdict={v.fcfMargin}>
        <ResponsiveContainer>
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="gradFcfMargin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis tickFormatter={pct} tick={axisStyle} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<BaggrTooltip fmt={pct} />} />
            <Area
              type="monotone"
              dataKey="fcfMargin"
              stroke="#16a34a"
              strokeWidth={strokeW}
              fill="url(#gradFcfMargin)"
              connectNulls
              dot={{ r: dotRadius, fill: "#16a34a", strokeWidth: 0 }}
              activeDot={{ r: activeDotRadius, stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 6. Actions en circulation */}
      <ChartCard title="Actions en circulation" subtitle={quarterly ? "Actions diluées (trimestriel)" : "Nombre d'actions diluées"} accentColor="#6366f1" expanded={expandedChart === "shares"} onToggle={() => toggle("shares")} verdict={v.shares}>
        <ResponsiveContainer>
          <BarChart data={rows} barCategoryGap={many ? "12%" : "18%"}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis {...xAxisProps} />
            <YAxis tickFormatter={compact} tick={axisStyle} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<BaggrTooltip />} />
            <Bar dataKey="shares" fill="var(--accent, #2563eb)" shape={<RoundedBar />} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 7. Délai de remboursement */}
      <ChartCard title="Remboursement dette" subtitle={quarterly ? "Dette nette / FCF (trimestriel)" : "Années pour rembourser la dette nette avec le FCF"} accentColor="#0891b2" expanded={expandedChart === "debtRepay"} onToggle={() => toggle("debtRepay")} verdict={v.debt}>
        <ResponsiveContainer>
          <BarChart data={rows} barCategoryGap={many ? "12%" : "18%"}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={52}
              tickFormatter={(v) => v != null ? `${v.toFixed(0)} ans` : ""} />
            <Tooltip content={<BaggrTooltip fmt={(v) => v != null ? (v === 0 ? "Tréso. nette positive" : `${v.toFixed(1)} ans`) : "—"} />} />
            <ReferenceLine y={3} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: "3 ans", position: "right", fill: "var(--muted)", fontSize: 9 }} />
            <Bar dataKey="debtRepayYears" name="Années" shape={<RoundedBar />}>
              {rows.map((d) => (
                <Cell key={d.year} fill={d.debtRepayYears == null ? "#94a3b8" : d.debtRepayYears <= 3 ? "#10b981" : d.debtRepayYears <= 7 ? "#f59e0b" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 7. FCF par action — pleine largeur */}
      <ChartCard title="Free Cash Flow par action" subtitle={quarterly ? "FCF / action (trimestriel)" : "FCF / actions diluées"} accentColor="#2563eb" cagrLabels={quarterly ? undefined : cagrMulti(rows, "fcfPerShare")} cagrLabel={quarterly ? cagr(rows, "fcfPerShare", true) : undefined} expanded={expandedChart === "fcfShare"} onToggle={() => toggle("fcfShare")} verdict={v.fcfShare} wide>
        <ResponsiveContainer>
          <BarChart data={rows} barCategoryGap={many ? "12%" : "18%"}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis {...xAxisProps} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={52}
              tickFormatter={(val) => val != null ? `${cs}${val.toFixed(1)}` : ""} />
            <Tooltip content={<BaggrTooltip fmt={(val) => val != null ? `${cs}${val.toFixed(2)}` : "—"} />} />
            <Bar dataKey="fcfPerShare" fill="var(--accent, #2563eb)" shape={<RoundedBar />} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

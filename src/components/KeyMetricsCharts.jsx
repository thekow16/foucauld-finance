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

/* ── Helpers ── */

function compact(v) {
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

/* ── Data builder (10 dernières années) ── */

function buildSeries(data) {
  const fmp = data?._fmpData;

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

    return [...byYear.values()]
      .map((d) => enrich(d))
      .filter((d) => d.year)
      .sort((a, b) => String(a.year).localeCompare(String(b.year)))
      .slice(-10);
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

  return [...byYear.values()]
    .map((d) => enrich(d))
    .filter((d) => d.year)
    .sort((a, b) => String(a.year).localeCompare(String(b.year)))
    .slice(-10);
}

function enrich(d) {
  const investedCapital =
    d.assets != null && d.currentLiabilities != null ? d.assets - d.currentLiabilities : null;
  const roce = investedCapital && d.ebit != null ? d.ebit / investedCapital : null;
  const fcfMargin = d.fcf != null && d.revenue ? d.fcf / d.revenue : null;
  const fcfPerShare = d.fcf != null && d.shares ? d.fcf / d.shares : null;
  return { ...d, roce, fcfMargin, fcfPerShare };
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
      <div style={{ fontWeight: 800, marginBottom: 6, color: "var(--text)" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name || p.dataKey} style={{ color: p.color, fontWeight: 600, marginBottom: 2 }}>
          {p.name || p.dataKey}: {fmt ? fmt(p.value) : compact(p.value)}
        </div>
      ))}
    </div>
  );
}

/* ── Chart card with Baggr-style header ── */
function ChartCard({ title, subtitle, accentColor, children }) {
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
        <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", letterSpacing: "-0.2px" }}>
          {title}
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
  return (props) => {
    const { x, y, width, index, value } = props;
    if (index === 0 || value == null) return null;
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
          fontSize: 9,
          fontWeight: 700,
          fill: isPos ? "#10b981" : "#ef4444",
        }}
      >
        {label}
      </text>
    );
  };
}

/* ── Main Component ── */

export default function KeyMetricsCharts({ data }) {
  const rows = buildSeries(data);
  if (!rows.length) return null;

  const axisStyle = { fontSize: 10, fill: "var(--muted)" };
  const gridProps = { strokeDasharray: "3 3", stroke: "var(--border)", strokeOpacity: 0.6 };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16,
        marginBottom: 16,
      }}
    >
      {/* 1. Chiffre d'affaires */}
      <ChartCard title="Chiffre d'affaires" subtitle="Évolution annuelle du CA" accentColor="#0891b2">
        <ResponsiveContainer>
          <BarChart data={rows} barCategoryGap="20%">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" tick={axisStyle} tickLine={false} axisLine={false} />
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
      <ChartCard title="Free Cash Flow & SBC" subtitle="FCF vs rémunération en actions" accentColor="#0d9488">
        <ResponsiveContainer>
          <BarChart data={rows} barCategoryGap="20%">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" tick={axisStyle} tickLine={false} axisLine={false} />
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
      <ChartCard title="Free Cash Flow par action" subtitle="FCF / actions diluées" accentColor="#2563eb">
        <ResponsiveContainer>
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="gradFcfShare" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" tick={axisStyle} tickLine={false} axisLine={false} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={52}
              tickFormatter={(v) => v != null ? `$${v.toFixed(1)}` : ""} />
            <Tooltip content={<BaggrTooltip fmt={(v) => v != null ? `$${v.toFixed(2)}` : "—"} />} />
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
      <ChartCard title="ROCE" subtitle="Return on Capital Employed" accentColor="#ea580c">
        <ResponsiveContainer>
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="gradRoce" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ea580c" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ea580c" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" tick={axisStyle} tickLine={false} axisLine={false} />
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
      <ChartCard title="Marge de Free Cash Flow" subtitle="FCF / Chiffre d'affaires" accentColor="#16a34a">
        <ResponsiveContainer>
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="gradFcfMargin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" tick={axisStyle} tickLine={false} axisLine={false} />
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
      <ChartCard title="Actions en circulation" subtitle="Nombre d'actions diluées" accentColor="#6366f1">
        <ResponsiveContainer>
          <BarChart data={rows} barCategoryGap="20%">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" tick={axisStyle} tickLine={false} axisLine={false} />
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
      <ChartCard title="Cash & Dette" subtitle="Trésorerie vs dette totale" accentColor="#14b8a6">
        <ResponsiveContainer>
          <BarChart data={rows} barCategoryGap="20%">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" tick={axisStyle} tickLine={false} axisLine={false} />
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
    </div>
  );
}

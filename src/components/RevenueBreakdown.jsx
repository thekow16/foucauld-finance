import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { hasFmpApiKey, fetchRevenueProductSegmentation, fetchRevenueGeoSegmentation } from "../utils/fmpApi";

/* ── Palette de couleurs ── */
const COLORS = [
  "#4f46e5", "#0891b2", "#10b981", "#f59e0b", "#ef4444",
  "#7c3aed", "#ec4899", "#14b8a6", "#ea580c", "#6366f1",
  "#84cc16", "#06b6d4", "#8b5cf6", "#f97316", "#64748b",
];

/* ── Formatage compact ── */
function compact(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)} T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)} Md`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)} M`;
  return `${sign}${abs.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}`;
}

/* ── Parse FMP segment response ── */
function parseSegments(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const latest = raw[0];
  if (!latest || typeof latest !== "object") return null;

  const entries = [];
  const date = latest.date;
  const segments = { ...latest };
  delete segments.date;

  for (const [name, value] of Object.entries(segments)) {
    if (value != null && typeof value === "number" && value > 0) {
      entries.push({ name, value });
    }
  }

  if (entries.length === 0) return null;
  entries.sort((a, b) => b.value - a.value);

  const total = entries.reduce((s, e) => s + e.value, 0);
  return {
    date,
    total,
    items: entries.map((e, i) => ({
      ...e,
      pct: ((e.value / total) * 100).toFixed(1),
      color: COLORS[i % COLORS.length],
    })),
  };
}

/* ── Build breakdown from income statement (fallback) ── */
function buildRevenueStructure(data) {
  const fmp = data?._fmpData;
  const inc = fmp?.income?.[0];

  if (inc?.revenue) {
    // Use FMP income statement
    const items = [];
    if (inc.costOfRevenue > 0) items.push({ name: "Coût des ventes", value: inc.costOfRevenue });
    if (inc.researchAndDevelopmentExpenses > 0) items.push({ name: "R&D", value: inc.researchAndDevelopmentExpenses });
    if (inc.sellingGeneralAndAdministrativeExpenses > 0) items.push({ name: "Frais généraux (SGA)", value: inc.sellingGeneralAndAdministrativeExpenses });
    const knownCosts = items.reduce((s, e) => s + e.value, 0);
    const opIncome = inc.operatingIncome;
    if (opIncome > 0) {
      items.push({ name: "Résultat opérationnel", value: opIncome });
    } else {
      const other = inc.revenue - knownCosts;
      if (other > 0) items.push({ name: "Autres", value: other });
      if (opIncome != null && opIncome <= 0) items.push({ name: "Pertes opérationnelles", value: Math.abs(opIncome) });
    }

    if (items.length < 2) return null;
    const total = inc.revenue;
    return {
      date: inc.calendarYear || inc.date?.slice(0, 4),
      total,
      items: items.map((e, i) => ({
        ...e,
        pct: ((e.value / total) * 100).toFixed(1),
        color: COLORS[i % COLORS.length],
      })),
    };
  }

  // Yahoo fallback
  const incArr = data?.incomeStatementHistory?.incomeStatementHistory;
  const latest = incArr?.[0];
  if (!latest?.totalRevenue?.raw) return null;

  const revenue = latest.totalRevenue.raw;
  const items = [];
  if (latest.costOfRevenue?.raw > 0) items.push({ name: "Coût des ventes", value: latest.costOfRevenue.raw });
  if (latest.researchDevelopment?.raw > 0) items.push({ name: "R&D", value: latest.researchDevelopment.raw });
  if (latest.sellingGeneralAdministrative?.raw > 0) items.push({ name: "Frais généraux (SGA)", value: latest.sellingGeneralAdministrative.raw });
  const knownCosts = items.reduce((s, e) => s + e.value, 0);
  const opIncome = latest.operatingIncome?.raw;
  if (opIncome > 0) {
    items.push({ name: "Résultat opérationnel", value: opIncome });
  } else {
    const other = revenue - knownCosts;
    if (other > 0) items.push({ name: "Autres", value: other });
  }

  if (items.length < 2) return null;
  return {
    date: latest.endDate?.raw ? new Date(latest.endDate.raw * 1000).getFullYear() : null,
    total: revenue,
    items: items.map((e, i) => ({
      ...e,
      pct: ((e.value / revenue) * 100).toFixed(1),
      color: COLORS[i % COLORS.length],
    })),
  };
}

function buildProfitabilityBreakdown(data) {
  const fmp = data?._fmpData;
  const inc = fmp?.income?.[0];

  if (inc?.revenue && inc?.grossProfit) {
    const items = [];
    if (inc.grossProfit > 0) items.push({ name: "Marge brute", value: inc.grossProfit });
    if (inc.operatingIncome > 0) items.push({ name: "Résultat opérationnel", value: inc.operatingIncome });
    if (inc.netIncome > 0) items.push({ name: "Résultat net", value: inc.netIncome });

    // Add what's "lost" between levels
    const grossToOp = inc.grossProfit - (inc.operatingIncome || 0);
    if (grossToOp > 0) items.push({ name: "Charges opérationnelles", value: grossToOp });
    const cogsVal = inc.costOfRevenue;
    if (cogsVal > 0) items.push({ name: "Coût des ventes", value: cogsVal });

    if (items.length < 2) return null;
    items.sort((a, b) => b.value - a.value);
    const total = inc.revenue;
    return {
      date: inc.calendarYear || inc.date?.slice(0, 4),
      total,
      items: items.map((e, i) => ({
        ...e,
        pct: ((e.value / total) * 100).toFixed(1),
        color: COLORS[i % COLORS.length],
      })),
    };
  }

  // Yahoo fallback
  const incArr = data?.incomeStatementHistory?.incomeStatementHistory;
  const latest = incArr?.[0];
  if (!latest?.totalRevenue?.raw || !latest?.grossProfit?.raw) return null;

  const revenue = latest.totalRevenue.raw;
  const items = [];
  if (latest.grossProfit?.raw > 0) items.push({ name: "Marge brute", value: latest.grossProfit.raw });
  if (latest.operatingIncome?.raw > 0) items.push({ name: "Résultat opérationnel", value: latest.operatingIncome.raw });
  if (latest.netIncome?.raw > 0) items.push({ name: "Résultat net", value: latest.netIncome.raw });
  if (latest.costOfRevenue?.raw > 0) items.push({ name: "Coût des ventes", value: latest.costOfRevenue.raw });
  const grossToOp = (latest.grossProfit?.raw || 0) - (latest.operatingIncome?.raw || 0);
  if (grossToOp > 0) items.push({ name: "Charges opérationnelles", value: grossToOp });

  if (items.length < 2) return null;
  items.sort((a, b) => b.value - a.value);
  return {
    date: latest.endDate?.raw ? new Date(latest.endDate.raw * 1000).getFullYear() : null,
    total: revenue,
    items: items.map((e, i) => ({
      ...e,
      pct: ((e.value / revenue) * 100).toFixed(1),
      color: COLORS[i % COLORS.length],
    })),
  };
}

/* ── Custom tooltip ── */
function SegmentTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
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
      <div style={{ fontWeight: 700, color: d.payload.color, marginBottom: 2 }}>
        {d.name}
      </div>
      <div style={{ color: "var(--text)", fontWeight: 600 }}>
        {compact(d.value)} ({d.payload.pct}%)
      </div>
    </div>
  );
}

/* ── Custom label on pie ── */
function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, pct }) {
  if (parseFloat(pct) < 5) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 700, fill: "#fff" }}
    >
      {pct}%
    </text>
  );
}

/* ── Pie Card ── */
function PieCard({ title, subtitle, accentColor, data }) {
  if (!data || !data.items?.length) return null;

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
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", letterSpacing: "-0.2px" }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontWeight: 500 }}>
            {subtitle} {data.total ? `· Total: ${compact(data.total)}` : ""}
          </div>
        )}
      </div>

      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data.items}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="35%"
              outerRadius="70%"
              paddingAngle={2}
              label={renderLabel}
              labelLine={false}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {data.items.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<SegmentTooltip />} />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              wrapperStyle={{ fontSize: 11, fontWeight: 600, lineHeight: "22px" }}
              iconType="circle"
              iconSize={8}
              formatter={(value, entry) => (
                <span style={{ color: "var(--text)" }}>
                  {value} <span style={{ color: "var(--muted)", fontWeight: 500 }}>({entry.payload.pct}%)</span>
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {data.date && (
        <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", marginTop: 4 }}>
          Données {data.date}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function RevenueBreakdown({ data, symbol }) {
  const [productData, setProductData] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Fallback data from income statement (always available)
  const revenueStructure = buildRevenueStructure(data);
  const profitBreakdown = buildProfitabilityBreakdown(data);

  useEffect(() => {
    // Try FMP segment data
    const fmp = data?._fmpData;
    if (fmp?.productSegments?.length || fmp?.geoSegments?.length) {
      setProductData(parseSegments(fmp.productSegments));
      setGeoData(parseSegments(fmp.geoSegments));
      setLoaded(true);
      return;
    }

    if (!hasFmpApiKey() || !symbol) {
      setLoaded(true);
      return;
    }

    Promise.all([
      fetchRevenueProductSegmentation(symbol).catch(() => []),
      fetchRevenueGeoSegmentation(symbol).catch(() => []),
    ]).then(([prod, geo]) => {
      setProductData(parseSegments(prod));
      setGeoData(parseSegments(geo));
      setLoaded(true);
    });
  }, [symbol, data]);

  const hasSegments = productData || geoData;
  const hasFallback = revenueStructure || profitBreakdown;

  if (!hasSegments && !hasFallback) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
        gap: 16,
        marginBottom: 16,
      }}
    >
      {/* FMP segment data (if available) */}
      {productData && (
        <PieCard
          title="Répartition du CA par segment"
          subtitle="Comment l'entreprise gagne son argent"
          accentColor="#4f46e5"
          data={productData}
        />
      )}
      {geoData && (
        <PieCard
          title="Répartition géographique du CA"
          subtitle="Dans quels pays / régions"
          accentColor="#0891b2"
          data={geoData}
        />
      )}

      {/* Fallback: income statement breakdown (always available) */}
      {revenueStructure && (
        <PieCard
          title="Structure du chiffre d'affaires"
          subtitle="Répartition des coûts et du résultat"
          accentColor="#10b981"
          data={revenueStructure}
        />
      )}
      {profitBreakdown && (
        <PieCard
          title="Cascade de rentabilité"
          subtitle="Du CA au résultat net"
          accentColor="#7c3aed"
          data={profitBreakdown}
        />
      )}
    </div>
  );
}

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

const COLORS = [
  "#4f46e5", "#0891b2", "#10b981", "#f59e0b", "#ef4444",
  "#7c3aed", "#ec4899", "#14b8a6", "#ea580c", "#6366f1",
  "#84cc16", "#06b6d4", "#8b5cf6", "#f97316", "#64748b",
];

function compact(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)} T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)} Md`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)} M`;
  return `${sign}${abs.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}`;
}

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

/* ── Helpers to extract a value from FMP or Yahoo ── */
function val(fmpVal, yahooObj) {
  if (fmpVal != null && fmpVal !== 0) return fmpVal;
  if (yahooObj?.raw != null) return yahooObj.raw;
  return null;
}

/* ── Build "Structure du CA" pie from whatever data we have ── */
function buildRevenueStructure(data) {
  const fmp = data?._fmpData?.income?.[0];
  const yInc = data?.incomeStatementHistory?.incomeStatementHistory?.[0];

  const revenue = val(fmp?.revenue, yInc?.totalRevenue);
  if (!revenue || revenue <= 0) return null;

  const cogs = val(fmp?.costOfRevenue, yInc?.costOfRevenue);
  const rd = val(fmp?.researchAndDevelopmentExpenses, yInc?.researchDevelopment);
  const sga = val(fmp?.sellingGeneralAndAdministrativeExpenses, yInc?.sellingGeneralAdministrative);
  const opIncome = val(fmp?.operatingIncome, yInc?.operatingIncome);
  const grossProfit = val(fmp?.grossProfit, yInc?.grossProfit);

  const items = [];

  if (cogs > 0) items.push({ name: "Coût des ventes", value: cogs });
  if (rd > 0) items.push({ name: "R&D", value: rd });
  if (sga > 0) items.push({ name: "Frais généraux (SGA)", value: sga });

  // If we have detailed costs, add operating income as remainder
  if (items.length >= 1 && opIncome > 0) {
    const knownCosts = items.reduce((s, e) => s + e.value, 0);
    const otherCosts = revenue - knownCosts - opIncome;
    if (otherCosts > 0) items.push({ name: "Autres charges", value: otherCosts });
    items.push({ name: "Résultat opérationnel", value: opIncome });
  } else if (grossProfit > 0 && cogs > 0) {
    // Minimal: just COGS vs Gross Profit
    // Remove cogs if already added, rebuild
    items.length = 0;
    items.push({ name: "Coût des ventes", value: cogs });
    if (opIncome > 0) {
      const opex = grossProfit - opIncome;
      if (opex > 0) items.push({ name: "Charges opérationnelles", value: opex });
      items.push({ name: "Résultat opérationnel", value: opIncome });
    } else {
      items.push({ name: "Marge brute", value: grossProfit });
    }
  }

  if (items.length < 2) return null;

  const total = items.reduce((s, e) => s + e.value, 0);
  const year = fmp?.calendarYear || fmp?.date?.slice(0, 4) ||
    (yInc?.endDate?.raw ? new Date(yInc.endDate.raw * 1000).getFullYear() : null);

  return {
    date: year,
    total: revenue,
    items: items.map((e, i) => ({
      ...e,
      pct: ((e.value / revenue) * 100).toFixed(1),
      color: COLORS[i % COLORS.length],
    })),
  };
}

/* ── Build "Cascade de rentabilité" ── */
function buildProfitCascade(data) {
  const fmp = data?._fmpData?.income?.[0];
  const yCf = data?._fmpData?.cashflow?.[0];
  const yInc = data?.incomeStatementHistory?.incomeStatementHistory?.[0];
  const yCash = data?.cashflowStatementHistory?.cashflowStatements?.[0];

  const revenue = val(fmp?.revenue, yInc?.totalRevenue);
  if (!revenue || revenue <= 0) return null;

  const grossProfit = val(fmp?.grossProfit, yInc?.grossProfit);
  const opIncome = val(fmp?.operatingIncome, yInc?.operatingIncome);
  const netIncome = val(fmp?.netIncome, yInc?.netIncome);
  const fcf = val(yCf?.freeCashFlow, yCash?.freeCashFlow);

  const items = [];
  if (grossProfit > 0) items.push({ name: "Marge brute", value: grossProfit });
  if (opIncome > 0) items.push({ name: "Résultat opérationnel", value: opIncome });
  if (netIncome > 0) items.push({ name: "Résultat net", value: netIncome });
  if (fcf > 0) items.push({ name: "Free Cash Flow", value: fcf });

  if (items.length < 2) return null;

  const year = fmp?.calendarYear || fmp?.date?.slice(0, 4) ||
    (yInc?.endDate?.raw ? new Date(yInc.endDate.raw * 1000).getFullYear() : null);

  return {
    date: year,
    total: revenue,
    items: items.map((e, i) => ({
      ...e,
      pct: ((e.value / revenue) * 100).toFixed(1),
      color: ["#4f46e5", "#f59e0b", "#10b981", "#0891b2"][i] || COLORS[i],
    })),
  };
}

/* ── Tooltip ── */
function SegmentTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "10px 14px",
      boxShadow: "0 4px 16px rgba(0,0,0,.12)", fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, color: d.payload.color, marginBottom: 2 }}>{d.name}</div>
      <div style={{ color: "var(--text)", fontWeight: 600 }}>
        {compact(d.value)} ({d.payload.pct}%)
      </div>
    </div>
  );
}

/* ── Label ── */
function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, pct }) {
  if (parseFloat(pct) < 5) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 700, fill: "#fff" }}>
      {pct}%
    </text>
  );
}

/* ── Pie Card ── */
function PieCard({ title, subtitle, accentColor, data }) {
  if (!data?.items?.length) return null;
  return (
    <div style={{
      background: "var(--card)", borderRadius: 16,
      padding: "20px 18px 16px",
      boxShadow: "0 1px 4px var(--shadow)",
      border: "1px solid var(--border)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: 3, background: accentColor,
        borderRadius: "16px 16px 0 0",
      }} />
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", letterSpacing: "-0.2px" }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontWeight: 500 }}>
          {subtitle} {data.total ? `· CA total: ${compact(data.total)}` : ""}
        </div>
      </div>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data.items} dataKey="value" nameKey="name"
              cx="50%" cy="50%" innerRadius="35%" outerRadius="70%"
              paddingAngle={2} label={renderLabel} labelLine={false}
              stroke="var(--card)" strokeWidth={2}>
              {data.items.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<SegmentTooltip />} />
            <Legend layout="vertical" align="right" verticalAlign="middle"
              wrapperStyle={{ fontSize: 11, fontWeight: 600, lineHeight: "22px" }}
              iconType="circle" iconSize={8}
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

/* ── Main ── */
export default function RevenueBreakdown({ data, symbol }) {
  const [productData, setProductData] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const revenueStructure = buildRevenueStructure(data);
  const profitCascade = buildProfitCascade(data);

  useEffect(() => {
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

  const hasAnything = productData || geoData || revenueStructure || profitCascade;
  if (!hasAnything) return null;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
      gap: 16, marginBottom: 16,
    }}>
      {productData && (
        <PieCard title="Répartition du CA par segment"
          subtitle="Comment l'entreprise gagne son argent"
          accentColor="#4f46e5" data={productData} />
      )}
      {geoData && (
        <PieCard title="Répartition géographique du CA"
          subtitle="Dans quels pays / régions"
          accentColor="#0891b2" data={geoData} />
      )}
      <PieCard title="Structure du chiffre d'affaires"
        subtitle="Répartition coûts & résultat"
        accentColor="#10b981" data={revenueStructure} />
      <PieCard title="Cascade de rentabilité"
        subtitle="Du CA au Free Cash Flow"
        accentColor="#7c3aed" data={profitCascade} />
    </div>
  );
}

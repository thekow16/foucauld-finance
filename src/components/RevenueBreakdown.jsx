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
  // FMP returns array of objects: [{ "date": "2024-...", "iPhone": 123, "Mac": 456, ... }]
  // Take most recent entry
  const latest = raw[0];
  if (!latest || typeof latest !== "object") return null;

  // The object has a date key and then segment keys with numeric values
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

  // Sort by value descending
  entries.sort((a, b) => b.value - a.value);

  // Calculate percentages
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
function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, pct, name }) {
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
  if (!data) return null;

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
            {subtitle}
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
              {data.items.map((entry, i) => (
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
          Données au {data.date}
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

  useEffect(() => {
    // First try from _fmpData if already fetched
    const fmp = data?._fmpData;
    if (fmp?.productSegments?.length || fmp?.geoSegments?.length) {
      setProductData(parseSegments(fmp.productSegments));
      setGeoData(parseSegments(fmp.geoSegments));
      setLoaded(true);
      return;
    }

    // Otherwise fetch directly if FMP key available
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

  if (!loaded) return null;
  if (!productData && !geoData) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
        gap: 16,
        marginBottom: 16,
      }}
    >
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
    </div>
  );
}

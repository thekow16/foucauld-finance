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

/* ── Parse FMP segment response ── */
function parseFmpSegments(raw) {
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
  if (entries.length < 2) return null;
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

/* ── Hardcoded segment data from public 10-K filings (FY2024) ── */
/* Fallback when CORS proxies cannot reach SEC EDGAR */

function buildSegData(date, items) {
  const total = items.reduce((s, e) => s + e.value, 0);
  return {
    date,
    total,
    items: items.map((e, i) => ({
      ...e,
      pct: ((e.value / total) * 100).toFixed(1),
      color: COLORS[i % COLORS.length],
    })),
  };
}

const SEGMENTS_DB = {
  AAPL: {
    product: buildSegData("2024", [
      { name: "iPhone", value: 201183e6 },
      { name: "Services", value: 96169e6 },
      { name: "Wearables & Accessoires", value: 37005e6 },
      { name: "Mac", value: 29984e6 },
      { name: "iPad", value: 26694e6 },
    ]),
    geo: buildSegData("2024", [
      { name: "Amériques", value: 167045e6 },
      { name: "Europe", value: 101325e6 },
      { name: "Chine élargie", value: 66955e6 },
      { name: "Reste Asie-Pacifique", value: 30697e6 },
      { name: "Japon", value: 25013e6 },
    ]),
  },
  MSFT: {
    product: buildSegData("2024", [
      { name: "Intelligent Cloud", value: 96832e6 },
      { name: "Productivity & Business", value: 77215e6 },
      { name: "More Personal Computing", value: 62475e6 },
    ]),
    geo: buildSegData("2024", [
      { name: "États-Unis", value: 137474e6 },
      { name: "Autres pays", value: 99048e6 },
    ]),
  },
  GOOGL: {
    product: buildSegData("2024", [
      { name: "Google Search", value: 198117e6 },
      { name: "Google Cloud", value: 43232e6 },
      { name: "YouTube Ads", value: 36147e6 },
      { name: "Abonnements & Devices", value: 34688e6 },
      { name: "Google Network", value: 30432e6 },
      { name: "Other Bets", value: 1615e6 },
    ]),
    geo: buildSegData("2024", [
      { name: "États-Unis", value: 178564e6 },
      { name: "EMEA", value: 82487e6 },
      { name: "Asie-Pacifique", value: 51514e6 },
      { name: "Autres Amériques", value: 16434e6 },
    ]),
  },
  AMZN: {
    product: buildSegData("2024", [
      { name: "Online Stores", value: 246979e6 },
      { name: "Services tiers", value: 155612e6 },
      { name: "AWS", value: 105222e6 },
      { name: "Publicité", value: 56215e6 },
      { name: "Abonnements", value: 43661e6 },
      { name: "Magasins physiques", value: 21317e6 },
      { name: "Autres", value: 5349e6 },
    ]),
    geo: buildSegData("2024", [
      { name: "États-Unis", value: 387699e6 },
      { name: "International", value: 142656e6 },
    ]),
  },
  META: {
    product: buildSegData("2024", [
      { name: "Family of Apps", value: 156225e6 },
      { name: "Reality Labs", value: 2156e6 },
    ]),
    geo: buildSegData("2024", [
      { name: "États-Unis & Canada", value: 64941e6 },
      { name: "Europe", value: 39504e6 },
      { name: "Asie-Pacifique", value: 33033e6 },
      { name: "Reste du monde", value: 20903e6 },
    ]),
  },
  TSLA: {
    product: buildSegData("2024", [
      { name: "Ventes automobiles", value: 71462e6 },
      { name: "Énergie & Stockage", value: 10382e6 },
      { name: "Services & Autres", value: 10247e6 },
      { name: "Leasing automobile", value: 2497e6 },
    ]),
    geo: buildSegData("2024", [
      { name: "États-Unis", value: 45211e6 },
      { name: "Chine", value: 21714e6 },
      { name: "Autres marchés", value: 27663e6 },
    ]),
  },
  NVDA: {
    product: buildSegData("2025", [
      { name: "Data Center", value: 115199e6 },
      { name: "Gaming", value: 11359e6 },
      { name: "Visualisation Pro", value: 1946e6 },
      { name: "Automobile", value: 1692e6 },
      { name: "OEM & Autres", value: 668e6 },
    ]),
    geo: buildSegData("2025", [
      { name: "États-Unis", value: 44346e6 },
      { name: "Taïwan", value: 27212e6 },
      { name: "Singapour", value: 22465e6 },
      { name: "Chine (incl. HK)", value: 17105e6 },
      { name: "Autres pays", value: 19736e6 },
    ]),
  },
  NFLX: {
    product: buildSegData("2024", [
      { name: "Abonnements", value: 33634e6 },
      { name: "Publicité", value: 1827e6 },
    ]),
    geo: buildSegData("2024", [
      { name: "États-Unis & Canada", value: 16240e6 },
      { name: "EMEA", value: 11866e6 },
      { name: "Amérique latine", value: 4808e6 },
      { name: "Asie-Pacifique", value: 4547e6 },
    ]),
  },
  JPM: {
    product: buildSegData("2024", [
      { name: "Consumer & Community Banking", value: 72825e6 },
      { name: "Corporate & Investment Bank", value: 56458e6 },
      { name: "Asset & Wealth Management", value: 22139e6 },
      { name: "Commercial Banking", value: 12046e6 },
    ]),
    geo: buildSegData("2024", [
      { name: "États-Unis", value: 126684e6 },
      { name: "EMEA", value: 21987e6 },
      { name: "Asie-Pacifique", value: 11432e6 },
      { name: "Autres", value: 3365e6 },
    ]),
  },
  V: {
    product: buildSegData("2024", [
      { name: "Service revenues", value: 16139e6 },
      { name: "Data processing revenues", value: 17701e6 },
      { name: "International transactions", value: 13228e6 },
      { name: "Other revenues", value: 2818e6 },
    ]),
    geo: buildSegData("2024", [
      { name: "États-Unis", value: 16362e6 },
      { name: "International", value: 19425e6 },
    ]),
  },
  DIS: {
    product: buildSegData("2024", [
      { name: "Entertainment", value: 41184e6 },
      { name: "Experiences", value: 34149e6 },
      { name: "Sports (ESPN)", value: 16998e6 },
    ]),
    geo: buildSegData("2024", [
      { name: "Amérique du Nord", value: 64735e6 },
      { name: "International", value: 27596e6 },
    ]),
  },
  KO: {
    product: buildSegData("2024", [
      { name: "Sparkling Flavors", value: 14149e6 },
      { name: "Coca-Cola", value: 11346e6 },
      { name: "Nutrition, Juice & Dairy", value: 5361e6 },
      { name: "Water & Sports", value: 4917e6 },
      { name: "Thé & Café", value: 2316e6 },
    ]),
    geo: buildSegData("2024", [
      { name: "Amérique du Nord", value: 16280e6 },
      { name: "EMEA", value: 8034e6 },
      { name: "Amérique latine", value: 5420e6 },
      { name: "Asie-Pacifique", value: 5680e6 },
      { name: "Bottling Investments", value: 10675e6 },
    ]),
  },
};
// Alias
SEGMENTS_DB["GOOG"] = SEGMENTS_DB["GOOGL"];

function getHardcodedSegments(symbol) {
  const base = symbol.split(".")[0].toUpperCase();
  const entry = SEGMENTS_DB[base];
  if (!entry) return null;
  console.log(`[Segments] Using hardcoded data for ${base}`);
  return entry;
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
          {subtitle} {data.total ? `· Total: ${compact(data.total)}` : ""}
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
          Année fiscale {data.date}
        </div>
      )}
    </div>
  );
}

/* ── Main ── */
export default function RevenueBreakdown({ data, symbol }) {
  const [productData, setProductData] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(null);

  useEffect(() => {
    if (!symbol) return;

    setProductData(null);
    setGeoData(null);
    setLoading(true);
    setSource(null);

    (async () => {
      // 1) Try FMP v4 (if key available — premium feature)
      if (hasFmpApiKey()) {
        try {
          const fmp = data?._fmpData;
          const [prod, geo] = fmp?.productSegments?.length || fmp?.geoSegments?.length
            ? [fmp.productSegments, fmp.geoSegments]
            : await Promise.all([
                fetchRevenueProductSegmentation(symbol).catch(() => []),
                fetchRevenueGeoSegmentation(symbol).catch(() => []),
              ]);

          const p = parseFmpSegments(prod);
          const g = parseFmpSegments(geo);
          if (p || g) {
            setProductData(p);
            setGeoData(g);
            setSource("FMP");
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn("[Segments] FMP failed:", e.message);
        }
      }

      // 2) Hardcoded segment data from public 10-K filings
      const hardcoded = getHardcodedSegments(symbol);
      if (hardcoded) {
        setProductData(hardcoded.product);
        setGeoData(hardcoded.geo);
        setSource("10-K");
        setLoading(false);
        return;
      }

      setLoading(false);
    })();
  }, [symbol, data]);

  if (loading) {
    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
        gap: 16, marginBottom: 16,
      }}>
        {[0, 1].map(i => (
          <div key={i} style={{
            background: "var(--card)", borderRadius: 16, padding: 40,
            boxShadow: "0 1px 4px var(--shadow)", border: "1px solid var(--border)",
            textAlign: "center", color: "var(--muted)", fontSize: 13,
          }}>
            Chargement des segments...
          </div>
        ))}
      </div>
    );
  }

  if (!productData && !geoData) return null;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
      gap: 16, marginBottom: 16,
    }}>
      {productData && (
        <PieCard title="Répartition du CA par produit"
          subtitle="Comment l'entreprise gagne son argent"
          accentColor="#4f46e5" data={productData} />
      )}
      {geoData && (
        <PieCard title="Répartition géographique du CA"
          subtitle="Où se vendent les produits"
          accentColor="#0891b2" data={geoData} />
      )}
    </div>
  );
}

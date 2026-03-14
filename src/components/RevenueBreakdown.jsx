import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { proxyFetch } from "../utils/api";
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

/* ── SEC EDGAR: fetch segment data (free, no API key) ── */

// Cache ticker → CIK mapping
let tickerToCik = null;

async function getTickerCikMap() {
  if (tickerToCik) return tickerToCik;
  try {
    const data = await proxyFetch("https://www.sec.gov/files/company_tickers.json");
    tickerToCik = {};
    for (const entry of Object.values(data)) {
      tickerToCik[entry.ticker?.toUpperCase()] = String(entry.cik_str).padStart(10, "0");
    }
    return tickerToCik;
  } catch (e) {
    console.warn("[SEC] Failed to fetch ticker→CIK map:", e.message);
    return {};
  }
}

function cleanSegmentName(raw) {
  // Convert XBRL segment labels to readable names
  // e.g. "aapl:IPhoneMember" → "iPhone", "us-gaap:Americas" → "Americas"
  let name = raw;
  // Remove namespace prefix
  name = name.replace(/^[a-z]+:/i, "");
  // Remove "Member", "Segment", "Region" suffixes
  name = name.replace(/Member$/i, "").replace(/Segment$/i, "").replace(/Region$/i, "");
  // CamelCase to spaces
  name = name.replace(/([a-z])([A-Z])/g, "$1 $2");
  // Special known mappings
  const MAP = {
    "I Phone": "iPhone",
    "I Pad": "iPad",
    "I Cloud": "iCloud",
    "Mac": "Mac",
    "Wearables Home And Accessories": "Wearables & Accessories",
    "Greater China": "Chine",
    "Americas": "Amériques",
    "Europe": "Europe",
    "Japan": "Japon",
    "Rest Of Asia Pacific": "Reste Asie-Pacifique",
    "Asia Pacific": "Asie-Pacifique",
    "United States": "États-Unis",
    "United States And Canada": "États-Unis & Canada",
    "North America": "Amérique du Nord",
    "Latin America": "Amérique latine",
    "EMEA": "EMEA",
    "Middle East And Africa": "Moyen-Orient & Afrique",
  };
  return MAP[name] || name;
}

async function fetchSecSegments(symbol) {
  try {
    const cikMap = await getTickerCikMap();
    // Handle exchange suffixes like MC.PA → MC
    const baseTicker = symbol.split(".")[0].toUpperCase();
    const cik = cikMap[symbol.toUpperCase()] || cikMap[baseTicker];
    if (!cik) {
      console.log("[SEC] No CIK found for", symbol);
      return { product: null, geo: null };
    }

    const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
    const data = await proxyFetch(url);
    const facts = data?.facts?.["us-gaap"] || {};

    // Look for revenue concepts
    const revenueConcepts = [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
      "SalesRevenueNet",
      "Revenue",
    ];

    let revenueData = null;
    for (const concept of revenueConcepts) {
      if (facts[concept]?.units?.USD?.length > 0) {
        revenueData = facts[concept].units.USD;
        break;
      }
    }

    if (!revenueData) {
      console.log("[SEC] No revenue data found for", symbol);
      return { product: null, geo: null };
    }

    // Filter for annual (10-K) filings only, most recent fiscal year
    const annualEntries = revenueData.filter(e =>
      e.form === "10-K" && e.fp === "FY" && e.val > 0
    );

    if (annualEntries.length === 0) {
      return { product: null, geo: null };
    }

    // Find the most recent fiscal year
    const maxFy = Math.max(...annualEntries.map(e => e.fy));

    // Separate entries with and without segments for latest year
    const latestEntries = annualEntries.filter(e => e.fy === maxFy);

    // Entries with segment info (product or geo breakdowns)
    const segmented = latestEntries.filter(e => e.segment);
    // Total revenue (no segment = company total)
    const totalEntry = latestEntries.find(e => !e.segment && !e.frame?.includes("I"));

    if (segmented.length < 2) {
      return { product: null, geo: null };
    }

    // Classify segments as product vs geo
    const geoKeywords = /geograph|region|country|americas|europe|china|japan|asia|pacific|emea|africa|middle.east|united.states|north.america|latin|international|domestic/i;
    const productEntries = [];
    const geoEntries = [];

    for (const entry of segmented) {
      const seg = entry.segment || "";
      if (geoKeywords.test(seg)) {
        geoEntries.push(entry);
      } else {
        productEntries.push(entry);
      }
    }

    const buildPieData = (entries, year) => {
      if (entries.length < 2) return null;

      // Deduplicate: keep the entry with the largest val for each segment name
      const byName = new Map();
      for (const e of entries) {
        const name = cleanSegmentName(e.segment.split("=").pop() || e.segment);
        const existing = byName.get(name);
        if (!existing || e.val > existing.val) {
          byName.set(name, { name, value: e.val });
        }
      }

      const items = [...byName.values()].filter(e => e.value > 0);
      if (items.length < 2) return null;

      items.sort((a, b) => b.value - a.value);
      const total = items.reduce((s, e) => s + e.value, 0);

      return {
        date: String(year),
        total,
        items: items.map((e, i) => ({
          ...e,
          pct: ((e.value / total) * 100).toFixed(1),
          color: COLORS[i % COLORS.length],
        })),
      };
    };

    return {
      product: buildPieData(productEntries, maxFy),
      geo: buildPieData(geoEntries, maxFy),
    };
  } catch (e) {
    console.warn("[SEC] Failed to fetch segment data:", e.message);
    return { product: null, geo: null };
  }
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

  useEffect(() => {
    if (!symbol) return;

    setProductData(null);
    setGeoData(null);
    setLoading(true);

    (async () => {
      // 1) Try FMP first (if key available)
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
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn("[Segments] FMP failed:", e.message);
        }
      }

      // 2) Fallback: SEC EDGAR (free, no key needed, US companies only)
      try {
        const { product, geo } = await fetchSecSegments(symbol);
        setProductData(product);
        setGeoData(geo);
      } catch (e) {
        console.warn("[Segments] SEC EDGAR failed:", e.message);
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

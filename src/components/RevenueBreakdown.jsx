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

/* ── SEC EDGAR: fetch via CORS proxies ── */

const WORKER_URL = "https://foucauld-proxy.foucauld-finance.workers.dev";

const SEC_PROXIES = [
  // corsproxy.io: supports JSON, works with SEC EDGAR
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  // Cloudflare Worker (needs redeploy to support SEC)
  url => `${WORKER_URL}?url=${encodeURIComponent(url)}`,
  // allorigins
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

async function secFetch(url) {
  for (let i = 0; i < SEC_PROXIES.length; i++) {
    const proxyUrl = SEC_PROXIES[i](url);
    const label = new URL(proxyUrl).hostname;
    try {
      const res = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`[SEC] OK via ${label}`);
        return data;
      }
      console.warn(`[SEC] ${label} → HTTP ${res.status}`);
    } catch (e) {
      console.warn(`[SEC] ${label} → ${e.message}`);
    }
  }
  return null;
}

// Well-known CIK mappings for popular tickers (avoid fetching the full 6MB file)
const KNOWN_CIKS = {
  AAPL: "0000320193", MSFT: "0000789019", GOOGL: "0001652044", GOOG: "0001652044",
  AMZN: "0001018724", META: "0001326801", TSLA: "0001318605", NVDA: "0001045810",
  BRK: "0001067983", JPM: "0000019617", JNJ: "0000200406", V: "0001403161",
  UNH: "0000731766", HD: "0000354950", PG: "0000080424", MA: "0001141391",
  XOM: "0000034088", CVX: "0000093410", KO: "0000021344", PEP: "0000077476",
  ABBV: "0001551152", MRK: "0000310158", COST: "0000909832", AVGO: "0001649338",
  WMT: "0000104169", DIS: "0001744489", NFLX: "0001065280", ADBE: "0000796343",
  CRM: "0001108524", AMD: "0000002488", INTC: "0000050863", CSCO: "0000858877",
  NKE: "0000320187", MCD: "0000789019", BA: "0000012927", CAT: "0000018230",
  IBM: "0000051143", GS: "0000886982", MS: "0000895421", PYPL: "0001633917",
  UBER: "0001543151", SQ: "0001512673", SNAP: "0001564408", SPOT: "0001639920",
  ZM: "0001585521", SHOP: "0001594805", ABNB: "0001559720", COIN: "0001679788",
  PLTR: "0001321655", SNOW: "0001640147", CRWD: "0001535527", NET: "0001477333",
  DDOG: "0001561550", ZS: "0001713683", PANW: "0001327567", NOW: "0001373715",
};

let fullTickerMap = null;

async function getCik(symbol) {
  const base = symbol.split(".")[0].toUpperCase();

  // Check known CIKs first
  if (KNOWN_CIKS[base]) return KNOWN_CIKS[base];

  // Try fetching full map once
  if (fullTickerMap === null) {
    try {
      const data = await secFetch("https://www.sec.gov/files/company_tickers.json");
      if (data) {
        fullTickerMap = {};
        for (const entry of Object.values(data)) {
          fullTickerMap[entry.ticker?.toUpperCase()] = String(entry.cik_str).padStart(10, "0");
        }
      } else {
        fullTickerMap = {};
      }
    } catch {
      fullTickerMap = {};
    }
  }

  return fullTickerMap[base] || null;
}

function cleanSegmentName(raw) {
  let name = raw;
  name = name.replace(/^[a-z]+:/i, "");
  name = name.replace(/Member$/i, "").replace(/Segment$/i, "").replace(/Region$/i, "");
  name = name.replace(/([a-z])([A-Z])/g, "$1 $2");
  const MAP = {
    "I Phone": "iPhone", "I Pad": "iPad", "I Cloud": "iCloud",
    "Mac": "Mac", "Services": "Services",
    "Wearables Home And Accessories": "Wearables & Accessoires",
    "Greater China": "Chine élargie", "Americas": "Amériques",
    "Europe": "Europe", "Japan": "Japon",
    "Rest Of Asia Pacific": "Reste Asie-Pacifique",
    "Asia Pacific": "Asie-Pacifique",
    "United States": "États-Unis",
    "United States And Canada": "Amérique du Nord",
    "North America": "Amérique du Nord",
    "Latin America": "Amérique latine",
    "EMEA": "EMEA",
    "Middle East And Africa": "Moyen-Orient & Afrique",
    "International": "International",
    "All Other": "Autres",
    "Other": "Autres",
    "Corporate And Other": "Corporate & Autres",
  };
  return MAP[name] || name;
}

async function fetchSecSegments(symbol) {
  try {
    const cik = await getCik(symbol);
    if (!cik) {
      console.log("[SEC] No CIK found for", symbol);
      return { product: null, geo: null };
    }

    // Try each revenue concept via companyconcept endpoint (much lighter than companyfacts)
    const revenueConcepts = [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
      "SalesRevenueNet",
    ];

    let revenueData = null;
    for (const concept of revenueConcepts) {
      const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${concept}.json`;
      const data = await secFetch(url);
      if (data?.units?.USD?.length > 0) {
        revenueData = data.units.USD;
        console.log(`[SEC] Found revenue data via ${concept}: ${revenueData.length} entries`);
        break;
      }
    }

    if (!revenueData) {
      console.log("[SEC] No revenue data for", symbol);
      return { product: null, geo: null };
    }

    // Annual 10-K filings only, with segment info
    const annualEntries = revenueData.filter(e =>
      e.form === "10-K" && e.fp === "FY" && e.val > 0 && e.segment
    );

    console.log(`[SEC] ${annualEntries.length} segmented annual entries found`);
    if (annualEntries.length < 2) return { product: null, geo: null };

    const maxFy = Math.max(...annualEntries.map(e => e.fy));
    const latestEntries = annualEntries.filter(e => e.fy === maxFy);
    console.log(`[SEC] FY${maxFy}: ${latestEntries.length} segments`);

    // Classify segments
    const geoKeywords = /geograph|region|country|americas|europe|china|japan|asia|pacific|emea|africa|middle.east|united.states|north.america|latin|international|domestic/i;
    const productEntries = [];
    const geoEntries = [];

    for (const entry of latestEntries) {
      const seg = entry.segment || "";
      if (geoKeywords.test(seg)) {
        geoEntries.push(entry);
      } else {
        productEntries.push(entry);
      }
    }

    const buildPieData = (entries) => {
      if (entries.length < 2) return null;
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
        date: String(maxFy),
        total,
        items: items.map((e, i) => ({
          ...e,
          pct: ((e.value / total) * 100).toFixed(1),
          color: COLORS[i % COLORS.length],
        })),
      };
    };

    return {
      product: buildPieData(productEntries),
      geo: buildPieData(geoEntries),
    };
  } catch (e) {
    console.warn("[SEC] Error:", e.message);
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
  const [source, setSource] = useState(null);

  useEffect(() => {
    if (!symbol) return;

    setProductData(null);
    setGeoData(null);
    setLoading(true);
    setSource(null);

    (async () => {
      // 1) Try FMP v4 (if key available)
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

      // 2) SEC EDGAR (free, US companies)
      try {
        const { product, geo } = await fetchSecSegments(symbol);
        if (product || geo) {
          setProductData(product);
          setGeoData(geo);
          setSource("SEC EDGAR");
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn("[Segments] SEC failed:", e.message);
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

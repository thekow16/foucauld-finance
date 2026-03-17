import { useState, useEffect, useRef, useCallback } from "react";
import { fetchStockData, fetchChartData, searchSymbols } from "../utils/api";
import { fmt } from "../utils/format";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from "recharts";

// ── Metric extraction (robust: handles both quoteSummary & chart fallback) ──
function extractMetrics(symbol, data) {
  if (!data) return null;
  const pr = data.price;
  const fin = data.financialData;
  const stats = data.defaultKeyStatistics;
  const summ = data.summaryDetail;

  // PE: try multiple paths
  const pe = stats?.trailingPE?.raw ?? summ?.trailingPE?.raw ?? fin?.trailingPE?.raw;
  const pb = stats?.priceToBook?.raw;
  const divYield = summ?.dividendYield?.raw;
  const grossMargin = fin?.grossMargins?.raw;
  const opMargin = fin?.operatingMargins?.raw;
  const netMargin = fin?.profitMargins?.raw;
  const roe = fin?.returnOnEquity?.raw;
  const roa = fin?.returnOnAssets?.raw;
  const debtToEquity = fin?.debtToEquity?.raw;
  const currentRatio = fin?.currentRatio?.raw;
  const revenueGrowth = fin?.revenueGrowth?.raw;
  const earningsGrowth = fin?.earningsGrowth?.raw;
  const evToEbitda = stats?.enterpriseToEbitda?.raw;
  const evToRevenue = stats?.enterpriseToRevenue?.raw;
  const freeCashflow = fin?.freeCashflow?.raw;
  const revenue = fin?.totalRevenue?.raw;
  const fcfMargin = (freeCashflow != null && revenue > 0) ? freeCashflow / revenue : null;

  return {
    symbol,
    name: pr?.shortName || pr?.longName || symbol,
    price: pr?.regularMarketPrice?.raw,
    change: pr?.regularMarketChangePercent?.raw,
    currency: pr?.currency || "USD",
    marketCap: pr?.marketCap?.raw ?? summ?.marketCap?.raw,
    pe,
    pb,
    divYield,
    grossMargin,
    opMargin,
    netMargin,
    roe,
    roa,
    debtToEquity,
    currentRatio,
    revenueGrowth,
    earningsGrowth,
    evToEbitda,
    evToRevenue,
    fcfMargin,
    freeCashflow,
    revenue,
  };
}

// ── Radar normalization (0-100 scale) ──
function normalizeForRadar(val, key) {
  if (val == null) return 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  switch (key) {
    case "grossMargin":
    case "opMargin":
    case "netMargin":
    case "fcfMargin":
      return clamp(val * 100, 0, 100);
    case "roe":
    case "roa":
      return clamp(val * 100 * 2, 0, 100); // 50% ROE = 100
    case "revenueGrowth":
      return clamp((val + 0.2) * 200, 0, 100); // -20%=0, +30%=100
    case "currentRatio":
      return clamp(val * 33, 0, 100); // 3.0 = 100
    case "debtToEquity":
      return clamp(100 - val * 0.5, 0, 100); // lower=better, 0=100, 200=0
    default:
      return clamp(val * 100, 0, 100);
  }
}

const RADAR_KEYS = [
  { key: "grossMargin", label: "Marge brute" },
  { key: "opMargin", label: "Marge opéra." },
  { key: "netMargin", label: "Marge nette" },
  { key: "roe", label: "ROE" },
  { key: "revenueGrowth", label: "Croissance CA" },
  { key: "currentRatio", label: "Liquidité" },
  { key: "fcfMargin", label: "Marge FCF" },
];

const ROWS = [
  { label: "Prix", key: "price", format: (v, m) => v != null ? `${v.toFixed(2)} ${m?.currency || ""}` : "—" },
  { label: "Variation", key: "change", format: v => v != null ? `${(v * 100).toFixed(2)} %` : "—" },
  { label: "Capitalisation", key: "marketCap", format: v => fmt(v, "currency") },
  { label: "P/E Ratio", key: "pe", format: v => fmt(v, "ratio"), better: "lower" },
  { label: "P/B Ratio", key: "pb", format: v => fmt(v, "ratio"), better: "lower" },
  { label: "EV/EBITDA", key: "evToEbitda", format: v => fmt(v, "ratio"), better: "lower" },
  { label: "Dividende", key: "divYield", format: v => fmt(v, "percent"), better: "higher" },
  { label: "Marge brute", key: "grossMargin", format: v => fmt(v, "percent"), better: "higher" },
  { label: "Marge opéra.", key: "opMargin", format: v => fmt(v, "percent"), better: "higher" },
  { label: "Marge nette", key: "netMargin", format: v => fmt(v, "percent"), better: "higher" },
  { label: "Marge FCF", key: "fcfMargin", format: v => fmt(v, "percent"), better: "higher" },
  { label: "ROE", key: "roe", format: v => fmt(v, "percent"), better: "higher" },
  { label: "ROA", key: "roa", format: v => fmt(v, "percent"), better: "higher" },
  { label: "Dette / CP", key: "debtToEquity", format: v => v != null ? `${v.toFixed(1)}` : "—", better: "lower" },
  { label: "Liquidité gén.", key: "currentRatio", format: v => fmt(v, "ratio"), better: "higher" },
  { label: "Croissance CA", key: "revenueGrowth", format: v => fmt(v, "percent"), better: "higher" },
  { label: "Croissance bén.", key: "earningsGrowth", format: v => fmt(v, "percent"), better: "higher" },
];

function getBetter(row, a, b) {
  if (!row.better || a == null || b == null) return null;
  if (a === b) return null;
  return row.better === "higher"
    ? (a > b ? "a" : "b")
    : (a < b ? "a" : "b");
}

function countWins(metricsA, metricsB) {
  let a = 0, b = 0;
  for (const row of ROWS) {
    const w = getBetter(row, metricsA[row.key], metricsB[row.key]);
    if (w === "a") a++;
    if (w === "b") b++;
  }
  return { a, b };
}

export default function CompareMode({ currentSymbol, currentData }) {
  const [compareSymbol, setCompareSymbol] = useState("");
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Search suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const suggTimer = useRef(null);
  const inputRef = useRef(null);

  // Chart data
  const [chartA, setChartA] = useState(null);
  const [chartB, setChartB] = useState(null);
  const [chartRange, setChartRange] = useState("1y");

  const handleInputChange = (e) => {
    const val = e.target.value;
    setCompareSymbol(val);
    clearTimeout(suggTimer.current);
    if (val.trim().length >= 1) {
      suggTimer.current = setTimeout(async () => {
        try {
          const results = await searchSymbols(val.trim());
          setSuggestions(results.filter(r => r.symbol !== currentSymbol));
          setShowSugg(true);
        } catch { setSuggestions([]); }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSugg(false);
    }
  };

  const selectSuggestion = (sym) => {
    setCompareSymbol(sym);
    setSuggestions([]);
    setShowSugg(false);
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSugg(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCompare = async (e) => {
    e?.preventDefault();
    const sym = compareSymbol.trim().toUpperCase();
    if (!sym) return;
    if (sym === currentSymbol?.toUpperCase()) {
      setError("Choisissez un symbole différent de l'action actuelle.");
      return;
    }
    setLoading(true);
    setError(null);
    setShowSugg(false);
    try {
      const result = await fetchStockData(sym);
      if (!result?.data) throw new Error("Données introuvables pour ce symbole.");
      setCompareData({ symbol: sym, data: result.data });
    } catch (err) {
      setError(err.message || "Erreur lors de la récupération des données.");
      setCompareData(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch chart data when comparison is made or range changes
  const fetchCharts = useCallback(async (symB, range) => {
    const intervalMap = { "1mo": "1d", "3mo": "1d", "6mo": "1wk", "1y": "1wk", "5y": "1mo" };
    const interval = intervalMap[range] || "1wk";
    try {
      const [a, b] = await Promise.all([
        fetchChartData(currentSymbol, interval, range),
        fetchChartData(symB, interval, range),
      ]);
      setChartA(a);
      setChartB(b);
    } catch {
      setChartA(null);
      setChartB(null);
    }
  }, [currentSymbol]);

  useEffect(() => {
    if (compareData?.symbol) {
      fetchCharts(compareData.symbol, chartRange);
    }
  }, [compareData?.symbol, chartRange, fetchCharts]);

  const metricsA = extractMetrics(currentSymbol, currentData);
  const metricsB = compareData ? extractMetrics(compareData.symbol, compareData.data) : null;

  // Build normalized chart (base 100)
  const normalizedChart = (() => {
    if (!chartA?.length || !chartB?.length) return [];
    const baseA = chartA[0]?.price;
    const baseB = chartB[0]?.price;
    if (!baseA || !baseB) return [];
    const len = Math.min(chartA.length, chartB.length);
    return Array.from({ length: len }, (_, i) => ({
      date: chartA[i]?.date || chartB[i]?.date,
      [currentSymbol]: +((chartA[i]?.price / baseA) * 100).toFixed(2),
      [compareData?.symbol]: +((chartB[i]?.price / baseB) * 100).toFixed(2),
    }));
  })();

  // Radar data
  const radarData = metricsB ? RADAR_KEYS.map(({ key, label }) => ({
    metric: label,
    [metricsA?.name || currentSymbol]: normalizeForRadar(metricsA?.[key], key),
    [metricsB?.name || compareData?.symbol]: normalizeForRadar(metricsB?.[key], key),
  })) : [];

  const wins = metricsB ? countWins(metricsA, metricsB) : { a: 0, b: 0 };

  const CHART_RANGES = [
    { label: "1M", value: "1mo" },
    { label: "3M", value: "3mo" },
    { label: "6M", value: "6mo" },
    { label: "1A", value: "1y" },
    { label: "5A", value: "5y" },
  ];

  return (
    <div>
      {/* Search bar */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 14 }}>Comparer avec une autre action</div>
        <form onSubmit={handleCompare} style={{ display: "flex", gap: 10, marginBottom: 4 }}>
          <div style={{ flex: 1, position: "relative" }} ref={inputRef}>
            <input
              className="compare-input"
              style={{ width: "100%" }}
              value={compareSymbol}
              onChange={handleInputChange}
              onFocus={() => suggestions.length > 0 && setShowSugg(true)}
              placeholder="Symbole à comparer (ex: MSFT, MC.PA)"
            />
            {showSugg && suggestions.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10,
                marginTop: 4, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,.12)"
              }}>
                {suggestions.map(s => (
                  <div
                    key={s.symbol}
                    onClick={() => selectSuggestion(s.symbol)}
                    style={{
                      padding: "10px 14px", cursor: "pointer", display: "flex",
                      justifyContent: "space-between", alignItems: "center",
                      fontSize: 13, borderBottom: "1px solid var(--border)",
                      transition: "background .15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <span style={{ fontWeight: 700 }}>{s.symbol}</span>
                    <span style={{ color: "var(--muted)", fontSize: 12, maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.shortname || s.longname || ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button type="submit" className="compare-btn" disabled={loading}>
            {loading ? "Chargement..." : "Comparer"}
          </button>
        </form>
        {error && <div className="compare-error" style={{ marginTop: 8 }}>{error}</div>}
      </div>

      {metricsB && (
        <>
          {/* Verdict summary */}
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24, flexWrap: "wrap", padding: "6px 0" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{metricsA.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{metricsA.symbol}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: wins.a >= wins.b ? "#10b981" : "var(--muted)", marginTop: 4 }}>{wins.a}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)", padding: "0 8px" }}>vs</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{metricsB.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{metricsB.symbol}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: wins.b > wins.a ? "#10b981" : "var(--muted)", marginTop: 4 }}>{wins.b}</div>
              </div>
            </div>
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              Nombre de métriques gagnantes (sur {ROWS.filter(r => r.better).length} comparables)
            </div>
          </div>

          {/* Performance chart */}
          {normalizedChart.length > 0 && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="section-title" style={{ marginBottom: 10 }}>Performance comparée (base 100)</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {CHART_RANGES.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setChartRange(r.value)}
                    style={{
                      padding: "5px 12px", borderRadius: 8, border: "1px solid var(--border)",
                      background: chartRange === r.value ? "var(--accent)" : "var(--bg)",
                      color: chartRange === r.value ? "#fff" : "var(--text)",
                      fontWeight: 600, fontSize: 12, cursor: "pointer", transition: "all .2s",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={normalizedChart}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" stroke="var(--muted)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted)" domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)", border: "1px solid var(--border)",
                      borderRadius: 10, fontSize: 12, fontWeight: 600,
                    }}
                    formatter={(value, name) => [`${value.toFixed(1)}`, name]}
                  />
                  <Line
                    type="monotone"
                    dataKey={currentSymbol}
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey={compareData.symbol}
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Radar chart */}
          {radarData.length > 0 && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="section-title" style={{ marginBottom: 10 }}>Profil fondamental</div>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "var(--text)" }} />
                  <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                  <Radar
                    name={metricsA.name || currentSymbol}
                    dataKey={metricsA.name || currentSymbol}
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                  <Radar
                    name={metricsB.name || compareData.symbol}
                    dataKey={metricsB.name || compareData.symbol}
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Metrics table */}
          <div className="card" style={{ marginTop: 12 }}>
            <div className="section-title" style={{ marginBottom: 10 }}>Détail des métriques</div>
            <div style={{ overflowX: "auto" }}>
              <table className="ff-table compare-table">
                <thead>
                  <tr>
                    <th>Métrique</th>
                    <th style={{ color: "#6366f1" }}>{metricsA.name} ({metricsA.symbol})</th>
                    <th style={{ color: "#f59e0b" }}>{metricsB.name} ({metricsB.symbol})</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(row => {
                    const valA = metricsA[row.key];
                    const valB = metricsB[row.key];
                    const better = getBetter(row, valA, valB);
                    return (
                      <tr key={row.key}>
                        <td style={{ fontWeight: 600 }}>{row.label}</td>
                        <td style={{
                          fontWeight: 700,
                          color: better === "a" ? "#10b981" : better === "b" ? "#ef4444" : "var(--text)",
                          background: better === "a" ? "rgba(16,185,129,0.08)" : "transparent"
                        }}>
                          {row.format(valA, metricsA)}{better === "a" ? " ✓" : ""}
                        </td>
                        <td style={{
                          fontWeight: 700,
                          color: better === "b" ? "#10b981" : better === "a" ? "#ef4444" : "var(--text)",
                          background: better === "b" ? "rgba(16,185,129,0.08)" : "transparent"
                        }}>
                          {row.format(valB, metricsB)}{better === "b" ? " ✓" : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { fetchStockData, searchSymbols } from "../utils/api";
import { fmt } from "../utils/format";

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

  const metricsA = extractMetrics(currentSymbol, currentData);
  const metricsB = compareData ? extractMetrics(compareData.symbol, compareData.data) : null;

  const wins = metricsB ? countWins(metricsA, metricsB) : { a: 0, b: 0 };

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

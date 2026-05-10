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
  { label: "Marge opera.", key: "opMargin", format: v => fmt(v, "percent"), better: "higher" },
  { label: "Marge nette", key: "netMargin", format: v => fmt(v, "percent"), better: "higher" },
  { label: "Marge FCF", key: "fcfMargin", format: v => fmt(v, "percent"), better: "higher" },
  { label: "ROE", key: "roe", format: v => fmt(v, "percent"), better: "higher" },
  { label: "ROA", key: "roa", format: v => fmt(v, "percent"), better: "higher" },
  { label: "Dette / CP", key: "debtToEquity", format: v => v != null ? `${v.toFixed(1)}` : "—", better: "lower" },
  { label: "Liquidite gen.", key: "currentRatio", format: v => fmt(v, "ratio"), better: "higher" },
  { label: "Croissance CA", key: "revenueGrowth", format: v => fmt(v, "percent"), better: "higher" },
  { label: "Croissance ben.", key: "earningsGrowth", format: v => fmt(v, "percent"), better: "higher" },
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
      setError("Choisissez un symbole different de l'action actuelle.");
      return;
    }
    setLoading(true);
    setError(null);
    setShowSugg(false);
    try {
      const result = await fetchStockData(sym);
      if (!result?.data) throw new Error("Donnees introuvables pour ce symbole.");
      setCompareData({ symbol: sym, data: result.data });
    } catch (err) {
      setError(err.message || "Erreur lors de la recuperation des donnees.");
      setCompareData(null);
    } finally {
      setLoading(false);
    }
  };

  const metricsA = extractMetrics(currentSymbol, currentData);
  const metricsB = compareData ? extractMetrics(compareData.symbol, compareData.data) : null;

  const wins = metricsB ? countWins(metricsA, metricsB) : { a: 0, b: 0 };

  const thStyle = {
    background: "var(--bg-subtle)",
    fontSize: 10,
    fontWeight: 700,
    color: "var(--text-3)",
    textTransform: "uppercase",
    letterSpacing: ".4px",
    padding: "8px 12px",
    textAlign: "left",
  };

  const tdStyle = {
    padding: "8px 12px",
    borderBottom: "1px solid var(--border)",
    fontSize: 13,
  };

  const winCellStyle = {
    fontWeight: 700,
    color: "var(--green)",
    background: "var(--green-bg)",
  };

  return (
    <div>
      {/* Search bar */}
      <div style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 18px",
          borderBottom: "1px solid var(--border)",
        }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>Comparer avec une autre action</span>
        </div>
        <div style={{ padding: "14px 18px" }}>
          <form onSubmit={handleCompare} style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, position: "relative" }} ref={inputRef}>
              <input
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-subtle)",
                  fontSize: 13,
                  color: "var(--text)",
                  outline: "none",
                  fontFamily: "var(--font)",
                  boxSizing: "border-box",
                }}
                value={compareSymbol}
                onChange={handleInputChange}
                onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                placeholder="Symbole a comparer (ex: MSFT, MC.PA)"
              />
              {showSugg && suggestions.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                  background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  marginTop: 4, overflow: "hidden", boxShadow: "var(--shadow-md)"
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
                      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-subtle)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <span style={{ fontWeight: 700 }}>{s.symbol}</span>
                      <span style={{ color: "var(--text-3)", fontSize: 12, maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.shortname || s.longname || ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "8px 16px",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                fontFamily: "var(--font)",
                whiteSpace: "nowrap",
              }}
            >
              {loading ? "Chargement..." : "Comparer"}
            </button>
          </form>
          {error && <div style={{ marginTop: 8, color: "var(--red)", fontSize: 12, fontWeight: 600 }}>{error}</div>}
        </div>
      </div>

      {metricsB && (
        <>
          {/* Score section */}
          <div style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            marginTop: 12,
          }}>
            <div style={{
              padding: "10px 12px",
              background: "var(--bg-subtle)",
              borderBottom: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24, flexWrap: "wrap", padding: "6px 0" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{metricsA.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{metricsA.symbol}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: wins.a >= wins.b ? "var(--green)" : "var(--text-3)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{wins.a}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-3)", padding: "0 8px" }}>vs</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{metricsB.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{metricsB.symbol}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: wins.b > wins.a ? "var(--green)" : "var(--text-3)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{wins.b}</div>
                </div>
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                Nombre de metriques gagnantes (sur {ROWS.filter(r => r.better).length} comparables)
              </div>
            </div>
          </div>

          {/* Metrics table */}
          <div style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            marginTop: 12,
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 18px",
              borderBottom: "1px solid var(--border)",
            }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>Detail des metriques</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Metrique</th>
                    <th style={{ ...thStyle, color: "var(--accent)" }}>{metricsA.name} ({metricsA.symbol})</th>
                    <th style={{ ...thStyle, color: "var(--orange)" }}>{metricsB.name} ({metricsB.symbol})</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(row => {
                    const valA = metricsA[row.key];
                    const valB = metricsB[row.key];
                    const better = getBetter(row, valA, valB);
                    return (
                      <tr key={row.key}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: "var(--text)" }}>{row.label}</td>
                        <td style={{
                          ...tdStyle,
                          ...(better === "a" ? winCellStyle : {}),
                          color: better === "a" ? "var(--green)" : better === "b" ? "var(--red)" : "var(--text)",
                        }}>
                          {row.format(valA, metricsA)}
                        </td>
                        <td style={{
                          ...tdStyle,
                          ...(better === "b" ? winCellStyle : {}),
                          color: better === "b" ? "var(--green)" : better === "a" ? "var(--red)" : "var(--text)",
                        }}>
                          {row.format(valB, metricsB)}
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

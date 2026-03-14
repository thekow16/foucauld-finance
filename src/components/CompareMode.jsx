import { useState } from "react";
import { fetchStockData } from "../utils/api";
import { fmt } from "../utils/format";

export default function CompareMode({ currentSymbol, currentData }) {
  const [compareSymbol, setCompareSymbol] = useState("");
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCompare = async (e) => {
    e?.preventDefault();
    const sym = compareSymbol.trim().toUpperCase();
    if (!sym) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStockData(sym);
      setCompareData({ symbol: sym, data });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getMetrics = (symbol, data) => {
    const pr = data?.price;
    const fin = data?.financialData;
    const stats = data?.defaultKeyStatistics;
    const summ = data?.summaryDetail;

    return {
      symbol,
      name: pr?.shortName || symbol,
      price: pr?.regularMarketPrice?.raw,
      currency: pr?.currency,
      marketCap: pr?.marketCap?.raw,
      pe: stats?.trailingPE?.raw,
      pb: stats?.priceToBook?.raw,
      divYield: summ?.dividendYield?.raw,
      grossMargin: fin?.grossMargins?.raw,
      opMargin: fin?.operatingMargins?.raw,
      netMargin: fin?.profitMargins?.raw,
      roe: fin?.returnOnEquity?.raw,
      roa: fin?.returnOnAssets?.raw,
      debtToEquity: fin?.debtToEquity?.raw,
      currentRatio: fin?.currentRatio?.raw,
      revenueGrowth: fin?.revenueGrowth?.raw,
      earningsGrowth: fin?.earningsGrowth?.raw,
    };
  };

  const rows = [
    { label: "Prix", key: "price", format: (v, m) => v != null ? `${v.toFixed(2)} ${m.currency}` : "—" },
    { label: "Capitalisation", key: "marketCap", format: v => fmt(v, "currency") },
{ label: "P/E Ratio", key: "pe", format: v => fmt(v, "ratio"), better: "lower" },
    { label: "P/B Ratio", key: "pb", format: v => fmt(v, "ratio"), better: "lower" },
    { label: "Dividende", key: "divYield", format: v => fmt(v, "percent"), better: "higher" },
    { label: "Marge brute", key: "grossMargin", format: v => fmt(v, "percent"), better: "higher" },
    { label: "Marge opéra.", key: "opMargin", format: v => fmt(v, "percent"), better: "higher" },
    { label: "Marge nette", key: "netMargin", format: v => fmt(v, "percent"), better: "higher" },
    { label: "ROE", key: "roe", format: v => fmt(v, "percent"), better: "higher" },
    { label: "ROA", key: "roa", format: v => fmt(v, "percent"), better: "higher" },
    { label: "Dette / CP", key: "debtToEquity", format: v => v != null ? `${v.toFixed(1)}%` : "—", better: "lower" },
    { label: "Liquidité", key: "currentRatio", format: v => fmt(v, "ratio"), better: "higher" },
    { label: "Croissance CA", key: "revenueGrowth", format: v => fmt(v, "percent"), better: "higher" },
    { label: "Croissance bén.", key: "earningsGrowth", format: v => fmt(v, "percent"), better: "higher" },
  ];

  const getBetter = (row, a, b) => {
    if (!row.better || a == null || b == null) return null;
    if (row.better === "higher") return a > b ? "a" : a < b ? "b" : null;
    return a < b ? "a" : a > b ? "b" : null;
  };

  const metricsA = getMetrics(currentSymbol, currentData);
  const metricsB = compareData ? getMetrics(compareData.symbol, compareData.data) : null;

  return (
    <div className="card">
      <div className="section-title" style={{ marginBottom: 14 }}>Comparer avec une autre action</div>
      <form onSubmit={handleCompare} style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <input
          className="compare-input"
          value={compareSymbol}
          onChange={e => setCompareSymbol(e.target.value)}
          placeholder="Symbole à comparer (ex: MSFT)"
        />
        <button type="submit" className="compare-btn" disabled={loading}>
          {loading ? "..." : "Comparer"}
        </button>
      </form>
      {error && <div className="compare-error">{error}</div>}
      {metricsB && (
        <div style={{ overflowX: "auto" }}>
          <table className="ff-table compare-table">
            <thead>
              <tr>
                <th>Métrique</th>
                <th>{metricsA.name} ({metricsA.symbol})</th>
                <th>{metricsB.name} ({metricsB.symbol})</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const valA = metricsA[row.key];
                const valB = metricsB[row.key];
                const better = getBetter(row, valA, valB);
                return (
                  <tr key={row.key}>
                    <td style={{ fontWeight: 600 }}>{row.label}</td>
                    <td style={{
                      fontWeight: 700,
                      color: row.color ? row.color(valA) : (better === "a" ? "#10b981" : better === "b" ? "#ef4444" : "var(--text)"),
                      background: better === "a" ? "rgba(16,185,129,0.08)" : "transparent"
                    }}>
                      {row.format(valA, metricsA)} {better === "a" ? " ✓" : ""}
                    </td>
                    <td style={{
                      fontWeight: 700,
                      color: row.color ? row.color(valB) : (better === "b" ? "#10b981" : better === "a" ? "#ef4444" : "var(--text)"),
                      background: better === "b" ? "rgba(16,185,129,0.08)" : "transparent"
                    }}>
                      {row.format(valB, metricsB)} {better === "b" ? " ✓" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

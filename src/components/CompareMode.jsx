import { useState } from "react";
import { fetchStockData } from "../utils/api";

// ── Metric extraction (robust: handles both quoteSummary & chart fallback) ──
function extractMetrics(symbol, data) {
  if (!data) return null;
  const pr = data.price;
  const fin = data.financialData;
  const stats = data.defaultKeyStatistics;
  const summ = data.summaryDetail;

  const marketCap = pr?.marketCap?.raw ?? summ?.marketCap?.raw;
  const freeCashflow = fin?.freeCashflow?.raw;
  const operatingCashflow = fin?.operatingCashflow?.raw;
  const revenue = fin?.totalRevenue?.raw;
  const netIncome = data?.incomeStatementHistory?.incomeStatementHistory?.[0]?.netIncome?.raw;

  const sbc = data?.cashflowStatementHistory?.cashflowStatements?.[0]?.stockBasedCompensation?.raw;
  const fcfAdjusted = (freeCashflow != null && sbc != null) ? freeCashflow - Math.abs(sbc) : freeCashflow;

  const pFcf = (marketCap != null && fcfAdjusted != null && fcfAdjusted > 0) ? marketCap / fcfAdjusted : null;
  const pSales = (marketCap != null && revenue != null && revenue > 0) ? marketCap / revenue : null;
  const pOcf = (marketCap != null && operatingCashflow != null && operatingCashflow > 0) ? marketCap / operatingCashflow : null;
  const pe = stats?.trailingPE?.raw ?? summ?.trailingPE?.raw ?? (marketCap != null && netIncome != null && netIncome > 0 ? marketCap / netIncome : null);

  return {
    symbol,
    name: pr?.shortName || pr?.longName || symbol,
    pFcf,
    pSales,
    pOcf,
    pe,
  };
}

const ROWS = [
  { label: "P / FCF (ajusté SBC)", key: "pFcf", format: v => v != null ? `${v.toFixed(1)}x` : "—" },
  { label: "P / Chiffre d'affaires", key: "pSales", format: v => v != null ? `${v.toFixed(1)}x` : "—" },
  { label: "P / Cash flow opérationnel", key: "pOcf", format: v => v != null ? `${v.toFixed(1)}x` : "—" },
  { label: "P / Bénéfice net (P/E)", key: "pe", format: v => v != null ? `${v.toFixed(1)}x` : "—" },
];

export default function CompareMode({ currentSymbol, currentData }) {
  const [compareSymbol, setCompareSymbol] = useState("");
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
            <input
              style={{
                flex: 1,
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
              onChange={e => setCompareSymbol(e.target.value)}
              placeholder="Symbole (ex: MSFT, MC.PA)"
            />
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
        <div style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          marginTop: 12,
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Métrique</th>
                  <th style={{ ...thStyle, color: "var(--accent)" }}>{metricsA.symbol}</th>
                  <th style={{ ...thStyle, color: "var(--text-2)" }}>{metricsB.symbol}</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(row => (
                  <tr key={row.key}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: "var(--text)" }}>{row.label}</td>
                    <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>{row.format(metricsA[row.key])}</td>
                    <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>{row.format(metricsB[row.key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

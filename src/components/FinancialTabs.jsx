import { useState, useEffect } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, AreaChart, Area
} from "recharts";
import { fmt } from "../utils/format";
import { hasFmpApiKey, fetchAllFinancials, getFmpApiKey, setFmpApiKey } from "../utils/fmpApi";

// ── Format helper for FMP data ──
function fmpFmt(v) {
  if (v == null || isNaN(v)) return "—";
  const abs = Math.abs(v), sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)} T`;
  if (abs >= 1e9)  return `${sign}${(abs / 1e9).toFixed(2)} Md`;
  if (abs >= 1e6)  return `${sign}${(abs / 1e6).toFixed(2)} M`;
  if (abs >= 1e3)  return `${sign}${(abs / 1e3).toFixed(1)} K`;
  return `${sign}${abs.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}`;
}

function pctFmt(v) {
  if (v == null || isNaN(v)) return "—";
  return `${(v * 100).toFixed(2)} %`;
}

function ratioFmt(v) {
  if (v == null || isNaN(v)) return "—";
  return v.toFixed(2);
}

// ── Generic table for FMP data ──
function FmpTable({ data, rows, valueFormatter = fmpFmt }) {
  if (!data || data.length === 0) return null;
  const years = data.map(d => d.calendarYear || d.date?.substring(0, 4) || "—");

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="ff-table">
        <thead>
          <tr>
            <th>Poste</th>
            {years.map((y, i) => <th key={i}>{y}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, key, hl, customFmt]) => {
            // Support computed rows (key is a function)
            const isComputed = typeof key === "function";
            return (
              <tr key={label}>
                <td style={{ fontWeight: hl ? 700 : 600, color: hl ? "var(--text)" : "var(--text-secondary)", background: hl ? "var(--highlight-row)" : "transparent" }}>
                  {label}
                </td>
                {data.map((d, i) => {
                  const v = isComputed ? key(d) : d[key];
                  const formatter = customFmt || valueFormatter;
                  return (
                    <td key={i} style={{
                      color: v == null ? "var(--muted)" : v < 0 ? "#dc2626" : "var(--text)",
                      background: hl ? "var(--highlight-row)" : "transparent",
                      fontWeight: hl ? 800 : 600
                    }}>
                      {formatter(v)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Growth enrichment: add _growth fields to FMP data ──
function enrichWithGrowth(data, keys) {
  return data.map((d, i) => {
    const enriched = { ...d };
    if (i < data.length - 1) {
      for (const key of keys) {
        const curr = d[key];
        const prev = data[i + 1][key];
        if (curr != null && prev != null && prev !== 0) {
          enriched[`_growth_${key}`] = (curr - prev) / Math.abs(prev);
        }
      }
    }
    return enriched;
  });
}

function growthFmt(v) {
  if (v == null || isNaN(v) || !isFinite(v)) return "—";
  const pct = v * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)} %`;
}

// ── Ratio metric card ──
function MetricGrid({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
      {items.map(r => (
        <div key={r.label}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{r.label}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: r.color || "#4f46e5" }}>{r.fmt(r.val)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Yahoo Finance table (fallback) ──
function YahooTable({ headers, rows, data }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="ff-table">
        <thead>
          <tr>
            <th>Poste</th>
            {headers.map((h, i) => <th key={i}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, key, hl]) => (
            <tr key={key}>
              <td style={{ fontWeight: hl ? 700 : 600, color: hl ? "var(--text)" : "var(--text-secondary)", background: hl ? "var(--highlight-row)" : "transparent" }}>{label}</td>
              {data.map((s, i) => {
                const v = s[key]?.raw;
                return (
                  <td key={i} style={{
                    color: v == null ? "var(--muted)" : v < 0 ? "#dc2626" : "var(--text)",
                    background: hl ? "var(--highlight-row)" : "transparent",
                    fontWeight: hl ? 800 : 600
                  }}>
                    {fmt(v, "currency")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── API Key Setup Prompt ──
function FmpKeyPrompt({ onKeySet }) {
  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!key.trim()) return;
    setTesting(true);
    setError("");
    try {
      const res = await fetch(`https://financialmodelingprep.com/api/v3/profile/AAPL?apikey=${key.trim()}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error("Clé invalide");
      const data = await res.json();
      if (!data || data.length === 0) throw new Error("Clé invalide");
      setFmpApiKey(key.trim());
      onKeySet();
    } catch {
      setError("Clé API invalide ou erreur réseau. Vérifie ta clé.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ textAlign: "center", padding: "32px 20px" }}>
      <div style={{ fontSize: 42, marginBottom: 14 }}>🔑</div>
      <h3 style={{ fontWeight: 800, color: "var(--text)", marginBottom: 8, fontSize: 17 }}>
        Données financières enrichies
      </h3>
      <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7, maxWidth: 420, margin: "0 auto 18px" }}>
        Pour accéder à <strong>30+ métriques supplémentaires</strong> (marges détaillées, ratios, croissance...),
        entre ta clé API <strong>Financial Modeling Prep</strong> (gratuite, 250 req/jour).
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, maxWidth: 450, margin: "0 auto" }}>
        <input
          className="compare-input"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="Ta clé API FMP..."
          style={{ flex: 1 }}
        />
        <button type="submit" className="compare-btn" disabled={testing || !key.trim()}>
          {testing ? "Test..." : "Activer"}
        </button>
      </form>
      {error && <p style={{ color: "#ef4444", fontSize: 12, fontWeight: 600, marginTop: 8 }}>{error}</p>}
      <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 12 }}>
        📋 Inscription gratuite sur <a href="https://financialmodelingprep.com/developer/docs/" target="_blank" rel="noopener noreferrer" style={{ color: "#4f46e5", fontWeight: 700 }}>financialmodelingprep.com</a>
      </p>
    </div>
  );
}

// ── FMP-powered tabs with margin indicators ──
function MarginBar({ label, value, color }) {
  if (value == null || isNaN(value)) return null;
  const pct = Math.min(Math.max(value * 100, 0), 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ color }}>{(value * 100).toFixed(1)}%</span>
      </div>
      <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width .5s" }} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// BILAN
// ════════════════════════════════════════════════
export function BilanTab({ data, symbol }) {
  const [fmpData, setFmpData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasKey, setHasKey] = useState(hasFmpApiKey());

  useEffect(() => {
    if (!hasKey || !symbol) return;
    let cancelled = false;
    setLoading(true);
    fetchAllFinancials(symbol)
      .then(d => { if (!cancelled) setFmpData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, hasKey]);

  const pr = data?.price;

  // FMP balance sheet data
  if (hasKey && fmpData?.balance?.length > 0) {
    const bs = fmpData.balance;
    const ratios = fmpData.ratios || [];
    const keyMetrics = fmpData.keyMetrics || [];
    const inc = fmpData.income || [];

    // Enrich with computed fields
    const bsEnriched = bs.map((d, i) => ({
      ...d,
      _workingCapital: (d.totalCurrentAssets || 0) - (d.totalCurrentLiabilities || 0),
      _netDebt: (d.totalDebt || 0) - (d.cashAndCashEquivalents || 0),
      _netTangibleAssets: (d.totalStockholdersEquity || 0) - (d.goodwill || 0) - (d.intangibleAssets || 0),
      _debtToAssets: d.totalAssets ? (d.totalDebt || 0) / d.totalAssets : null,
      _equityRatio: d.totalAssets ? (d.totalStockholdersEquity || 0) / d.totalAssets : null,
      _bookValuePerShare: inc[i]?.weightedAverageShsOutDil ? (d.totalStockholdersEquity || 0) / inc[i].weightedAverageShsOutDil : null,
      _tangibleBVPerShare: inc[i]?.weightedAverageShsOutDil ? ((d.totalStockholdersEquity || 0) - (d.goodwill || 0) - (d.intangibleAssets || 0)) / inc[i].weightedAverageShsOutDil : null,
    }));

    const bsChart = [...bs].reverse().map(s => ({
      year: s.calendarYear || s.date?.substring(0, 4),
      Actifs: s.totalAssets ? +(s.totalAssets / 1e9).toFixed(1) : 0,
      Dettes: s.totalLiabilities ? +(s.totalLiabilities / 1e9).toFixed(1) : 0,
      Capitaux: s.totalStockholdersEquity ? +(s.totalStockholdersEquity / 1e9).toFixed(1) : 0,
    }));

    const debtChart = [...bs].reverse().map(s => ({
      year: s.calendarYear || s.date?.substring(0, 4),
      "Dette totale": s.totalDebt ? +(s.totalDebt / 1e9).toFixed(2) : 0,
      "Trésorerie": s.cashAndCashEquivalents ? +(s.cashAndCashEquivalents / 1e9).toFixed(2) : 0,
      "Dette nette": ((s.totalDebt || 0) - (s.cashAndCashEquivalents || 0)) > 0 ? +(((s.totalDebt || 0) - (s.cashAndCashEquivalents || 0)) / 1e9).toFixed(2) : 0,
    }));

    const rows = [
      // Actifs
      ["📊 Total Actifs", "totalAssets", true],
      ["Actifs courants", "totalCurrentAssets", false],
      ["Trésorerie & équivalents", "cashAndCashEquivalents", false],
      ["Placements court terme", "shortTermInvestments", false],
      ["Trésorerie totale", "cashAndShortTermInvestments", false],
      ["Créances clients", "netReceivables", false],
      ["Stocks", "inventory", false],
      ["Charges payées d'avance", "otherCurrentAssets", false],
      ["Actifs non courants", "totalNonCurrentAssets", false],
      ["Immobilisations corporelles", "propertyPlantEquipmentNet", false],
      ["Goodwill", "goodwill", false],
      ["Actifs incorporels", "intangibleAssets", false],
      ["Actifs d'impôts différés", "taxAssets", false],
      ["Investissements long terme", "longTermInvestments", false],
      ["Autres actifs non courants", "otherNonCurrentAssets", false],
      // Passifs
      ["📉 Total Passifs", "totalLiabilities", true],
      ["Passifs courants", "totalCurrentLiabilities", false],
      ["Dettes fournisseurs", "accountPayables", false],
      ["Dette court terme", "shortTermDebt", false],
      ["Revenus différés", "deferredRevenue", false],
      ["Charges à payer", "otherCurrentLiabilities", false],
      ["Passifs non courants", "totalNonCurrentLiabilities", false],
      ["Dette long terme", "longTermDebt", false],
      ["Impôts différés LT", "deferredTaxLiabilitiesNonCurrent", false],
      ["Revenus différés LT", "deferredRevenueNonCurrent", false],
      ["Autres passifs LT", "otherNonCurrentLiabilities", false],
      ["Dette totale", "totalDebt", true],
      // Capitaux propres
      ["💎 Capitaux propres", "totalStockholdersEquity", true],
      ["Capital social", "commonStock", false],
      ["Primes d'émission", "capitalSurplus", false],
      ["Bénéfices non distribués", "retainedEarnings", false],
      ["Actions propres (rachetées)", "treasuryStock", false],
      ["Cumul autres résultats", "accumulatedOtherComprehensiveIncomeLoss", false],
      ["Intérêts minoritaires", "minorityInterest", false],
      ["Total capitaux (minoritaires inclus)", "totalEquity", false],
      ["Total Passifs & Capitaux", "totalLiabilitiesAndStockholdersEquity", true],
      // Métriques calculées
      ["⚡ Fonds de roulement", "_workingCapital", true],
      ["Dette nette", "_netDebt", false],
      ["Actifs tangibles nets", "_netTangibleAssets", false],
      ["Valeur comptable / action", "_bookValuePerShare", false, ratioFmt],
      ["Valeur tangible / action", "_tangibleBVPerShare", false, ratioFmt],
      ["Dette / Actifs", "_debtToAssets", false, pctFmt],
      ["Capitaux / Actifs", "_equityRatio", false, pctFmt],
    ];

    return (
      <div>
        {loading && <div style={{ textAlign: "center", padding: 20 }}><div className="spinner" /></div>}

        {bsChart.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div className="chart-label">📊 BILAN — EN MILLIARDS ({pr?.currency})</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bsChart} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 12, color: "white", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Actifs" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Dettes" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Capitaux" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Graphique dette nette vs trésorerie */}
        {debtChart.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div className="chart-label">🏦 DETTE & TRÉSORERIE — EN MILLIARDS ({pr?.currency})</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={debtChart} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 12, color: "white", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Dette totale" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Trésorerie" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Dette nette" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Ratios de solvabilité */}
        {ratios.length > 0 && (
          <div style={{ marginBottom: 24, padding: "16px 20px", background: "var(--highlight-row)", borderRadius: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>📐 Ratios de solvabilité</div>
            <MetricGrid items={[
              { label: "Ratio de liquidité", val: ratios[0].currentRatio, fmt: ratioFmt, color: "#4f46e5" },
              { label: "Ratio rapide", val: ratios[0].quickRatio, fmt: ratioFmt, color: "#7c3aed" },
              { label: "Ratio de trésorerie", val: ratios[0].cashRatio, fmt: ratioFmt, color: "#0891b2" },
              { label: "Dette / Capitaux", val: ratios[0].debtEquityRatio, fmt: ratioFmt, color: ratios[0].debtEquityRatio > 2 ? "#ef4444" : "#10b981" },
              { label: "Dette / EBITDA", val: keyMetrics[0]?.debtToEbitda, fmt: ratioFmt, color: "#ea580c" },
              { label: "Couverture intérêts", val: ratios[0].interestCoverage, fmt: (v) => v != null ? `${ratioFmt(v)}x` : "—", color: "#0891b2" },
              { label: "Valeur comptable / action", val: keyMetrics[0]?.bookValuePerShare, fmt: ratioFmt, color: "#10b981" },
              { label: "Valeur tangible / action", val: keyMetrics[0]?.tangibleBookValuePerShare, fmt: ratioFmt, color: "#7c3aed" },
            ]} />
          </div>
        )}

        <FmpTable data={bsEnriched} rows={rows} />
        <div style={{ textAlign: "center", marginTop: 14, color: "var(--muted)", fontSize: 11 }}>
          📋 Source : Financial Modeling Prep · {bs.length} années de données
        </div>
      </div>
    );
  }

  // Fallback Yahoo Finance
  const bsArr = data?.balanceSheetHistory?.balanceSheetStatements || [];
  const fin = data?.financialData;
  const bsChart = [...bsArr].reverse().map(s => ({
    year: String(new Date((s.endDate?.raw || 0) * 1000).getFullYear()),
    Actifs: s.totalAssets?.raw ? +(s.totalAssets.raw / 1e9).toFixed(1) : 0,
    Dettes: s.totalLiab?.raw ? +(s.totalLiab.raw / 1e9).toFixed(1) : 0,
    Capitaux: s.totalStockholderEquity?.raw ? +(s.totalStockholderEquity.raw / 1e9).toFixed(1) : 0,
  }));

  const yahooRows = [
    // Actifs
    ["📊 Total Actifs", "totalAssets", true],
    ["Actifs courants", "totalCurrentAssets", false],
    ["Trésorerie & équivalents", "cash", false],
    ["Placements court terme", "shortTermInvestments", false],
    ["Créances clients", "netReceivables", false],
    ["Stocks", "inventory", false],
    ["Autres actifs courants", "otherCurrentAssets", false],
    ["Immobilisations corporelles", "propertyPlantEquipment", false],
    ["Goodwill", "goodWill", false],
    ["Actifs incorporels", "intangibleAssets", false],
    ["Investissements long terme", "longTermInvestments", false],
    ["Autres actifs", "otherAssets", false],
    // Passifs
    ["📉 Total Passifs", "totalLiab", true],
    ["Passifs courants", "totalCurrentLiabilities", false],
    ["Dettes fournisseurs", "accountsPayable", false],
    ["Dette court terme", "shortLongTermDebt", false],
    ["Autres passifs courants", "otherCurrentLiab", false],
    ["Dette long terme", "longTermDebt", false],
    ["Autres passifs", "otherLiab", false],
    // Capitaux propres
    ["💎 Capitaux propres", "totalStockholderEquity", true],
    ["Capital social", "commonStock", false],
    ["Bénéfices non distribués", "retainedEarnings", false],
    ["Actions propres (rachetées)", "treasuryStock", false],
    ["Primes d'émission", "capitalSurplus", false],
    ["Autres capitaux propres", "otherStockholderEquity", false],
    ["Actifs tangibles nets", "netTangibleAssets", false],
  ];

  return (
    <div>
      {bsChart.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="chart-label">📊 BILAN — EN MILLIARDS ({pr?.currency})</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={bsChart} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 12, color: "white", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Actifs" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Dettes" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Capitaux" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ratios Yahoo */}
      {fin && (
        <div style={{ marginBottom: 24, padding: "16px 20px", background: "var(--highlight-row)", borderRadius: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>📐 Ratios de solvabilité</div>
          <MetricGrid items={[
            { label: "Ratio de liquidité", val: fin.currentRatio?.raw, fmt: ratioFmt, color: "#4f46e5" },
            { label: "Ratio rapide", val: fin.quickRatio?.raw, fmt: ratioFmt, color: "#7c3aed" },
            { label: "Dette / Capitaux", val: fin.debtToEquity?.raw, fmt: (v) => v != null ? `${v.toFixed(0)}%` : "—", color: (fin.debtToEquity?.raw ?? 0) > 200 ? "#ef4444" : "#10b981" },
            { label: "Dette totale", val: fin.totalDebt?.raw, fmt: fmpFmt, color: "#ef4444" },
            { label: "Trésorerie totale", val: fin.totalCash?.raw, fmt: fmpFmt, color: "#10b981" },
            { label: "Tréso / action", val: fin.totalCashPerShare?.raw, fmt: ratioFmt, color: "#0891b2" },
          ]} />
        </div>
      )}

      <YahooTable
        headers={bsArr.map(s => new Date((s.endDate?.raw || 0) * 1000).getFullYear())}
        rows={yahooRows}
        data={bsArr}
      />
    </div>
  );
}

// ════════════════════════════════════════════════
// RÉSULTATS
// ════════════════════════════════════════════════
export function ResultatsTab({ data, symbol }) {
  const [fmpData, setFmpData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasKey, setHasKey] = useState(hasFmpApiKey());

  useEffect(() => {
    if (!hasKey || !symbol) return;
    let cancelled = false;
    setLoading(true);
    fetchAllFinancials(symbol)
      .then(d => { if (!cancelled) setFmpData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, hasKey]);

  if (hasKey && fmpData?.income?.length > 0) {
    const inc = fmpData.income;
    const ratios = fmpData.ratios || [];
    const keyMetrics = fmpData.keyMetrics || [];
    const cf = fmpData.cashflow || [];

    // Enrich with growth rates & computed fields
    const incEnriched = enrichWithGrowth(inc, ["revenue", "grossProfit", "operatingIncome", "netIncome", "ebitda", "epsdiluted"]);
    incEnriched.forEach((d, i) => {
      d._taxRate = d.incomeBeforeTax ? d.incomeTaxExpense / d.incomeBeforeTax : null;
      d._rdToRevenue = d.revenue ? (d.researchAndDevelopmentExpenses || 0) / d.revenue : null;
      d._sgaToRevenue = d.revenue ? (d.sellingGeneralAndAdministrativeExpenses || 0) / d.revenue : null;
      d._fcfMargin = d.revenue && cf[i]?.freeCashFlow ? cf[i].freeCashFlow / d.revenue : null;
    });

    const chart = [...inc].reverse().map(s => ({
      year: s.calendarYear || s.date?.substring(0, 4),
      CA: s.revenue ? +(s.revenue / 1e9).toFixed(1) : 0,
      "Rés. Op.": s.operatingIncome ? +(s.operatingIncome / 1e9).toFixed(1) : 0,
      "Rés. Net": s.netIncome ? +(s.netIncome / 1e9).toFixed(1) : 0,
      EBITDA: s.ebitda ? +(s.ebitda / 1e9).toFixed(1) : 0,
    }));

    const epsChart = [...inc].reverse().map(s => ({
      year: s.calendarYear || s.date?.substring(0, 4),
      BPA: s.epsdiluted ? +s.epsdiluted.toFixed(2) : 0,
    }));

    const rows = [
      ["💵 Chiffre d'affaires", "revenue", true],
      ["   ↳ Croissance CA", "_growth_revenue", false, growthFmt],
      ["Coût des ventes", "costOfRevenue", false],
      ["📊 Bénéfice brut", "grossProfit", true],
      ["   ↳ Croissance", "_growth_grossProfit", false, growthFmt],
      ["Marge brute", "grossProfitRatio", false, pctFmt],
      ["R&D", "researchAndDevelopmentExpenses", false],
      ["   ↳ R&D / CA", "_rdToRevenue", false, pctFmt],
      ["Frais commerciaux & admin.", "sellingGeneralAndAdministrativeExpenses", false],
      ["   ↳ SGA / CA", "_sgaToRevenue", false, pctFmt],
      ["Frais généraux", "generalAndAdministrativeExpenses", false],
      ["Dépréciations & amortissements", "depreciationAndAmortization", false],
      ["Autres charges d'exploitation", "otherExpenses", false],
      ["Total charges d'exploitation", "operatingExpenses", false],
      ["📈 Résultat opérationnel", "operatingIncome", true],
      ["   ↳ Croissance", "_growth_operatingIncome", false, growthFmt],
      ["Marge opérationnelle", "operatingIncomeRatio", false, pctFmt],
      ["Charges d'intérêts", "interestExpense", false],
      ["Produits d'intérêts", "interestIncome", false],
      ["Charges d'intérêts nettes", "netInterestIncome", false],
      ["Autres produits/charges", "totalOtherIncomeExpensesNet", false],
      ["Résultat avant impôts", "incomeBeforeTax", true],
      ["Impôts", "incomeTaxExpense", false],
      ["Taux d'imposition effectif", "_taxRate", false, pctFmt],
      ["💰 Résultat net", "netIncome", true],
      ["   ↳ Croissance", "_growth_netIncome", false, growthFmt],
      ["Marge nette", "netIncomeRatio", false, pctFmt],
      ["Marge FCF", "_fcfMargin", false, pctFmt],
      ["BPA (basique)", "eps", false, ratioFmt],
      ["BPA (dilué)", "epsdiluted", false, ratioFmt],
      ["   ↳ Croissance BPA", "_growth_epsdiluted", false, growthFmt],
      ["Nb actions (basique)", "weightedAverageShsOut", false],
      ["Nb actions (dilué)", "weightedAverageShsOutDil", false],
      ["EBITDA", "ebitda", true],
      ["   ↳ Croissance EBITDA", "_growth_ebitda", false, growthFmt],
      ["EBITDA Ratio", "ebitdaratio", false, pctFmt],
    ];

    const latest = inc[0];

    return (
      <div>
        {loading && <div style={{ textAlign: "center", padding: 20 }}><div className="spinner" /></div>}

        {chart.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div className="chart-label">📊 COMPTE DE RÉSULTAT — EN MILLIARDS ({data?.price?.currency})</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 12, color: "white", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="CA" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="EBITDA" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Rés. Op." fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Rés. Net" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* BPA Evolution */}
        {epsChart.length > 1 && (
          <div style={{ marginBottom: 28 }}>
            <div className="chart-label">💰 BPA DILUÉ — ÉVOLUTION</div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={epsChart} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 12, color: "white", fontSize: 12 }} />
                <Area type="monotone" dataKey="BPA" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Marges visuelles */}
        {latest && (
          <div style={{ marginBottom: 24, padding: "16px 20px", background: "var(--highlight-row)", borderRadius: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 14 }}>📐 Marges ({latest.calendarYear || latest.date?.substring(0, 4)})</div>
            <MarginBar label="Marge brute" value={latest.grossProfitRatio} color="#4f46e5" />
            <MarginBar label="Marge opérationnelle" value={latest.operatingIncomeRatio} color="#f59e0b" />
            <MarginBar label="Marge EBITDA" value={latest.ebitdaratio} color="#7c3aed" />
            <MarginBar label="Marge nette" value={latest.netIncomeRatio} color="#10b981" />
            {cf[0] && latest.revenue && (
              <MarginBar label="Marge FCF" value={cf[0].freeCashFlow / latest.revenue} color="#0891b2" />
            )}
          </div>
        )}

        {/* Évolution des marges en area chart */}
        {inc.length > 1 && (
          <div style={{ marginBottom: 28 }}>
            <div className="chart-label">📈 ÉVOLUTION DES MARGES</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={[...inc].reverse().map((s, i) => ({
                year: s.calendarYear || s.date?.substring(0, 4),
                "Marge brute": s.grossProfitRatio ? +(s.grossProfitRatio * 100).toFixed(1) : 0,
                "Marge op.": s.operatingIncomeRatio ? +(s.operatingIncomeRatio * 100).toFixed(1) : 0,
                "Marge nette": s.netIncomeRatio ? +(s.netIncomeRatio * 100).toFixed(1) : 0,
              }))} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} unit="%" />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 12, color: "white", fontSize: 12 }} formatter={v => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="Marge brute" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="Marge op." stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="Marge nette" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Ratios de rentabilité */}
        {ratios.length > 0 && (
          <div style={{ marginBottom: 24, padding: "16px 20px", background: "var(--highlight-row)", borderRadius: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>🎯 Ratios de rentabilité</div>
            <MetricGrid items={[
              { label: "ROE", val: ratios[0].returnOnEquity, fmt: pctFmt, color: "#4f46e5" },
              { label: "ROA", val: ratios[0].returnOnAssets, fmt: pctFmt, color: "#7c3aed" },
              { label: "ROIC", val: ratios[0].returnOnCapitalEmployed, fmt: pctFmt, color: "#10b981" },
              { label: "BPA (dilué)", val: inc[0]?.epsdiluted, fmt: ratioFmt, color: "#0891b2" },
              { label: "P/E Ratio", val: ratios[0].priceEarningsRatio, fmt: ratioFmt, color: "#ea580c" },
              { label: "P/B Ratio", val: ratios[0].priceToBookRatio, fmt: ratioFmt, color: "#f59e0b" },
              { label: "PEG Ratio", val: ratios[0].priceEarningsToGrowthRatio, fmt: ratioFmt, color: "#4f46e5" },
              { label: "EV / EBITDA", val: keyMetrics[0]?.enterpriseValueOverEBITDA, fmt: ratioFmt, color: "#7c3aed" },
              { label: "EV / CA", val: keyMetrics[0]?.evToSales, fmt: ratioFmt, color: "#0891b2" },
              { label: "Prix / FCF", val: keyMetrics[0]?.pfcfRatio, fmt: ratioFmt, color: "#10b981" },
              { label: "Rendement dividende", val: ratios[0].dividendYield, fmt: pctFmt, color: "#f59e0b" },
              { label: "Taux de distribution", val: ratios[0].payoutRatio, fmt: pctFmt, color: "#ea580c" },
            ]} />
          </div>
        )}

        <FmpTable data={incEnriched} rows={rows} />
        <div style={{ textAlign: "center", marginTop: 14, color: "var(--muted)", fontSize: 11 }}>
          📋 Source : Financial Modeling Prep · {inc.length} années de données
        </div>
      </div>
    );
  }

  // Fallback Yahoo Finance
  const isArr = data?.incomeStatementHistory?.incomeStatementHistory || [];
  const fin2 = data?.financialData;
  const yahooRows = [
    ["💵 Chiffre d'affaires", "totalRevenue", true],
    ["Coût des ventes", "costOfRevenue", false],
    ["📊 Bénéfice brut", "grossProfit", true],
    ["R&D", "researchDevelopment", false],
    ["Frais commerciaux & admin.", "sellingGeneralAdministrative", false],
    ["Autres charges", "otherOperatingExpenses", false],
    ["Total charges d'exploitation", "totalOperatingExpenses", false],
    ["📈 Résultat opérationnel", "operatingIncome", true],
    ["EBIT", "ebit", false],
    ["Charges d'intérêts", "interestExpense", false],
    ["Autres produits/charges", "totalOtherIncomeExpenseNet", false],
    ["Résultat avant impôts", "incomeBeforeTax", true],
    ["Impôts", "incomeTaxExpense", false],
    ["Résultat des opérations continues", "netIncomeFromContinuingOps", false],
    ["Opérations discontinues", "discontinuedOperations", false],
    ["Éléments extraordinaires", "extraordinaryItems", false],
    ["💰 Résultat net", "netIncome", true],
    ["Résultat net (actionnaires)", "netIncomeApplicableToCommonShares", false],
  ];

  const isChart = [...isArr].reverse().map(s => ({
    year: String(new Date((s.endDate?.raw || 0) * 1000).getFullYear()),
    CA: s.totalRevenue?.raw ? +(s.totalRevenue.raw / 1e9).toFixed(1) : 0,
    "Bén. brut": s.grossProfit?.raw ? +(s.grossProfit.raw / 1e9).toFixed(1) : 0,
    "Rés. Op.": s.operatingIncome?.raw ? +(s.operatingIncome.raw / 1e9).toFixed(1) : 0,
    "Rés. Net": s.netIncome?.raw ? +(s.netIncome.raw / 1e9).toFixed(1) : 0,
  }));

  return (
    <div>
      {isChart.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="chart-label">📊 COMPTE DE RÉSULTAT — EN MILLIARDS ({data?.price?.currency})</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={isChart} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 12, color: "white", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="CA" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Bén. brut" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Rés. Op." fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Rés. Net" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ratios Yahoo */}
      {fin2 && (
        <div style={{ marginBottom: 24, padding: "16px 20px", background: "var(--highlight-row)", borderRadius: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>🎯 Rentabilité & Marges</div>
          <MetricGrid items={[
            { label: "Croissance CA", val: fin2.revenueGrowth?.raw, fmt: pctFmt, color: "#4f46e5" },
            { label: "Croissance bénéfices", val: fin2.earningsGrowth?.raw, fmt: pctFmt, color: "#10b981" },
            { label: "Marge brute", val: fin2.grossMargins?.raw, fmt: pctFmt, color: "#7c3aed" },
            { label: "Marge opérationnelle", val: fin2.operatingMargins?.raw, fmt: pctFmt, color: "#f59e0b" },
            { label: "Marge nette", val: fin2.profitMargins?.raw, fmt: pctFmt, color: "#10b981" },
            { label: "ROE", val: fin2.returnOnEquity?.raw, fmt: pctFmt, color: "#0891b2" },
            { label: "ROA", val: fin2.returnOnAssets?.raw, fmt: pctFmt, color: "#ea580c" },
            { label: "Chiffre d'affaires", val: fin2.totalRevenue?.raw, fmt: fmpFmt, color: "#4f46e5" },
            { label: "Free Cash Flow", val: fin2.freeCashflow?.raw, fmt: fmpFmt, color: "#10b981" },
          ]} />
        </div>
      )}

      <YahooTable
        headers={isArr.map(s => new Date((s.endDate?.raw || 0) * 1000).getFullYear())}
        rows={yahooRows}
        data={isArr}
      />
    </div>
  );
}

// ════════════════════════════════════════════════
// TRÉSORERIE
// ════════════════════════════════════════════════
export function TresorerieTab({ data, symbol }) {
  const [fmpData, setFmpData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasKey, setHasKey] = useState(hasFmpApiKey());

  useEffect(() => {
    if (!hasKey || !symbol) return;
    let cancelled = false;
    setLoading(true);
    fetchAllFinancials(symbol)
      .then(d => { if (!cancelled) setFmpData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, hasKey]);

  if (hasKey && fmpData?.cashflow?.length > 0) {
    const cf = fmpData.cashflow;
    const keyMetrics = fmpData.keyMetrics || [];
    const inc2 = fmpData.income || [];

    // Enrich with growth & computed
    const cfEnriched = enrichWithGrowth(cf, ["operatingCashFlow", "freeCashFlow"]);
    cfEnriched.forEach((d, i) => {
      d._fcfMargin = inc2[i]?.revenue ? d.freeCashFlow / inc2[i].revenue : null;
      d._capexToRevenue = inc2[i]?.revenue && d.capitalExpenditure ? Math.abs(d.capitalExpenditure) / inc2[i].revenue : null;
      d._fcfConversion = d.netIncome && d.netIncome !== 0 ? d.freeCashFlow / d.netIncome : null;
      d._sbcToRevenue = inc2[i]?.revenue && d.stockBasedCompensation ? d.stockBasedCompensation / inc2[i].revenue : null;
      d._operatingCFToDebt = fmpData.balance?.[i]?.totalDebt ? d.operatingCashFlow / fmpData.balance[i].totalDebt : null;
    });

    const chart = [...cf].reverse().map(s => ({
      year: s.calendarYear || s.date?.substring(0, 4),
      "Flux Op.": s.operatingCashFlow ? +(s.operatingCashFlow / 1e9).toFixed(1) : 0,
      FCF: s.freeCashFlow ? +(s.freeCashFlow / 1e9).toFixed(1) : 0,
      CAPEX: s.capitalExpenditure ? +(Math.abs(s.capitalExpenditure) / 1e9).toFixed(1) : 0,
    }));

    const allocationChart = [...cf].reverse().map(s => ({
      year: s.calendarYear || s.date?.substring(0, 4),
      CAPEX: s.capitalExpenditure ? +(Math.abs(s.capitalExpenditure) / 1e9).toFixed(2) : 0,
      Dividendes: s.dividendsPaid ? +(Math.abs(s.dividendsPaid) / 1e9).toFixed(2) : 0,
      Rachats: s.commonStockRepurchased ? +(Math.abs(s.commonStockRepurchased) / 1e9).toFixed(2) : 0,
      "Remb. dette": s.debtRepayment ? +(Math.abs(s.debtRepayment) / 1e9).toFixed(2) : 0,
    }));

    const rows = [
      // Operating
      ["🔄 Flux opérationnels", "operatingCashFlow", true],
      ["   ↳ Croissance", "_growth_operatingCashFlow", false, growthFmt],
      ["Résultat net", "netIncome", false],
      ["D&A (Dépréciations)", "depreciationAndAmortization", false],
      ["Rémunération en actions (SBC)", "stockBasedCompensation", false],
      ["   ↳ SBC / CA", "_sbcToRevenue", false, pctFmt],
      ["Impôts différés", "deferredIncomeTax", false],
      ["Variation du BFR", "changeInWorkingCapital", false],
      ["Variation créances", "accountsReceivables", false],
      ["Variation stocks", "inventory", false],
      ["Variation fournisseurs", "accountsPayables", false],
      ["Autres flux opérationnels", "otherWorkingCapital", false],
      ["Autres éléments non cash", "otherNonCashItems", false],
      // Investing
      ["📉 Flux d'investissement", "netCashUsedForInvestingActivites", true],
      ["CAPEX", "capitalExpenditure", false],
      ["   ↳ CAPEX / CA", "_capexToRevenue", false, pctFmt],
      ["Acquisitions", "acquisitionsNet", false],
      ["Achats d'investissements", "purchasesOfInvestments", false],
      ["Ventes d'investissements", "salesMaturitiesOfInvestments", false],
      ["Autres investissements", "otherInvestingActivites", false],
      // Financing
      ["🏦 Flux de financement", "netCashUsedProvidedByFinancingActivities", true],
      ["Remboursement de dette", "debtRepayment", false],
      ["Émission de dette", "netDebtIssuance", false],
      ["Émission d'actions", "commonStockIssued", false],
      ["Rachat d'actions", "commonStockRepurchased", false],
      ["Dividendes versés", "dividendsPaid", false],
      ["Autres flux de financement", "otherFinancingActivites", false],
      // Summary
      ["💰 Free Cash Flow", "freeCashFlow", true],
      ["   ↳ Croissance FCF", "_growth_freeCashFlow", false, growthFmt],
      ["Marge FCF (FCF / CA)", "_fcfMargin", false, pctFmt],
      ["Conversion FCF (FCF / RN)", "_fcfConversion", false, pctFmt],
      ["Flux Op. / Dette", "_operatingCFToDebt", false, pctFmt],
      ["Effet de change", "effectOfForexChangesOnCash", false],
      ["Variation nette de tréso", "netChangeInCash", false],
      ["Tréso début de période", "cashAtBeginningOfPeriod", false],
      ["Tréso fin de période", "cashAtEndOfPeriod", true],
    ];

    return (
      <div>
        {loading && <div style={{ textAlign: "center", padding: 20 }}><div className="spinner" /></div>}

        {chart.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div className="chart-label">🔄 FLUX DE TRÉSORERIE — EN MILLIARDS ({data?.price?.currency})</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 12, color: "white", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Flux Op." fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="FCF" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="CAPEX" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Allocation du capital */}
        {allocationChart.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div className="chart-label">🏦 ALLOCATION DU CAPITAL — EN MILLIARDS ({data?.price?.currency})</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={allocationChart} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 12, color: "white", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="CAPEX" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Dividendes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Rachats" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Remb. dette" fill="#0891b2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Métriques de trésorerie */}
        {cf.length > 0 && (
          <div style={{ marginBottom: 24, padding: "16px 20px", background: "var(--highlight-row)", borderRadius: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>💰 Métriques de trésorerie</div>
            <MetricGrid items={[
              { label: "Free Cash Flow", val: cf[0].freeCashFlow, fmt: fmpFmt, color: "#10b981" },
              { label: "Flux opérationnels", val: cf[0].operatingCashFlow, fmt: fmpFmt, color: "#4f46e5" },
              { label: "Conversion FCF/RN", val: cf[0].netIncome ? cf[0].freeCashFlow / cf[0].netIncome : null, fmt: pctFmt, color: "#4f46e5" },
              { label: "CAPEX / CA", val: inc2[0]?.revenue && cf[0].capitalExpenditure ? Math.abs(cf[0].capitalExpenditure) / inc2[0].revenue : null, fmt: pctFmt, color: "#ea580c" },
              { label: "SBC / CA", val: inc2[0]?.revenue && cf[0].stockBasedCompensation ? cf[0].stockBasedCompensation / inc2[0].revenue : null, fmt: pctFmt, color: "#f59e0b" },
              { label: "Marge FCF", val: inc2[0]?.revenue ? cf[0].freeCashFlow / inc2[0].revenue : null, fmt: pctFmt, color: "#10b981" },
              ...(keyMetrics.length > 0 ? [
                { label: "FCF / Action", val: keyMetrics[0].freeCashFlowPerShare, fmt: ratioFmt, color: "#0891b2" },
                { label: "FCF Yield", val: keyMetrics[0].freeCashFlowYield, fmt: pctFmt, color: "#7c3aed" },
                { label: "Dividendes / Action", val: keyMetrics[0].dividendPerShare, fmt: ratioFmt, color: "#f59e0b" },
              ] : []),
            ]} />
          </div>
        )}

        {/* FCF Evolution area chart */}
        {cf.length > 1 && (
          <div style={{ marginBottom: 28 }}>
            <div className="chart-label">📈 ÉVOLUTION DU FREE CASH FLOW</div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={[...cf].reverse().map(s => ({
                year: s.calendarYear || s.date?.substring(0, 4),
                FCF: s.freeCashFlow ? +(s.freeCashFlow / 1e9).toFixed(2) : 0,
              }))} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 12, color: "white", fontSize: 12 }} formatter={v => `${v} Md`} />
                <Area type="monotone" dataKey="FCF" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <FmpTable data={cfEnriched} rows={rows} />
        <div style={{ textAlign: "center", marginTop: 14, color: "var(--muted)", fontSize: 11 }}>
          📋 Source : Financial Modeling Prep · {cf.length} années de données
        </div>
      </div>
    );
  }

  // Fallback Yahoo Finance
  const cfArr = data?.cashflowStatementHistory?.cashflowStatements || [];
  const fin3 = data?.financialData;
  const yahooRows = [
    // Opérationnel
    ["🔄 Flux opérationnels", "totalCashFromOperatingActivities", true],
    ["Dépréciations & amortissements", "depreciation", false],
    ["Variation créances", "changeToAccountReceivables", false],
    ["Variation stocks", "changeToInventory", false],
    ["Variation passifs", "changeToLiabilities", false],
    ["Variation du BFR", "changeToOperatingActivities", false],
    ["Autres éléments opérationnels", "otherCashflowsFromOperatingActivities", false],
    // Investissement
    ["📉 Flux d'investissement", "totalCashFromInvestingActivities", true],
    ["CAPEX", "capitalExpenditures", false],
    ["Autres investissements", "otherCashflowsFromInvestingActivities", false],
    // Financement
    ["🏦 Flux de financement", "totalCashFromFinancingActivities", true],
    ["Emprunts nets", "netBorrowings", false],
    ["Émission d'actions", "issuanceOfStock", false],
    ["Rachat d'actions", "repurchaseOfStock", false],
    ["Dividendes versés", "dividendsPaid", false],
    ["Autres flux de financement", "otherCashflowsFromFinancingActivities", false],
    // Résumé
    ["💰 Free Cash Flow", "freeCashFlow", true],
    ["Variation nette de tréso", "changeInCash", false],
  ];

  const cfChart = [...cfArr].reverse().map(s => ({
    year: String(new Date((s.endDate?.raw || 0) * 1000).getFullYear()),
    "Flux Op.": s.totalCashFromOperatingActivities?.raw ? +(s.totalCashFromOperatingActivities.raw / 1e9).toFixed(1) : 0,
    FCF: s.freeCashFlow?.raw ? +(s.freeCashFlow.raw / 1e9).toFixed(1) : 0,
    CAPEX: s.capitalExpenditures?.raw ? +(Math.abs(s.capitalExpenditures.raw) / 1e9).toFixed(1) : 0,
  }));

  return (
    <div>
      {cfChart.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="chart-label">🔄 FLUX DE TRÉSORERIE — EN MILLIARDS ({data?.price?.currency})</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={cfChart} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 12, color: "white", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Flux Op." fill="#4f46e5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="FCF" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="CAPEX" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Métriques Yahoo */}
      {fin3 && (
        <div style={{ marginBottom: 24, padding: "16px 20px", background: "var(--highlight-row)", borderRadius: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>💰 Métriques de trésorerie</div>
          <MetricGrid items={[
            { label: "Free Cash Flow", val: fin3.freeCashflow?.raw, fmt: fmpFmt, color: "#10b981" },
            { label: "Flux opérationnels", val: fin3.operatingCashflow?.raw, fmt: fmpFmt, color: "#4f46e5" },
            { label: "Chiffre d'affaires", val: fin3.totalRevenue?.raw, fmt: fmpFmt, color: "#7c3aed" },
            { label: "Marge FCF", val: fin3.freeCashflow?.raw && fin3.totalRevenue?.raw ? fin3.freeCashflow.raw / fin3.totalRevenue.raw : null, fmt: pctFmt, color: "#0891b2" },
          ]} />
        </div>
      )}

      <YahooTable
        headers={cfArr.map(s => new Date((s.endDate?.raw || 0) * 1000).getFullYear())}
        rows={yahooRows}
        data={cfArr}
      />
    </div>
  );
}

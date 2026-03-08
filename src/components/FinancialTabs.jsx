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
          {rows.map(([label, key, hl, customFmt]) => (
            <tr key={key}>
              <td style={{ fontWeight: hl ? 700 : 600, color: hl ? "var(--text)" : "var(--text-secondary)", background: hl ? "var(--highlight-row)" : "transparent" }}>
                {label}
              </td>
              {data.map((d, i) => {
                const v = d[key];
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
          ))}
        </tbody>
      </table>
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

    const bsChart = [...bs].reverse().map(s => ({
      year: s.calendarYear || s.date?.substring(0, 4),
      Actifs: s.totalAssets ? +(s.totalAssets / 1e9).toFixed(1) : 0,
      Dettes: s.totalLiabilities ? +(s.totalLiabilities / 1e9).toFixed(1) : 0,
      Capitaux: s.totalStockholdersEquity ? +(s.totalStockholdersEquity / 1e9).toFixed(1) : 0,
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
      ["Autres actifs courants", "otherCurrentAssets", false],
      ["Actifs non courants", "totalNonCurrentAssets", false],
      ["Immobilisations corporelles", "propertyPlantEquipmentNet", false],
      ["Goodwill", "goodwill", false],
      ["Actifs incorporels", "intangibleAssets", false],
      ["Investissements long terme", "longTermInvestments", false],
      ["Autres actifs non courants", "otherNonCurrentAssets", false],
      // Passifs
      ["📉 Total Passifs", "totalLiabilities", true],
      ["Passifs courants", "totalCurrentLiabilities", false],
      ["Dettes fournisseurs", "accountPayables", false],
      ["Dette court terme", "shortTermDebt", false],
      ["Impôts différés", "deferredRevenue", false],
      ["Autres passifs courants", "otherCurrentLiabilities", false],
      ["Passifs non courants", "totalNonCurrentLiabilities", false],
      ["Dette long terme", "longTermDebt", false],
      ["Impôts différés LT", "deferredTaxLiabilitiesNonCurrent", false],
      ["Autres passifs LT", "otherNonCurrentLiabilities", false],
      ["Dette totale", "totalDebt", true],
      // Capitaux propres
      ["💎 Capitaux propres", "totalStockholdersEquity", true],
      ["Capital social", "commonStock", false],
      ["Bénéfices non distribués", "retainedEarnings", false],
      ["Cumul autres résultats", "accumulatedOtherComprehensiveIncomeLoss", false],
      ["Total capitaux (minoritaires inclus)", "totalEquity", false],
      // Ratios calculés
      ["Intérêts minoritaires", "minorityInterest", false],
      ["Total Passifs & Capitaux", "totalLiabilitiesAndStockholdersEquity", true],
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

        {/* Ratios de solvabilité */}
        {ratios.length > 0 && (
          <div style={{ marginBottom: 24, padding: "16px 20px", background: "var(--highlight-row)", borderRadius: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>📐 Ratios de solvabilité</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Ratio de liquidité</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#4f46e5" }}>{ratioFmt(ratios[0].currentRatio)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Ratio rapide</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#7c3aed" }}>{ratioFmt(ratios[0].quickRatio)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Dette / Capitaux</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: ratios[0].debtEquityRatio > 2 ? "#ef4444" : "#10b981" }}>
                  {ratioFmt(ratios[0].debtEquityRatio)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Couverture intérêts</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#0891b2" }}>{ratioFmt(ratios[0].interestCoverage)}x</div>
              </div>
            </div>
          </div>
        )}

        <FmpTable data={bs} rows={rows} />
        <div style={{ textAlign: "center", marginTop: 14, color: "var(--muted)", fontSize: 11 }}>
          📋 Source : Financial Modeling Prep · {bs.length} années de données
        </div>
      </div>
    );
  }

  // Fallback Yahoo Finance
  const bsArr = data?.balanceSheetHistory?.balanceSheetStatements || [];
  const bsChart = [...bsArr].reverse().map(s => ({
    year: String(new Date((s.endDate?.raw || 0) * 1000).getFullYear()),
    Actifs: s.totalAssets?.raw ? +(s.totalAssets.raw / 1e9).toFixed(1) : 0,
    Dettes: s.totalLiab?.raw ? +(s.totalLiab.raw / 1e9).toFixed(1) : 0,
    Capitaux: s.totalStockholderEquity?.raw ? +(s.totalStockholderEquity.raw / 1e9).toFixed(1) : 0,
  }));

  const yahooRows = [
    ["Total Actifs", "totalAssets", true],
    ["Actifs courants", "totalCurrentAssets", false],
    ["Trésorerie & équivalents", "cash", false],
    ["Créances clients", "netReceivables", false],
    ["Stocks", "inventory", false],
    ["Total Passifs", "totalLiab", true],
    ["Passifs courants", "totalCurrentLiabilities", false],
    ["Dette long terme", "longTermDebt", false],
    ["Capitaux propres", "totalStockholderEquity", true],
  ];

  return (
    <div>
      {!hasKey && <FmpKeyPrompt onKeySet={() => setHasKey(true)} />}
      {bsChart.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="chart-label">EN MILLIARDS ({pr?.currency})</div>
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

    const chart = [...inc].reverse().map(s => ({
      year: s.calendarYear || s.date?.substring(0, 4),
      CA: s.revenue ? +(s.revenue / 1e9).toFixed(1) : 0,
      "Rés. Op.": s.operatingIncome ? +(s.operatingIncome / 1e9).toFixed(1) : 0,
      "Rés. Net": s.netIncome ? +(s.netIncome / 1e9).toFixed(1) : 0,
      EBITDA: s.ebitda ? +(s.ebitda / 1e9).toFixed(1) : 0,
    }));

    const rows = [
      ["💵 Chiffre d'affaires", "revenue", true],
      ["Coût des ventes", "costOfRevenue", false],
      ["📊 Bénéfice brut", "grossProfit", true],
      ["R&D", "researchAndDevelopmentExpenses", false],
      ["Frais commerciaux & admin.", "sellingGeneralAndAdministrativeExpenses", false],
      ["Frais généraux", "generalAndAdministrativeExpenses", false],
      ["Autres charges d'exploitation", "otherExpenses", false],
      ["Total charges d'exploitation", "operatingExpenses", false],
      ["📈 Résultat opérationnel", "operatingIncome", true],
      ["Charges d'intérêts", "interestExpense", false],
      ["Produits d'intérêts", "interestIncome", false],
      ["Charges d'intérêts nettes", "netInterestIncome", false],
      ["Autres produits/charges", "totalOtherIncomeExpensesNet", false],
      ["Résultat avant impôts", "incomeBeforeTax", true],
      ["Impôts", "incomeTaxExpense", false],
      ["💰 Résultat net", "netIncome", true],
      ["BPA (dilué)", "epsdiluted", false, ratioFmt],
      ["Nb actions (dilué)", "weightedAverageShsOutDil", false],
      ["EBITDA", "ebitda", true],
      ["EBITDA Ratio", "ebitdaratio", false, pctFmt],
    ];

    // Latest margins
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

        {/* Marges visuelles */}
        {latest && (
          <div style={{ marginBottom: 24, padding: "16px 20px", background: "var(--highlight-row)", borderRadius: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 14 }}>📐 Marges ({latest.calendarYear || latest.date?.substring(0, 4)})</div>
            <MarginBar label="Marge brute" value={latest.grossProfitRatio} color="#4f46e5" />
            <MarginBar label="Marge opérationnelle" value={latest.operatingIncomeRatio} color="#f59e0b" />
            <MarginBar label="Marge EBITDA" value={latest.ebitdaratio} color="#7c3aed" />
            <MarginBar label="Marge nette" value={latest.netIncomeRatio} color="#10b981" />
          </div>
        )}

        {/* Évolution des marges en area chart */}
        {inc.length > 1 && (
          <div style={{ marginBottom: 28 }}>
            <div className="chart-label">📈 ÉVOLUTION DES MARGES</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={[...inc].reverse().map(s => ({
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
              {[
                { label: "ROE", val: ratios[0].returnOnEquity, fmt: pctFmt },
                { label: "ROA", val: ratios[0].returnOnAssets, fmt: pctFmt },
                { label: "ROIC", val: ratios[0].returnOnCapitalEmployed, fmt: pctFmt },
                { label: "BPA (dilué)", val: fmpData.income[0]?.epsdiluted, fmt: ratioFmt },
                { label: "P/E Ratio", val: ratios[0].priceEarningsRatio, fmt: ratioFmt },
                { label: "P/B Ratio", val: ratios[0].priceToBookRatio, fmt: ratioFmt },
              ].map(r => (
                <div key={r.label}>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{r.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#4f46e5" }}>{r.fmt(r.val)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <FmpTable data={inc} rows={rows} />
        <div style={{ textAlign: "center", marginTop: 14, color: "var(--muted)", fontSize: 11 }}>
          📋 Source : Financial Modeling Prep · {inc.length} années de données
        </div>
      </div>
    );
  }

  // Fallback Yahoo Finance
  const isArr = data?.incomeStatementHistory?.incomeStatementHistory || [];
  const yahooRows = [
    ["Chiffre d'affaires", "totalRevenue", true],
    ["Bénéfice brut", "grossProfit", false],
    ["Charges opérationnelles", "totalOperatingExpenses", false],
    ["Résultat opérationnel", "operatingIncome", true],
    ["EBIT", "ebit", false],
    ["Charges d'intérêts", "interestExpense", false],
    ["Impôts", "incomeTaxExpense", false],
    ["Résultat net", "netIncome", true],
  ];

  const isChart = [...isArr].reverse().map(s => ({
    year: String(new Date((s.endDate?.raw || 0) * 1000).getFullYear()),
    CA: s.totalRevenue?.raw ? +(s.totalRevenue.raw / 1e9).toFixed(1) : 0,
    "Rés. Net": s.netIncome?.raw ? +(s.netIncome.raw / 1e9).toFixed(1) : 0,
    "Rés. Op.": s.operatingIncome?.raw ? +(s.operatingIncome.raw / 1e9).toFixed(1) : 0,
  }));

  return (
    <div>
      {!hasKey && <FmpKeyPrompt onKeySet={() => setHasKey(true)} />}
      {isChart.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="chart-label">EN MILLIARDS ({data?.price?.currency})</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={isChart} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 12, color: "white", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="CA" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Rés. Op." fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Rés. Net" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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

    const chart = [...cf].reverse().map(s => ({
      year: s.calendarYear || s.date?.substring(0, 4),
      "Flux Op.": s.operatingCashFlow ? +(s.operatingCashFlow / 1e9).toFixed(1) : 0,
      FCF: s.freeCashFlow ? +(s.freeCashFlow / 1e9).toFixed(1) : 0,
      CAPEX: s.capitalExpenditure ? +(Math.abs(s.capitalExpenditure) / 1e9).toFixed(1) : 0,
    }));

    const rows = [
      // Operating
      ["🔄 Flux opérationnels", "operatingCashFlow", true],
      ["Résultat net", "netIncome", false],
      ["D&A (Dépréciations)", "depreciationAndAmortization", false],
      ["Rémunération en actions", "stockBasedCompensation", false],
      ["Variation du BFR", "changeInWorkingCapital", false],
      ["Variation créances", "accountsReceivables", false],
      ["Variation stocks", "inventory", false],
      ["Variation fournisseurs", "accountsPayables", false],
      ["Autres flux opérationnels", "otherWorkingCapital", false],
      ["Autres éléments non cash", "otherNonCashItems", false],
      // Investing
      ["📉 Flux d'investissement", "netCashUsedForInvestingActivites", true],
      ["CAPEX", "capitalExpenditure", false],
      ["Acquisitions", "acquisitionsNet", false],
      ["Achats d'investissements", "purchasesOfInvestments", false],
      ["Ventes d'investissements", "salesMaturitiesOfInvestments", false],
      ["Autres investissements", "otherInvestingActivites", false],
      // Financing
      ["🏦 Flux de financement", "netCashUsedProvidedByFinancingActivities", true],
      ["Remboursement de dette", "debtRepayment", false],
      ["Émission d'actions", "commonStockIssued", false],
      ["Rachat d'actions", "commonStockRepurchased", false],
      ["Dividendes versés", "dividendsPaid", false],
      ["Autres flux de financement", "otherFinancingActivites", false],
      // Summary
      ["💰 Free Cash Flow", "freeCashFlow", true],
      ["Variation nette de tréso", "netChangeInCash", false],
      ["Tréso début de période", "cashAtBeginningOfPeriod", false],
      ["Tréso fin de période", "cashAtEndOfPeriod", false],
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

        {/* Conversion rate & key cash metrics */}
        {cf.length > 0 && (
          <div style={{ marginBottom: 24, padding: "16px 20px", background: "var(--highlight-row)", borderRadius: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>💰 Métriques de trésorerie</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Free Cash Flow</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#10b981" }}>{fmpFmt(cf[0].freeCashFlow)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Taux conversion FCF</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#4f46e5" }}>
                  {cf[0].operatingCashFlow && cf[0].netIncome
                    ? `${((cf[0].freeCashFlow / cf[0].netIncome) * 100).toFixed(0)}%`
                    : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>CAPEX / CA</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#ea580c" }}>
                  {fmpData.income?.[0]?.revenue && cf[0].capitalExpenditure
                    ? `${((Math.abs(cf[0].capitalExpenditure) / fmpData.income[0].revenue) * 100).toFixed(1)}%`
                    : "—"}
                </div>
              </div>
              {keyMetrics.length > 0 && (
                <>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>FCF / Action</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#0891b2" }}>{ratioFmt(keyMetrics[0].freeCashFlowPerShare)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>FCF Yield</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#7c3aed" }}>{pctFmt(keyMetrics[0].freeCashFlowYield)}</div>
                  </div>
                </>
              )}
            </div>
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

        <FmpTable data={cf} rows={rows} />
        <div style={{ textAlign: "center", marginTop: 14, color: "var(--muted)", fontSize: 11 }}>
          📋 Source : Financial Modeling Prep · {cf.length} années de données
        </div>
      </div>
    );
  }

  // Fallback Yahoo Finance
  const cfArr = data?.cashflowStatementHistory?.cashflowStatements || [];
  const yahooRows = [
    ["Flux opérationnels", "totalCashFromOperatingActivities", true],
    ["Variation du BFR", "changeToOperatingActivities", false],
    ["CAPEX", "capitalExpenditures", false],
    ["Flux d'investissement", "totalCashFromInvestingActivities", false],
    ["Flux de financement", "totalCashFromFinancingActivities", false],
    ["Dividendes versés", "dividendsPaid", false],
    ["Rachat d'actions", "repurchaseOfStock", false],
    ["Free Cash Flow", "freeCashFlow", true],
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
      {!hasKey && <FmpKeyPrompt onKeySet={() => setHasKey(true)} />}
      {cfChart.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="chart-label">EN MILLIARDS ({data?.price?.currency})</div>
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
      <YahooTable
        headers={cfArr.map(s => new Date((s.endDate?.raw || 0) * 1000).getFullYear())}
        rows={yahooRows}
        data={cfArr}
      />
    </div>
  );
}

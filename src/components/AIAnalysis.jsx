import { useState } from "react";
import { hasClaudeKey, getClaudeKey, setClaudeKey, askClaude } from "../utils/claude";

/* ── Compact formatter ── */
function compact(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}Md`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  return `${sign}${abs.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}`;
}

/* ── Extract key financial data for the prompt ── */
function buildContext(data, symbol) {
  const p = data?.price || {};
  const fd = data?.financialData || {};
  const stats = data?.defaultKeyStatistics || {};
  const profile = data?.assetProfile || {};

  // Last 3 years income statement
  const income = (data?.incomeStatementHistory?.incomeStatementHistory || []).slice(0, 3);
  const cashflow = (data?.cashflowStatementHistory?.cashflowStatements || []).slice(0, 3);
  const balance = (data?.balanceSheetHistory?.balanceSheetStatements || []).slice(0, 3);

  const ctx = {
    symbol,
    name: p.shortName || p.longName || symbol,
    sector: profile.sector || "—",
    industry: profile.industry || "—",
    currency: p.currency || "USD",
    price: p.regularMarketPrice,
    marketCap: compact(p.marketCap),
    change52w: stats["52WeekChange"] != null
      ? `${(stats["52WeekChange"] * 100).toFixed(1)}%`
      : "—",
  };

  // Key ratios
  const ratios = {};
  if (stats.trailingPE) ratios["P/E (TTM)"] = stats.trailingPE.toFixed(1);
  if (stats.forwardPE) ratios["P/E (Forward)"] = stats.forwardPE.toFixed(1);
  if (stats.priceToBook) ratios["P/B"] = stats.priceToBook.toFixed(2);
  if (stats.enterpriseToEbitda) ratios["EV/EBITDA"] = stats.enterpriseToEbitda.toFixed(1);
  if (stats.pegRatio) ratios["PEG"] = stats.pegRatio.toFixed(2);
  if (fd.returnOnEquity) ratios["ROE"] = `${(fd.returnOnEquity * 100).toFixed(1)}%`;
  if (fd.returnOnAssets) ratios["ROA"] = `${(fd.returnOnAssets * 100).toFixed(1)}%`;
  if (fd.profitMargins) ratios["Marge nette"] = `${(fd.profitMargins * 100).toFixed(1)}%`;
  if (fd.grossMargins) ratios["Marge brute"] = `${(fd.grossMargins * 100).toFixed(1)}%`;
  if (fd.operatingMargins) ratios["Marge opé."] = `${(fd.operatingMargins * 100).toFixed(1)}%`;
  if (fd.debtToEquity) ratios["Dette/Equity"] = fd.debtToEquity.toFixed(1);
  if (fd.currentRatio) ratios["Current ratio"] = fd.currentRatio.toFixed(2);
  if (fd.revenueGrowth) ratios["Croiss. CA (YoY)"] = `${(fd.revenueGrowth * 100).toFixed(1)}%`;
  if (fd.earningsGrowth) ratios["Croiss. BPA (YoY)"] = `${(fd.earningsGrowth * 100).toFixed(1)}%`;
  if (stats.trailingAnnualDividendYield) ratios["Div. yield"] = `${(stats.trailingAnnualDividendYield * 100).toFixed(2)}%`;
  if (stats.payoutRatio) ratios["Payout ratio"] = `${(stats.payoutRatio * 100).toFixed(0)}%`;
  ctx.ratios = ratios;

  // Income (3y)
  ctx.incomeHistory = income.map(y => ({
    year: y.endDate ? new Date(y.endDate).getFullYear() : "?",
    revenue: compact(y.totalRevenue),
    grossProfit: compact(y.grossProfit),
    ebitda: compact(y.ebitda),
    netIncome: compact(y.netIncome),
    eps: y.dilutedEPS?.toFixed(2),
  }));

  // Cash flow (3y)
  ctx.cashflowHistory = cashflow.map(y => ({
    year: y.endDate ? new Date(y.endDate).getFullYear() : "?",
    operatingCF: compact(y.totalCashFromOperatingActivities),
    capex: compact(y.capitalExpenditures),
    fcf: y.totalCashFromOperatingActivities && y.capitalExpenditures
      ? compact(y.totalCashFromOperatingActivities + y.capitalExpenditures)
      : "—",
  }));

  // Balance (latest)
  if (balance[0]) {
    const b = balance[0];
    ctx.balanceSheet = {
      totalAssets: compact(b.totalAssets),
      totalLiabilities: compact(b.totalLiab),
      equity: compact(b.totalStockholderEquity),
      cash: compact(b.cash),
      totalDebt: compact(b.longTermDebt || 0 + (b.shortLongTermDebt || 0)),
    };
  }

  // FMP enriched data if available
  const fmp = data?._fmpData;
  if (fmp?.ratios?.[0]) {
    const r = fmp.ratios[0];
    if (r.returnOnCapitalEmployed) ctx.ratios["ROCE"] = `${(r.returnOnCapitalEmployed * 100).toFixed(1)}%`;
    if (r.freeCashFlowPerShare) ctx.ratios["FCF/action"] = r.freeCashFlowPerShare.toFixed(2);
  }

  return JSON.stringify(ctx, null, 0);
}

const SYSTEM_PROMPT = `Tu es un analyste financier senior spécialisé dans l'analyse fondamentale.
Tu reçois les données financières d'une action cotée. Tu dois fournir une analyse structurée en français.

Structure ta réponse EXACTEMENT ainsi :

**RÉSUMÉ** (2 phrases max)
Le verdict en une phrase, puis le prix actuel vs la valorisation implicite.

**FORCES**
• 3-4 points forts (croissance, marges, position concurrentielle, etc.)

**FAIBLESSES**
• 2-3 risques ou points faibles (valorisation élevée, dette, dépendance, etc.)

**VALORISATION**
Analyse du P/E, EV/EBITDA, PEG par rapport au secteur. L'action est-elle chère, correctement valorisée, ou sous-évaluée ?

**VERDICT**
Un seul mot parmi : ACHETER / CONSERVER / VENDRE
Suivi d'une justification en 2 phrases max.

Règles :
- Sois concis et factuel. Pas de bavardage.
- Base-toi UNIQUEMENT sur les données fournies. Ne fabrique pas de chiffres.
- Si une donnée manque, ignore-la au lieu d'inventer.
- Mentionne les chiffres clés pour appuyer tes arguments.
- Utilise le symbole boursier dans tes phrases, pas le nom complet.
- Maximum 350 mots.
- IMPORTANT : tu ne fournis PAS de conseil en investissement au sens réglementaire. C'est une analyse éducative.`;

/* ── Key Setup inline ── */
function KeySetup({ onKeySet }) {
  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!key.trim()) return;
    setTesting(true);
    setError("");
    try {
      // Quick validation: try a tiny request
      const targetUrl = "https://api.anthropic.com/v1/messages";
      const proxyUrl = `https://foucauld-proxy.foucauld-finance.workers.dev?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key.trim(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 10,
          messages: [{ role: "user", content: "Dis OK" }],
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error("Clé invalide");
      setClaudeKey(key.trim());
      onKeySet();
    } catch {
      setError("Clé invalide ou erreur réseau. Vérifie ta clé API Anthropic.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ textAlign: "center", padding: "28px 20px" }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>🤖</div>
      <h3 style={{ fontWeight: 800, color: "var(--text)", marginBottom: 6, fontSize: 16 }}>
        Analyste IA
      </h3>
      <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.7, maxWidth: 400, margin: "0 auto 14px" }}>
        Obtiens une <strong>analyse fondamentale automatique</strong> de chaque action
        grâce à Claude (Anthropic). Entre ta clé API pour activer cette fonctionnalité.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, maxWidth: 420, margin: "0 auto" }}>
        <input
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="sk-ant-api03-..."
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 10,
            border: "1px solid var(--border)", background: "var(--bg)",
            color: "var(--text)", fontSize: 13, fontFamily: "monospace",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={testing || !key.trim()}
          style={{
            padding: "10px 20px", borderRadius: 10, border: "none",
            background: testing ? "var(--muted)" : "#7c3aed",
            color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}
        >
          {testing ? "Test..." : "Activer"}
        </button>
      </form>
      {error && <p style={{ color: "#ef4444", fontSize: 12, fontWeight: 600, marginTop: 8 }}>{error}</p>}
      <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 12 }}>
        Clé gratuite (limité) ou payante sur{" "}
        <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer"
          style={{ color: "#7c3aed", fontWeight: 700 }}>console.anthropic.com</a>
      </p>
    </div>
  );
}

/* ── Markdown-light renderer ── */
function renderAnalysis(text) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Bold headers
    if (line.startsWith("**") && line.endsWith("**")) {
      const label = line.replace(/\*\*/g, "");
      const isVerdict = label.includes("VERDICT");
      return (
        <div key={i} style={{
          fontWeight: 800, fontSize: isVerdict ? 15 : 14,
          color: isVerdict ? "#7c3aed" : "var(--text)",
          marginTop: i === 0 ? 0 : 18, marginBottom: 6,
          letterSpacing: "-0.2px",
          borderBottom: "1px solid var(--border)", paddingBottom: 4,
        }}>
          {label}
        </div>
      );
    }
    // Bullet points
    if (line.startsWith("• ") || line.startsWith("- ")) {
      return (
        <div key={i} style={{
          fontSize: 13, color: "var(--text)", lineHeight: 1.7,
          paddingLeft: 16, position: "relative",
        }}>
          <span style={{ position: "absolute", left: 0, color: "#7c3aed", fontWeight: 700 }}>•</span>
          {line.slice(2)}
        </div>
      );
    }
    // Verdict line (ACHETER / CONSERVER / VENDRE)
    if (/^(ACHETER|CONSERVER|VENDRE)/.test(line.trim())) {
      const word = line.trim().split(/\s/)[0];
      const rest = line.trim().slice(word.length);
      const color = word === "ACHETER" ? "#10b981" : word === "VENDRE" ? "#ef4444" : "#f59e0b";
      return (
        <div key={i} style={{ fontSize: 14, lineHeight: 1.7 }}>
          <span style={{
            fontWeight: 800, color, background: `${color}18`,
            padding: "3px 10px", borderRadius: 6, fontSize: 13,
          }}>
            {word}
          </span>
          <span style={{ color: "var(--text)", marginLeft: 8 }}>{rest}</span>
        </div>
      );
    }
    // Regular text
    if (line.trim()) {
      return (
        <div key={i} style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>
          {line}
        </div>
      );
    }
    return <div key={i} style={{ height: 6 }} />;
  });
}

/* ── Main Component ── */
export default function AIAnalysis({ data, symbol }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [keyReady, setKeyReady] = useState(hasClaudeKey());
  const [cachedSymbol, setCachedSymbol] = useState(null);

  // Reset when symbol changes
  if (symbol !== cachedSymbol) {
    if (cachedSymbol !== null) {
      setAnalysis(null);
      setError(null);
    }
    setCachedSymbol(symbol);
  }

  const generate = async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const context = buildContext(data, symbol);
      const text = await askClaude(SYSTEM_PROMPT, `Analyse cette action :\n${context}`);
      setAnalysis(text);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: "var(--card)", borderRadius: 16,
      boxShadow: "0 1px 4px var(--shadow)",
      border: "1px solid var(--border)",
      position: "relative", overflow: "hidden",
      marginBottom: 16,
    }}>
      {/* Accent bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: 3, background: "linear-gradient(90deg, #7c3aed, #4f46e5)",
        borderRadius: "16px 16px 0 0",
      }} />

      {!keyReady ? (
        <KeySetup onKeySet={() => setKeyReady(true)} />
      ) : !analysis && !loading && !error ? (
        /* ── Generate button ── */
        <div style={{ padding: "20px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", letterSpacing: "-0.2px" }}>
              Analyse IA
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontWeight: 500 }}>
              Analyse fondamentale automatique par Claude
            </div>
          </div>
          <button
            onClick={generate}
            style={{
              padding: "10px 22px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              color: "#fff", fontWeight: 700, fontSize: 13,
              cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s",
              boxShadow: "0 2px 8px rgba(124,58,237,.3)",
            }}
            onMouseEnter={e => { e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = "0 4px 14px rgba(124,58,237,.4)"; }}
            onMouseLeave={e => { e.target.style.transform = ""; e.target.style.boxShadow = "0 2px 8px rgba(124,58,237,.3)"; }}
          >
            Analyser {symbol.split(".")[0]}
          </button>
        </div>
      ) : (
        /* ── Analysis result / loading / error ── */
        <div style={{ padding: "20px 18px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", letterSpacing: "-0.2px" }}>
                Analyse IA — {symbol.split(".")[0]}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontWeight: 500 }}>
                Analyse fondamentale par Claude · Usage éducatif uniquement
              </div>
            </div>
            {analysis && (
              <button
                onClick={generate}
                style={{
                  padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)",
                  background: "var(--bg)", color: "var(--muted)", fontWeight: 600,
                  fontSize: 11, cursor: "pointer",
                }}
              >
                Relancer
              </button>
            )}
          </div>

          {loading && (
            <div style={{
              textAlign: "center", padding: "32px 0", color: "var(--muted)", fontSize: 13,
            }}>
              <div style={{
                width: 28, height: 28, border: "3px solid var(--border)",
                borderTopColor: "#7c3aed", borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 12px",
              }} />
              Analyse en cours...
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {error && (
            <div style={{
              padding: "16px", borderRadius: 10,
              background: "#ef444415", border: "1px solid #ef444430",
              color: "#ef4444", fontSize: 13, fontWeight: 600,
            }}>
              {error}
              <button
                onClick={generate}
                style={{
                  marginLeft: 12, padding: "4px 12px", borderRadius: 6,
                  border: "1px solid #ef4444", background: "transparent",
                  color: "#ef4444", fontWeight: 700, fontSize: 12, cursor: "pointer",
                }}
              >
                Réessayer
              </button>
            </div>
          )}

          {analysis && (
            <div style={{
              background: "var(--bg)", borderRadius: 12,
              padding: "16px 18px", border: "1px solid var(--border)",
            }}>
              {renderAnalysis(analysis)}
              <div style={{
                marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)",
                fontSize: 10, color: "var(--muted)", textAlign: "center",
              }}>
                Analyse générée par IA · Ne constitue pas un conseil en investissement
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

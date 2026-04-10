import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from "recharts";

function compact(v) {
  if (v == null || Number.isNaN(v)) return "–";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return sign + (abs / 1e12).toFixed(1) + " T";
  if (abs >= 1e9)  return sign + (abs / 1e9).toFixed(1) + " Md";
  if (abs >= 1e6)  return sign + (abs / 1e6).toFixed(1) + " M";
  if (abs >= 1e3)  return sign + (abs / 1e3).toFixed(1) + " k";
  return sign + abs.toFixed(1);
}

function pct(v) {
  if (v == null || Number.isNaN(v)) return "–";
  return (v * 100).toFixed(1) + "%";
}

function currencyFmt(v, sym) {
  if (v == null || Number.isNaN(v)) return "–";
  return (sym || "$") + v.toFixed(2);
}

function computeFcfCagr(cashflowHistory) {
  if (!cashflowHistory || cashflowHistory.length < 3) return null;
  const positive = cashflowHistory.filter(c => c.freeCashFlow > 0).slice(0, 6);
  if (positive.length < 2) return null;
  const latest = positive[0].freeCashFlow;
  const oldest = positive[positive.length - 1].freeCashFlow;
  const years = positive.length - 1;
  if (oldest <= 0) return null;
  return Math.pow(latest / oldest, 1 / years) - 1;
}

function estimateWacc(beta, debtToEquity) {
  const riskFreeRate = 0.04;
  const marketPremium = 0.055;
  const costOfEquity = riskFreeRate + (beta || 1) * marketPremium;
  const costOfDebt = 0.045;
  const taxRate = 0.21;
  const deRatio = debtToEquity || 0;
  const wE = 1 / (1 + deRatio);
  const wD = deRatio / (1 + deRatio);
  return wE * costOfEquity + wD * costOfDebt * (1 - taxRate);
}

function runDcf({ fcf, growthRate, terminalGrowth, wacc, years, sharesOutstanding, netDebt }) {
  if (!fcf || !sharesOutstanding || wacc <= terminalGrowth) return null;
  const projections = [];
  let cumPV = 0;
  for (let i = 1; i <= years; i++) {
    const pFcf = fcf * Math.pow(1 + growthRate, i);
    const pv = pFcf / Math.pow(1 + wacc, i);
    cumPV += pv;
    projections.push({ year: i, label: "A+" + i, fcf: pFcf, pv, cumPV });
  }
  const tFcf = fcf * Math.pow(1 + growthRate, years) * (1 + terminalGrowth);
  const tVal = tFcf / (wacc - terminalGrowth);
  const pvT = tVal / Math.pow(1 + wacc, years);
  const ev = cumPV + pvT;
  const eqVal = ev - (netDebt || 0);
  return {
    projections, cumPVFcf: cumPV, terminalValue: tVal, pvTerminal: pvT,
    enterpriseValue: ev, equityValue: eqVal,
    fairValue: Math.max(0, eqVal / sharesOutstanding),
    terminalShare: pvT / ev,
  };
}
function Slider({ label, value, onChange, min, max, step, format = "pct", info }) {
  const displayVal = format === "pct" ? (value * 100).toFixed(1) + "%"
    : format === "years" ? value + " ans" : String(value);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
          {label}
          {info && <span title={info} style={{ marginLeft: 6, cursor: "help", opacity: 0.5, fontSize: 12 }}>ⓘ</span>}
        </label>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
          {displayVal}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "var(--accent)" }}
        aria-label={label} />
    </div>
  );
}

function Verdict({ fairValue, currentPrice }) {
  if (!fairValue || !currentPrice) return null;
  const upside = (fairValue - currentPrice) / currentPrice;
  let color, bg, label;
  if (upside > 0.25) { color = "#22c55e"; bg = "rgba(34,197,94,0.12)"; label = "Sous-évalué"; }
  else if (upside > 0.05) { color = "#86efac"; bg = "rgba(134,239,172,0.10)"; label = "Légèrement sous-évalué"; }
  else if (upside > -0.05) { color = "#facc15"; bg = "rgba(250,204,21,0.10)"; label = "Juste valeur"; }
  else if (upside > -0.25) { color = "#fb923c"; bg = "rgba(251,146,60,0.10)"; label = "Légèrement surévalué"; }
  else { color = "#ef4444"; bg = "rgba(239,68,68,0.12)"; label = "Surévalué"; }
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "6px 14px", borderRadius: 8, background: bg,
      border: "1px solid " + color + "33", marginTop: 8,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      <span style={{ color, fontWeight: 700, fontSize: 14 }}>{label}</span>
      <span style={{ color: "var(--muted)", fontSize: 13 }}>
        ({upside >= 0 ? "+" : ""}{(upside * 100).toFixed(1)}%)
      </span>
    </div>
  );
                     }
export default function DcfCalculator({ data, symbol, currency }) {
  if (!data) return null;
  const fd = data.financialData || {};
  const stats = data.defaultKeyStatistics || {};
  const price = data.price || {};
  const fmpCF = data._fmpData?.cashflow || [];

  const currentPrice = fd.currentPrice?.raw || price.regularMarketPrice?.raw;
  const sharesOut = stats.sharesOutstanding?.raw;
  const latestFcf = fd.freeCashflow?.raw || fmpCF[0]?.freeCashFlow;
  const totalDebt = fd.totalDebt?.raw || 0;
  const totalCash = fd.totalCash?.raw || 0;
  const netDebt = totalDebt - totalCash;
  const beta = stats.beta?.raw || 1;
  const debtToEquity = (fd.debtToEquity?.raw || 0) / 100;
  const currSym = price.currencySymbol || "$";

  const historicalCagr = computeFcfCagr(fmpCF);
  const defaultGrowth = historicalCagr != null
    ? Math.max(0.02, Math.min(0.25, historicalCagr))
    : (fd.revenueGrowth?.raw || 0.08);
  const defaultWacc = estimateWacc(beta, debtToEquity);

  const [growthRate, setGrowthRate] = useState(Math.round(defaultGrowth * 1000) / 1000);
  const [terminalGrowth, setTerminalGrowth] = useState(0.025);
  const [wacc, setWacc] = useState(Math.round(defaultWacc * 1000) / 1000);
  const [projYears, setProjYears] = useState(10);
  const [marginOfSafety, setMarginOfSafety] = useState(0.25);

  const result = useMemo(() => {
    if (!latestFcf || !sharesOut) return null;
    return runDcf({ fcf: latestFcf, growthRate, terminalGrowth, wacc, years: projYears, sharesOutstanding: sharesOut, netDebt });
  }, [latestFcf, growthRate, terminalGrowth, wacc, projYears, sharesOut, netDebt]);

  const fairValue = result?.fairValue;
  const conservativeValue = fairValue ? fairValue * (1 - marginOfSafety) : null;

  const chartData = useMemo(() => {
    if (!result?.projections) return [];
    return [
      { label: "Actuel", fcf: latestFcf, pv: latestFcf },
      ...result.projections.map(p => ({ label: p.label, fcf: p.fcf, pv: p.pv })),
    ];
  }, [result, latestFcf]);

  if (!latestFcf || !sharesOut || !currentPrice) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🧮</div>
        <div style={{ color: "var(--muted)", fontSize: 14 }}>
          Données insuffisantes pour le calcul DCF de {symbol}
        </div>
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{
        padding: "20px 24px 16px", borderBottom: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>🧮</span>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
              Valorisation DCF
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            Discounted Cash Flow — Estimation de la juste valeur par actualisation des flux futurs
          </p>
        </div>
        {result && <Verdict fairValue={conservativeValue} currentPrice={currentPrice} />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", minHeight: 420 }} className="dcf-grid">
        <div style={{ padding: "20px 24px", borderRight: "1px solid var(--border)", background: "rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
            Hypothèses
          </div>
          <Slider label="Croissance FCF" value={growthRate} onChange={setGrowthRate}
            min={-0.05} max={0.35} step={0.005}
            info={historicalCagr != null ? "CAGR historique : " + pct(historicalCagr) : "Taux de croissance annuel projeté du FCF"} />
          <Slider label="Croissance terminale" value={terminalGrowth} onChange={setTerminalGrowth}
            min={0} max={0.05} step={0.0025}
            info="Taux de croissance perpétuelle après la période de projection (généralement 2-3%)" />
          <Slider label="WACC (taux d'actualisation)" value={wacc} onChange={setWacc}
            min={0.04} max={0.18} step={0.0025}
            info={"Estimé via CAPM : β=" + beta.toFixed(2) + ", D/E=" + debtToEquity.toFixed(2)} />
          <Slider label="Période de projection" value={projYears} onChange={setProjYears}
            min={5} max={15} step={1} format="years" />
          <Slider label="Marge de sécurité" value={marginOfSafety} onChange={setMarginOfSafety}
            min={0} max={0.50} step={0.05}
            info="Décote appliquée à la juste valeur pour se protéger des erreurs d'estimation" />
          <button onClick={() => {
            setGrowthRate(Math.round(defaultGrowth * 1000) / 1000);
            setTerminalGrowth(0.025);
            setWacc(Math.round(defaultWacc * 1000) / 1000);
            setProjYears(10);
            setMarginOfSafety(0.25);
          }} style={{
            marginTop: 8, width: "100%", padding: "8px 0", border: "1px solid var(--border)",
            borderRadius: 8, background: "transparent", color: "var(--muted)", cursor: "pointer",
            fontSize: 13, fontWeight: 500,
          }}>
            ↺ Réinitialiser
          </button>
        </div>
        <div style={{ padding: "20px 24px" }}>
          {result && (<>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "rgba(79,70,229,0.08)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(79,70,229,0.15)" }}>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginBottom: 4 }}>Juste valeur</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)" }}>{currencyFmt(fairValue, currSym)}</div>
              </div>
              <div style={{ background: "rgba(34,197,94,0.08)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(34,197,94,0.12)" }}>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginBottom: 4 }}>Valeur conservatrice</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#22c55e" }}>{currencyFmt(conservativeValue, currSym)}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>(−{(marginOfSafety * 100).toFixed(0)}% marge)</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "14px 16px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginBottom: 4 }}>Prix actuel</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{currencyFmt(currentPrice, currSym)}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                Projection des Free Cash Flows
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dcfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <YAxis tickFormatter={v => compact(v)} tick={{ fill: "var(--muted)", fontSize: 11 }} width={55} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }}
                    formatter={(v) => [compact(v), "FCF"]} />
                  <Area type="monotone" dataKey="fcf" stroke="#818cf8" strokeWidth={2}
                    fill="url(#dcfGrad)" dot={{ r: 3, fill: "#818cf8" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", fontSize: 13, color: "var(--text-secondary)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>FCF actuel</span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{compact(latestFcf)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>VP des FCF projetés</span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{compact(result.cumPVFcf)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Valeur terminale (VP)</span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{compact(result.pvTerminal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>% Terminal / EV</span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{pct(result.terminalShare)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Enterprise Value</span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{compact(result.enterpriseValue)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Dette nette</span>
                <span style={{ fontWeight: 600, color: netDebt > 0 ? "#fb923c" : "#22c55e" }}>{compact(netDebt)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Equity Value</span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{compact(result.equityValue)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Actions diluées</span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{compact(sharesOut)}</span>
              </div>
            </div>

            <div style={{
              marginTop: 16, padding: "10px 14px", borderRadius: 8,
              background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.12)",
              fontSize: 11, color: "var(--muted)", lineHeight: 1.5,
            }}>
              ⚠️ Ce calcul est une estimation basée sur vos hypothèses. Il ne constitue pas un conseil en investissement.
              La valeur terminale représente {pct(result.terminalShare)} de l'EV — {result.terminalShare > 0.75 ? "attention, au-delà de 75% les résultats sont très sensibles aux hypothèses." : "proportion raisonnable."}
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
          }

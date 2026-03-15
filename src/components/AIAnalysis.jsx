import { useState, useMemo } from "react";

/* ── Compact formatter ── */
function fmt(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}Md`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  return `${sign}${abs.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}`;
}
function pct(v) { return v != null ? `${(v * 100).toFixed(1)}%` : null; }
function fix(v, d = 1) { return v != null ? v.toFixed(d) : null; }

/* ═══════════════════════════════════════════════
   MOTEUR D'ANALYSE FONDAMENTALE (100% local)
   Score sur 100 basé sur 6 axes :
     1. Rentabilité (25 pts)
     2. Croissance (20 pts)
     3. Valorisation (20 pts)
     4. Santé financière (15 pts)
     5. Cash flow (10 pts)
     6. Dividende (10 pts)
   ═══════════════════════════════════════════════ */

// Unwrap Yahoo {raw} format or plain number
function rv(v) { return v?.raw ?? v ?? null; }

function analyzeStock(data, symbol) {
  const p = data?.price || {};
  const fd = data?.financialData || {};
  const stats = data?.defaultKeyStatistics || {};
  const profile = data?.assetProfile || {};
  const income = (data?.incomeStatementHistory?.incomeStatementHistory || []).slice(0, 10);
  const cashflow = (data?.cashflowStatementHistory?.cashflowStatements || []).slice(0, 10);
  const balance = (data?.balanceSheetHistory?.balanceSheetStatements || []).slice(0, 10);

  const ticker = symbol.split(".")[0];
  const name = p.shortName || p.longName || symbol;
  const sector = profile.sector || null;
  const currency = p.currency || "USD";
  const price = rv(p.regularMarketPrice);
  const marketCap = rv(p.marketCap);

  const forces = [];
  const faiblesses = [];
  let totalScore = 0;
  let maxScore = 0;
  const scores = {};

  // ── 1. RENTABILITÉ (25 pts) ──
  let rentScore = 0;
  const roe = rv(fd.returnOnEquity);
  const roa = rv(fd.returnOnAssets);
  const marginNet = rv(fd.profitMargins);
  const marginBrute = rv(fd.grossMargins);
  const marginOp = rv(fd.operatingMargins);

  if (roe != null) {
    if (roe > 0.20) { rentScore += 8; forces.push(`ROE excellent de ${pct(roe)}, signe d'une forte création de valeur`); }
    else if (roe > 0.12) { rentScore += 5; forces.push(`ROE solide à ${pct(roe)}`); }
    else if (roe > 0.05) { rentScore += 2; }
    else { faiblesses.push(`ROE faible à ${pct(roe)}, la rentabilité des fonds propres est insuffisante`); }
  }
  if (marginNet != null) {
    if (marginNet > 0.20) { rentScore += 6; forces.push(`Marge nette de ${pct(marginNet)}, pouvoir de pricing fort`); }
    else if (marginNet > 0.10) { rentScore += 4; }
    else if (marginNet > 0.03) { rentScore += 2; }
    else if (marginNet <= 0) { faiblesses.push(`Marge nette négative (${pct(marginNet)}), l'entreprise perd de l'argent`); }
    else { faiblesses.push(`Marge nette faible à ${pct(marginNet)}`); }
  }
  if (marginBrute != null) {
    if (marginBrute > 0.50) { rentScore += 5; if (!forces.some(f => f.includes("Marge"))) forces.push(`Marge brute élevée de ${pct(marginBrute)}, avantage concurrentiel probable`); }
    else if (marginBrute > 0.30) { rentScore += 3; }
    else if (marginBrute < 0.20) { faiblesses.push(`Marge brute de seulement ${pct(marginBrute)}, faible pouvoir de pricing`); }
    else { rentScore += 1; }
  }
  if (marginOp != null) {
    if (marginOp > 0.25) rentScore += 4;
    else if (marginOp > 0.10) rentScore += 2;
    else if (marginOp < 0) faiblesses.push(`Marge opérationnelle négative (${pct(marginOp)})`);
  }
  if (roa != null && roa > 0.10) rentScore += 2;
  scores.rentabilite = { score: Math.min(rentScore, 25), max: 25 };
  totalScore += scores.rentabilite.score;
  maxScore += 25;

  // ── 2. CROISSANCE (20 pts) ──
  let croissScore = 0;
  const revGrowth = rv(fd.revenueGrowth);
  const epsGrowth = rv(fd.earningsGrowth);

  // Multi-year revenue CAGR (use max available history, up to 10 years)
  let revenueCAGR = null;
  const nYears = income.length;
  if (nYears >= 2) {
    const latest = rv(income[0]?.totalRevenue);
    const oldest = rv(income[nYears - 1]?.totalRevenue);
    if (latest > 0 && oldest > 0) {
      revenueCAGR = Math.pow(latest / oldest, 1 / (nYears - 1)) - 1;
    }
  }

  // Net income CAGR
  let netIncomeCAGR = null;
  if (nYears >= 2) {
    const latestNI = rv(income[0]?.netIncome);
    const oldestNI = rv(income[nYears - 1]?.netIncome);
    if (latestNI > 0 && oldestNI > 0) {
      netIncomeCAGR = Math.pow(latestNI / oldestNI, 1 / (nYears - 1)) - 1;
    }
  }

  // Revenue consistency (% of years with positive growth)
  let positiveGrowthYears = 0;
  let growthCheckYears = 0;
  for (let i = 0; i < nYears - 1; i++) {
    const cur = rv(income[i]?.totalRevenue);
    const prev = rv(income[i + 1]?.totalRevenue);
    if (cur != null && prev != null && prev > 0) {
      growthCheckYears++;
      if (cur > prev) positiveGrowthYears++;
    }
  }

  if (revGrowth != null) {
    if (revGrowth > 0.20) { croissScore += 5; forces.push(`Croissance du CA de ${pct(revGrowth)} sur le dernier exercice`); }
    else if (revGrowth > 0.08) { croissScore += 3; forces.push(`Croissance solide du CA à ${pct(revGrowth)}`); }
    else if (revGrowth > 0) { croissScore += 1; }
    else { faiblesses.push(`CA en recul de ${pct(revGrowth)}`); }
  }
  if (epsGrowth != null) {
    if (epsGrowth > 0.20) { croissScore += 4; forces.push(`BPA en forte hausse de ${pct(epsGrowth)}`); }
    else if (epsGrowth > 0.05) { croissScore += 2; }
    else if (epsGrowth < -0.10) { faiblesses.push(`BPA en forte baisse de ${pct(epsGrowth)}`); croissScore -= 1; }
  }
  if (revenueCAGR != null) {
    const label = `${nYears - 1} ans`;
    if (revenueCAGR > 0.15) { croissScore += 5; forces.push(`TCAM du CA de ${pct(revenueCAGR)} sur ${label}`); }
    else if (revenueCAGR > 0.05) { croissScore += 3; forces.push(`Croissance régulière du CA (TCAM ${pct(revenueCAGR)} sur ${label})`); }
    else if (revenueCAGR < 0) { croissScore -= 1; faiblesses.push(`CA en déclin sur ${label} (TCAM ${pct(revenueCAGR)})`); }
    else { croissScore += 1; }
  }
  if (netIncomeCAGR != null && nYears >= 4) {
    if (netIncomeCAGR > 0.12) croissScore += 2;
    else if (netIncomeCAGR < -0.05) croissScore -= 1;
  }
  // Consistency bonus: positive growth in most years
  if (growthCheckYears >= 5) {
    const ratio = positiveGrowthYears / growthCheckYears;
    if (ratio >= 0.8) { croissScore += 3; forces.push(`CA en hausse ${positiveGrowthYears}/${growthCheckYears} ans, trajectoire très régulière`); }
    else if (ratio >= 0.6) croissScore += 1;
    else if (ratio < 0.4) faiblesses.push(`CA instable, en hausse seulement ${positiveGrowthYears}/${growthCheckYears} ans`);
  }
  // Net income trend (last year)
  if (nYears >= 2) {
    const niCur = rv(income[0]?.netIncome);
    const niPrev = rv(income[1]?.netIncome);
    if (niCur != null && niPrev != null && niCur > niPrev && niCur > 0) croissScore += 1;
  }
  scores.croissance = { score: Math.max(Math.min(croissScore, 20), 0), max: 20 };
  totalScore += scores.croissance.score;
  maxScore += 20;

  // ── 3. VALORISATION (20 pts) ──
  let valoScore = 0;
  const pe = rv(stats.trailingPE) || rv(stats.forwardPE);
  const forwardPE = rv(stats.forwardPE);
  const pb = rv(stats.priceToBook);
  const evEbitda = rv(stats.enterpriseToEbitda);
  const peg = rv(stats.pegRatio);

  const valoDetails = [];

  if (pe != null) {
    if (pe < 0) { valoScore += 0; faiblesses.push(`P/E négatif (${fix(pe)}), résultat net déficitaire`); }
    else if (pe < 12) { valoScore += 7; valoDetails.push(`P/E attractif à ${fix(pe)}x`); }
    else if (pe < 20) { valoScore += 5; valoDetails.push(`P/E raisonnable à ${fix(pe)}x`); }
    else if (pe < 30) { valoScore += 3; valoDetails.push(`P/E de ${fix(pe)}x, valorisation tendue`); }
    else { valoScore += 1; faiblesses.push(`P/E élevé de ${fix(pe)}x, valorisation exigeante`); }
  }
  if (forwardPE != null && pe != null && forwardPE < pe * 0.85) {
    valoScore += 2;
    valoDetails.push(`P/E forward (${fix(forwardPE)}x) en forte baisse vs TTM, anticipation de croissance des bénéfices`);
  }
  if (evEbitda != null) {
    if (evEbitda < 8) { valoScore += 5; valoDetails.push(`EV/EBITDA bas à ${fix(evEbitda)}x`); }
    else if (evEbitda < 14) { valoScore += 3; valoDetails.push(`EV/EBITDA de ${fix(evEbitda)}x`); }
    else if (evEbitda > 25) { faiblesses.push(`EV/EBITDA très élevé (${fix(evEbitda)}x)`); }
    else { valoScore += 1; }
  }
  if (peg != null) {
    if (peg > 0 && peg < 1) { valoScore += 4; valoDetails.push(`PEG de ${fix(peg, 2)}x, croissance bon marché`); }
    else if (peg >= 1 && peg < 2) { valoScore += 2; }
    else if (peg >= 2) { faiblesses.push(`PEG de ${fix(peg, 2)}x, la croissance est trop chèrement valorisée`); }
  }
  if (pb != null) {
    if (pb < 1.5) { valoScore += 2; valoDetails.push(`P/B de ${fix(pb, 2)}x`); }
    else if (pb > 10) { valoScore += 0; }
    else { valoScore += 1; }
  }

  if (valoDetails.length > 0 && !forces.some(f => f.includes("P/E") || f.includes("EV/") || f.includes("PEG"))) {
    forces.push(valoDetails.slice(0, 2).join(". "));
  }

  scores.valorisation = { score: Math.max(Math.min(valoScore, 20), 0), max: 20 };
  totalScore += scores.valorisation.score;
  maxScore += 20;

  // ── 4. SANTÉ FINANCIÈRE (15 pts) ──
  let santeScore = 0;
  const debtEquity = rv(fd.debtToEquity);
  const currentRatio = rv(fd.currentRatio);
  const b = balance[0];

  if (debtEquity != null) {
    if (debtEquity < 30) { santeScore += 5; forces.push(`Endettement très faible (D/E ${fix(debtEquity)}%)`); }
    else if (debtEquity < 80) { santeScore += 3; }
    else if (debtEquity < 150) { santeScore += 1; }
    else { faiblesses.push(`Endettement élevé (D/E ${fix(debtEquity)}%), risque en cas de hausse des taux`); }
  }
  if (currentRatio != null) {
    if (currentRatio > 2.0) { santeScore += 4; forces.push(`Liquidité excellente (current ratio ${fix(currentRatio, 2)}x)`); }
    else if (currentRatio > 1.2) { santeScore += 3; }
    else if (currentRatio < 1.0) { faiblesses.push(`Current ratio sous 1 (${fix(currentRatio, 2)}x), risque de liquidité`); }
    else { santeScore += 1; }
  }
  if (b) {
    const equity = rv(b.totalStockholderEquity);
    const totalAssets = rv(b.totalAssets);
    if (equity != null && totalAssets != null && totalAssets > 0) {
      const equityRatio = equity / totalAssets;
      if (equityRatio > 0.50) santeScore += 4;
      else if (equityRatio > 0.30) santeScore += 2;
      else if (equityRatio < 0.10) faiblesses.push("Fonds propres très faibles par rapport au total du bilan");
    }
    const bCash = rv(b.cash);
    if (bCash && marketCap) {
      const cashPct = bCash / marketCap;
      if (cashPct > 0.20) { santeScore += 2; forces.push(`Trésorerie importante (${fmt(bCash)} ${currency}, ${(cashPct * 100).toFixed(0)}% de la capitalisation)`); }
    }
  }
  scores.sante = { score: Math.min(santeScore, 15), max: 15 };
  totalScore += scores.sante.score;
  maxScore += 15;

  // ── 5. CASH FLOW (10 pts) ──
  let cfScore = 0;
  if (cashflow.length > 0) {
    const latestCF = cashflow[0];
    const opCF = rv(latestCF?.totalCashFromOperatingActivities);
    const capex = rv(latestCF?.capitalExpenditures);
    const fcfDirect = rv(latestCF?.freeCashFlow);
    const fcf = fcfDirect ?? (opCF != null && capex != null ? opCF + capex : null);
    if (opCF != null && opCF > 0) {
      cfScore += 3;
      if (fcf != null && fcf > 0) {
        cfScore += 3;
        forces.push(`Free cash flow positif de ${fmt(fcf)} ${currency}`);
        if (marketCap && marketCap > 0) {
          const fcfYield = fcf / marketCap;
          if (fcfYield > 0.06) { cfScore += 2; forces.push(`Rendement FCF de ${pct(fcfYield)}, très attractif`); }
          else if (fcfYield > 0.03) { cfScore += 1; }
        }
      } else if (fcf != null && fcf < 0) {
        faiblesses.push(`Free cash flow négatif (${fmt(fcf)} ${currency}), les investissements dépassent les flux opérationnels`);
      }
    } else if (opCF != null && opCF < 0) {
      faiblesses.push(`Cash flow opérationnel négatif (${fmt(opCF)} ${currency})`);
    }
    // FCF consistency over available history
    let positiveFcfYears = 0;
    let fcfCheckYears = 0;
    for (let i = 0; i < cashflow.length; i++) {
      const f = rv(cashflow[i]?.freeCashFlow) ?? (rv(cashflow[i]?.totalCashFromOperatingActivities) != null && rv(cashflow[i]?.capitalExpenditures) != null
        ? rv(cashflow[i].totalCashFromOperatingActivities) + rv(cashflow[i].capitalExpenditures) : null);
      if (f != null) { fcfCheckYears++; if (f > 0) positiveFcfYears++; }
    }
    if (fcfCheckYears >= 5 && positiveFcfYears === fcfCheckYears) {
      cfScore += 1; forces.push(`FCF positif chaque année sur ${fcfCheckYears} ans de données`);
    } else if (fcfCheckYears >= 5 && positiveFcfYears < fcfCheckYears * 0.5) {
      faiblesses.push(`FCF négatif ${fcfCheckYears - positiveFcfYears}/${fcfCheckYears} ans`);
    }
  }
  scores.cashflow = { score: Math.min(cfScore, 10), max: 10 };
  totalScore += scores.cashflow.score;
  maxScore += 10;

  // ── 6. DIVIDENDE (10 pts) ──
  let divScore = 0;
  const divYield = rv(stats.trailingAnnualDividendYield);
  const payout = rv(stats.payoutRatio);

  if (divYield != null && divYield > 0) {
    if (divYield > 0.04) { divScore += 5; forces.push(`Rendement du dividende élevé (${pct(divYield)})`); }
    else if (divYield > 0.02) { divScore += 3; forces.push(`Dividende avec un rendement de ${pct(divYield)}`); }
    else { divScore += 1; }
    if (payout != null) {
      if (payout < 0.60) { divScore += 3; }
      else if (payout < 0.80) { divScore += 1; }
      else if (payout > 1.0) { faiblesses.push(`Payout ratio très élevé (${(payout * 100).toFixed(0)}%), dividende potentiellement non soutenable`); }
      else { faiblesses.push(`Payout ratio tendu à ${(payout * 100).toFixed(0)}%`); }
    }
  } else {
    // No dividend — neutral, award some base points for growth stocks
    divScore += 3;
  }
  scores.dividende = { score: Math.min(divScore, 10), max: 10 };
  totalScore += scores.dividende.score;
  maxScore += 10;

  // ── VERDICT ──
  const pctScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 50;
  let verdict, verdictText;

  if (pctScore >= 70) {
    verdict = "ACHETER";
    verdictText = `${ticker} affiche un profil fondamental solide avec un score de ${Math.round(pctScore)}/100. Les fondamentaux justifient une position à l'achat.`;
  } else if (pctScore >= 45) {
    verdict = "CONSERVER";
    verdictText = `${ticker} présente un profil mixte (${Math.round(pctScore)}/100). Les fondamentaux sont corrects mais ne justifient pas un achat agressif à ce stade.`;
  } else {
    verdict = "VENDRE";
    verdictText = `${ticker} affiche un score fondamental faible de ${Math.round(pctScore)}/100. Les risques l'emportent sur le potentiel à court terme.`;
  }

  // ── VALORISATION TEXT ──
  const valoText = [];
  if (pe != null) valoText.push(`Le P/E de ${fix(pe)}x ${pe < 18 ? "est raisonnable" : pe < 30 ? "est dans la moyenne haute" : "traduit une forte prime de croissance"}.`);
  if (evEbitda != null) valoText.push(`L'EV/EBITDA de ${fix(evEbitda)}x ${evEbitda < 12 ? "reste attractif" : evEbitda < 20 ? "est en ligne avec le marché" : "est élevé"}.`);
  if (peg != null && peg > 0) valoText.push(`Le PEG de ${fix(peg, 2)}x ${peg < 1 ? "indique une croissance sous-valorisée" : peg < 2 ? "est correct" : "signale une surévaluation de la croissance"}.`);
  if (valoText.length === 0) valoText.push("Données de valorisation insuffisantes pour conclure.");

  // ── RÉSUMÉ ──
  const dataYears = Math.max(income.length, balance.length, cashflow.length);
  const resumeText = `${ticker} (${name}) est un titre du secteur ${sector || "non défini"} coté à ${price ? `${fix(price, 2)} ${currency}` : "prix indisponible"} pour une capitalisation de ${fmt(marketCap)} ${currency}. Score fondamental : ${Math.round(pctScore)}/100${dataYears > 1 ? ` (basé sur ${dataYears} ans de données)` : ""}.`;

  // Keep max 4 forces, 3 faiblesses
  const topForces = forces.slice(0, 5);
  const topFaiblesses = faiblesses.slice(0, 4);
  if (topFaiblesses.length === 0) topFaiblesses.push("Aucun point faible majeur identifié dans les données disponibles");
  if (topForces.length === 0) topForces.push("Données insuffisantes pour identifier des points forts marquants");

  return { scores, totalScore, maxScore, pctScore, verdict, verdictText, valoText, resumeText, topForces, topFaiblesses, ticker };
}

/* ── Score gauge mini ── */
function ScoreGauge({ score, label, max }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  const color = pct >= 70 ? "#10b981" : pct >= 45 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ flex: 1, minWidth: 80 }}>
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: color, transition: "width 0.6s" }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 28, textAlign: "right" }}>{score}/{max}</span>
      </div>
    </div>
  );
}

/* ── Main Score Display ── */
function BigScore({ pctScore, verdict }) {
  const color = verdict === "ACHETER" ? "#10b981" : verdict === "VENDRE" ? "#ef4444" : "#f59e0b";
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (pctScore / 100) * circumference;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ position: "relative", width: 96, height: 96 }}>
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="42" fill="none" stroke="var(--border)" strokeWidth="6" />
          <circle
            cx="48" cy="48" r="42" fill="none" stroke={color} strokeWidth="6"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            transform="rotate(-90 48 48)" style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{Math.round(pctScore)}</span>
          <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>/100</span>
        </div>
      </div>
      <div>
        <span style={{
          fontWeight: 800, color, background: `${color}18`,
          padding: "5px 14px", borderRadius: 8, fontSize: 14, letterSpacing: "0.5px",
        }}>
          {verdict}
        </span>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, fontWeight: 500 }}>
          Score fondamental
        </div>
      </div>
    </div>
  );
}

/* ── Section ── */
function Section({ title, children, color }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{
        fontWeight: 800, fontSize: 13, color: color || "var(--text)",
        marginBottom: 6, letterSpacing: "-0.2px",
        borderBottom: "1px solid var(--border)", paddingBottom: 4,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Bullet({ text, icon }) {
  return (
    <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7, paddingLeft: 20, position: "relative" }}>
      <span style={{ position: "absolute", left: 0, fontWeight: 700, fontSize: 12 }}>{icon}</span>
      {text}
    </div>
  );
}

/* ══════════════════════════════════════════════
   COMPOSANT PRINCIPAL
   ══════════════════════════════════════════════ */
export default function AIAnalysis({ data, symbol }) {
  const [expanded, setExpanded] = useState(false);

  const result = useMemo(() => {
    if (!data || !symbol) return null;
    try { return analyzeStock(data, symbol); } catch (e) { console.error("[AIAnalysis] erreur:", e); return null; }
  }, [data, symbol]);

  if (!result) return null;

  const { scores, pctScore, verdict, verdictText, valoText, resumeText, topForces, topFaiblesses, ticker } = result;

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
        height: 3,
        background: verdict === "ACHETER"
          ? "linear-gradient(90deg, #10b981, #059669)"
          : verdict === "VENDRE"
            ? "linear-gradient(90deg, #ef4444, #dc2626)"
            : "linear-gradient(90deg, #f59e0b, #d97706)",
        borderRadius: "16px 16px 0 0",
      }} />

      <div style={{ padding: "20px 18px 16px" }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 14, cursor: "pointer",
        }} onClick={() => setExpanded(!expanded)}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", letterSpacing: "-0.2px" }}>
              Analyse fondamentale — {ticker}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontWeight: 500 }}>
              Scoring automatique sur 6 axes · Usage éducatif uniquement
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BigScore pctScore={pctScore} verdict={verdict} />
            <span style={{
              fontSize: 18, color: "var(--muted)", transition: "transform 0.2s",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}>
              ▼
            </span>
          </div>
        </div>

        {/* Collapsed mini view */}
        {!expanded && (
          <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>
            {resumeText}
          </div>
        )}

        {/* Expanded full analysis */}
        {expanded && (
          <div style={{
            background: "var(--bg)", borderRadius: 12,
            padding: "16px 18px", border: "1px solid var(--border)",
          }}>
            {/* Score bars */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <ScoreGauge score={scores.rentabilite.score} max={scores.rentabilite.max} label="Rentabilité" />
              <ScoreGauge score={scores.croissance.score} max={scores.croissance.max} label="Croissance" />
              <ScoreGauge score={scores.valorisation.score} max={scores.valorisation.max} label="Valorisation" />
              <ScoreGauge score={scores.sante.score} max={scores.sante.max} label="Santé fin." />
              <ScoreGauge score={scores.cashflow.score} max={scores.cashflow.max} label="Cash flow" />
              <ScoreGauge score={scores.dividende.score} max={scores.dividende.max} label="Dividende" />
            </div>

            {/* Résumé */}
            <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7, marginBottom: 4 }}>
              {resumeText}
            </div>

            {/* Forces */}
            <Section title="FORCES" color="#10b981">
              {topForces.map((f, i) => <Bullet key={i} text={f} icon="✓" />)}
            </Section>

            {/* Faiblesses */}
            <Section title="FAIBLESSES" color="#ef4444">
              {topFaiblesses.map((f, i) => <Bullet key={i} text={f} icon="✗" />)}
            </Section>

            {/* Valorisation */}
            <Section title="VALORISATION" color="#7c3aed">
              {valoText.map((v, i) => (
                <div key={i} style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>{v}</div>
              ))}
            </Section>

            {/* Verdict */}
            <Section title="VERDICT" color={verdict === "ACHETER" ? "#10b981" : verdict === "VENDRE" ? "#ef4444" : "#f59e0b"}>
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>
                {verdictText}
              </div>
            </Section>

            <div style={{
              marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)",
              fontSize: 10, color: "var(--muted)", textAlign: "center",
            }}>
              Analyse algorithmique basée sur les données Yahoo Finance · Ne constitue pas un conseil en investissement
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

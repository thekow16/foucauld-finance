import { fmt, getScoreDetails, getScoreColor, getScoreLabel } from "../utils/format";

export default function ScoreCard({ data }) {
  const result = getScoreDetails(data);
  if (!result) return null;

  const { details, score } = result;
  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  const circ = 2 * Math.PI * 32;

  const fmtPct = (v) => v != null ? `${(v * 100).toFixed(1)}%` : "—";
  const fmtRatio = (v) => v != null ? v.toFixed(1) + "x" : "—";

  const indicators = [
    { label: "Croiss. CA", val: fmtPct(details.revenueGrowth.val), good: details.revenueGrowth.pts >= 9 },
    { label: "Croiss. FCF", val: fmtPct(details.fcfGrowth.val), good: details.fcfGrowth.pts >= 9 },
    { label: details.roic.fallback || "ROIC", val: fmtPct(details.roic.val), good: details.roic.pts >= 9 },
    { label: "Dette nette/FCF", val: details.netDebtFcf.val != null ? fmtRatio(details.netDebtFcf.val) : "—", good: details.netDebtFcf.pts >= 10 },
    { label: "Actions", val: details.sharesChange.val != null ? (details.sharesChange.val > 0 ? "↑ " : details.sharesChange.val < -0.005 ? "↓ " : "≈ ") + fmtPct(Math.abs(details.sharesChange.val)) : "—", good: details.sharesChange.pts >= 8 },
    { label: "Marge FCF", val: fmtPct(details.fcfMargin.val), good: details.fcfMargin.pts >= 8 },
  ];

  return (
    <div className="card" style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
      <svg width="90" height="90" viewBox="0 0 90 90" role="img" aria-label={`Score santé financière : ${score} sur 100 — ${label}`}>
        <circle cx="45" cy="45" r="32" fill="none" stroke="var(--border)" strokeWidth="9" />
        <circle cx="45" cy="45" r="32" fill="none" stroke={color} strokeWidth="9"
          strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 45 45)" style={{ transition: "stroke-dasharray .8s ease" }} />
        <text x="45" y="50" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text)" fontFamily="Inter,sans-serif">{score}</text>
      </svg>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color }}>{label}</div>
        <div className="score-desc">Score santé financière sur 100 — Croissance CA & FCF, ROIC, dette nette/FCF, dilution, marge FCF.</div>
        <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
          {indicators.map(it => (
            <div key={it.label}>
              <div className="indicator-label">{it.label}</div>
              <span className={`stag ${it.good ? "stag-good" : "stag-bad"}`}>
                {it.good ? "✓" : "△"} {it.val}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { fmt, getScore, getScoreColor, getScoreLabel } from "../utils/format";

export default function ScoreCard({ data }) {
  const fin = data?.financialData;
  const stats = data?.defaultKeyStatistics;
  const score = getScore(fin, stats);
  if (score === null) return null;

  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  const circ = 2 * Math.PI * 32;

  const indicators = [
    { label: "Marge nette", val: fmt(fin?.profitMargins?.raw, "percent"), good: (fin?.profitMargins?.raw ?? 0) > 0.1 },
    { label: "ROE", val: fmt(fin?.returnOnEquity?.raw, "percent"), good: (fin?.returnOnEquity?.raw ?? 0) > 0.1 },
    { label: "Liquidité", val: fmt(fin?.currentRatio?.raw, "ratio"), good: (fin?.currentRatio?.raw ?? 0) > 1.5 },
    { label: "Dette/CP", val: fin?.debtToEquity?.raw != null ? `${fin.debtToEquity.raw.toFixed(0)}%` : "—", good: (fin?.debtToEquity?.raw ?? 999) < 100 },
  ];

  return (
    <div className="card" style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r="32" fill="none" stroke="var(--border)" strokeWidth="9" />
        <circle cx="45" cy="45" r="32" fill="none" stroke={color} strokeWidth="9"
          strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 45 45)" style={{ transition: "stroke-dasharray .8s ease" }} />
        <text x="45" y="50" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text)" fontFamily="Inter,sans-serif">{score}</text>
      </svg>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color }}>{label}</div>
        <div className="score-desc">Score santé financière sur 100 — P/E, marges, dette, liquidité, croissance.</div>
        <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
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

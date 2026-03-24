import { useState, useEffect } from "react";
import { hasFmpApiKey, fetchEarningsHistory, fetchPressReleases, fetchSecFilings } from "../utils/fmpApi";

function fmt(v) {
  if (v == null || v === "") return "—";
  if (typeof v === "number") {
    if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + " Md";
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + " M";
    return v.toFixed(2);
  }
  return String(v);
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch { return d; }
}

function SurpriseBadge({ actual, estimate }) {
  if (actual == null || estimate == null || estimate === 0) return null;
  const surprise = ((actual - estimate) / Math.abs(estimate)) * 100;
  const isPositive = surprise >= 0;
  return (
    <span className={`stag ${isPositive ? "stag-good" : "stag-bad"}`}>
      {isPositive ? "+" : ""}{surprise.toFixed(1)}%
    </span>
  );
}

// ── Prochaine publication (Yahoo calendarEvents) ──
function NextEarnings({ data }) {
  const cal = data?.calendarEvents;
  const earnings = cal?.earnings;
  if (!earnings) return null;

  const earningsDate = earnings.earningsDate?.[0]?.fmt || earnings.earningsDate?.[0]?.raw;
  const earningsDateEnd = earnings.earningsDate?.[1]?.fmt || earnings.earningsDate?.[1]?.raw;
  const epsEst = earnings.earningsAverage?.fmt ?? earnings.earningsAverage?.raw;
  const revEst = earnings.revenueAverage?.fmt ?? earnings.revenueAverage?.raw;
  const epsLow = earnings.earningsLow?.fmt ?? earnings.earningsLow?.raw;
  const epsHigh = earnings.earningsHigh?.fmt ?? earnings.earningsHigh?.raw;
  const revLow = earnings.revenueLow?.fmt ?? earnings.revenueLow?.raw;
  const revHigh = earnings.revenueHigh?.fmt ?? earnings.revenueHigh?.raw;

  if (!earningsDate && !epsEst) return null;

  return (
    <div className="card" style={{ borderLeft: "4px solid #f59e0b" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 24 }}>📅</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>Prochaine publication</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            {earningsDate ? fmtDate(earningsDate) : "Date non confirmée"}
            {earningsDateEnd && earningsDate !== earningsDateEnd && ` — ${fmtDate(earningsDateEnd)}`}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        {epsEst != null && (
          <div className="earnings-est-card">
            <div className="earnings-est-label">BPA estimé</div>
            <div className="earnings-est-value">{epsEst}</div>
            {(epsLow != null || epsHigh != null) && (
              <div className="earnings-est-range">{epsLow} — {epsHigh}</div>
            )}
          </div>
        )}
        {revEst != null && (
          <div className="earnings-est-card">
            <div className="earnings-est-label">CA estimé</div>
            <div className="earnings-est-value">{revEst}</div>
            {(revLow != null || revHigh != null) && (
              <div className="earnings-est-range">{revLow} — {revHigh}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Historique des résultats (FMP) ──
function EarningsHistory({ symbol }) {
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasFmpApiKey()) return;
    setLoading(true);
    fetchEarningsHistory(symbol)
      .then(d => setEarnings(Array.isArray(d) ? d : []))
      .catch(() => setEarnings([]))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (!hasFmpApiKey()) return null;
  if (loading) return <div style={{ textAlign: "center", padding: 20 }}><div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} /></div>;
  if (!earnings || earnings.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>Historique des résultats trimestriels</div>
      <div style={{ overflowX: "auto" }}>
        <table className="ff-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>BPA réel</th>
              <th>BPA estimé</th>
              <th>Surprise</th>
              <th>CA réel</th>
              <th>CA estimé</th>
              <th>Surprise CA</th>
            </tr>
          </thead>
          <tbody>
            {earnings.slice(0, 16).map((e, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700 }}>{fmtDate(e.date)}</td>
                <td>{fmt(e.eps)}</td>
                <td>{fmt(e.epsEstimated)}</td>
                <td><SurpriseBadge actual={e.eps} estimate={e.epsEstimated} /></td>
                <td>{fmt(e.revenue)}</td>
                <td>{fmt(e.revenueEstimated)}</td>
                <td><SurpriseBadge actual={e.revenue} estimate={e.revenueEstimated} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Communiqués de presse (FMP) ──
function PressReleasesList({ symbol }) {
  const [releases, setReleases] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasFmpApiKey()) return;
    setLoading(true);
    fetchPressReleases(symbol, 15)
      .then(d => setReleases(Array.isArray(d) ? d : []))
      .catch(() => setReleases([]))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (!hasFmpApiKey()) return null;
  if (loading) return <div style={{ textAlign: "center", padding: 20 }}><div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} /></div>;
  if (!releases || releases.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>Communiqués de presse</div>
      <div className="press-list">
        {releases.map((r, i) => (
          <div key={i} className="press-item">
            <div className="press-date">{fmtDate(r.date)}</div>
            <div className="press-title">{r.title}</div>
            {r.text && <div className="press-text">{r.text.slice(0, 200)}…</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SEC Filings (FMP) ──
function SecFilingsList({ symbol }) {
  const [filings, setFilings] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasFmpApiKey()) return;
    setLoading(true);
    fetchSecFilings(symbol, 15)
      .then(d => setFilings(Array.isArray(d) ? d : []))
      .catch(() => setFilings([]))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (!hasFmpApiKey()) return null;
  if (loading) return <div style={{ textAlign: "center", padding: 20 }}><div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} /></div>;
  if (!filings || filings.length === 0) return null;

  const typeLabel = {
    "10-K": "Rapport annuel",
    "10-Q": "Rapport trimestriel",
    "8-K": "Événement important",
    "4": "Transactions insiders",
    "SC 13G": "Participation > 5%",
    "SC 13G/A": "Modif. participation",
    "DEF 14A": "Proxy / AG",
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>Publications réglementaires (SEC)</div>
      <div className="press-list">
        {filings.map((f, i) => (
          <div key={i} className="press-item">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="press-date">{fmtDate(f.fillingDate || f.date)}</div>
              <span className={`filing-type ${f.type === "10-K" || f.type === "10-Q" ? "important" : ""}`}>
                {f.type}
              </span>
            </div>
            <div className="press-title">
              {typeLabel[f.type] || f.type}
              {f.acceptedDate && <span style={{ color: "var(--muted)", fontSize: 11, marginLeft: 8 }}>Accepté le {fmtDate(f.acceptedDate)}</span>}
            </div>
            {f.finalLink && (
              <a href={f.finalLink} target="_blank" rel="noopener noreferrer" className="filing-link">
                Voir le document →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Composant principal ──
export default function EarningsTab({ data, symbol }) {
  const [subTab, setSubTab] = useState("overview");
  const hasFmp = hasFmpApiKey();

  return (
    <div>
      <NextEarnings data={data} />
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch { return d; }
}

export default function EarningsTab({ data }) {
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

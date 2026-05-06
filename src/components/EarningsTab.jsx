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
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      padding: "18px 20px",
      display: "flex",
      gap: 32,
      flexWrap: "wrap",
    }}>
      <div>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: ".5px",
          marginBottom: 6,
        }}>
          Prochaine publication
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px" }}>
          {earningsDate ? fmtDate(earningsDate) : "Date non confirmée"}
          {earningsDateEnd && earningsDate !== earningsDateEnd && (
            <span style={{ color: "var(--text-3)", fontSize: 14, fontWeight: 500, marginLeft: 6 }}>— {fmtDate(earningsDateEnd)}</span>
          )}
        </div>
      </div>

      {epsEst != null && (
        <div style={{
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: "10px 16px",
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--text-3)",
            textTransform: "uppercase",
            letterSpacing: ".5px",
            marginBottom: 4,
          }}>
            BPA estimé
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
            {epsEst}
          </div>
          {(epsLow != null || epsHigh != null) && (
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{epsLow} — {epsHigh}</div>
          )}
        </div>
      )}

      {revEst != null && (
        <div style={{
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: "10px 16px",
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--text-3)",
            textTransform: "uppercase",
            letterSpacing: ".5px",
            marginBottom: 4,
          }}>
            CA estimé
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
            {revEst}
          </div>
          {(revLow != null || revHigh != null) && (
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{revLow} — {revHigh}</div>
          )}
        </div>
      )}
    </div>
  );
}

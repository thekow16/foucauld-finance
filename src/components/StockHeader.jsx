import { useState, useEffect } from "react";
import { fmt } from "../utils/format";

function formatElapsed(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "à l'instant";
  const min = Math.floor(sec / 60);
  if (min === 1) return "il y a 1 min";
  return `il y a ${min} min`;
}

export default function StockHeader({ data, symbol, fetchedAt, isInWatchlist, onToggleWatchlist }) {
  const pr = data?.price;
  const prof = data?.assetProfile;
  const curPrice = pr?.regularMarketPrice?.raw;
  const chg = pr?.regularMarketChange?.raw;
  const chgPct = pr?.regularMarketChangePercent?.raw;
  const isUp = (chg ?? 0) >= 0;
  const inWl = isInWatchlist(symbol);

  const [elapsed, setElapsed] = useState(() => fetchedAt ? Date.now() - fetchedAt : 0);

  useEffect(() => {
    if (!fetchedAt) return;
    setElapsed(Date.now() - fetchedAt);
    const id = setInterval(() => setElapsed(Date.now() - fetchedAt), 30_000);
    return () => clearInterval(id);
  }, [fetchedAt]);

  return (
    <div
      className="stock-header-card"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "20px 24px",
        marginBottom: 12,
        fontFamily: "var(--font)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <h1
              className="stock-name"
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.5px",
                fontFamily: "var(--font)",
              }}
            >
              {pr?.shortName || pr?.longName || symbol}
            </h1>
            <span
              className="badge badge-primary"
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "var(--radius-sm)",
                background: "var(--accent-subtle)",
                color: "var(--accent)",
              }}
            >
              {symbol}
            </span>
            {prof?.sector && (
              <span
                className="badge badge-green"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--green-bg)",
                  color: "var(--green)",
                }}
              >
                {prof.sector}
              </span>
            )}
            {pr?.exchangeName && (
              <span
                className="badge badge-orange"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--orange-bg)",
                  color: "var(--orange)",
                }}
              >
                {pr.exchangeName}
              </span>
            )}
            <button
              className="watchlist-btn"
              onClick={() => onToggleWatchlist(symbol, pr?.shortName || symbol)}
              title={inWl ? "Retirer des favoris" : "Ajouter aux favoris"}
              aria-label={inWl ? `Retirer ${symbol} des favoris` : `Ajouter ${symbol} aux favoris`}
              aria-pressed={inWl}
              style={{
                width: 28,
                height: 28,
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-subtle)",
                cursor: "pointer",
                fontSize: 14,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                color: "inherit",
              }}
            >
              {inWl ? "★" : "☆"}
            </button>
          </div>
          {prof?.country && (
            <p
              className="stock-meta"
              style={{ fontSize: 12, color: "var(--text-2)" }}
            >
              {prof.country} · {prof.industry}
            </p>
          )}
          {prof?.website && (
            <a
              href={prof.website}
              target="_blank"
              rel="noopener noreferrer"
              className="stock-link"
              style={{ fontSize: 12, color: "var(--accent)", fontWeight: 500 }}
            >
              {prof.website}
            </a>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            className="stock-price"
            style={{
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: "-1.5px",
              fontFamily: "var(--font-mono)",
              color: "var(--text)",
            }}
          >
            {curPrice != null ? curPrice.toFixed(2) : "—"}
            <span
              className="stock-currency"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-3)",
                marginLeft: 5,
              }}
            >
              {pr?.currency}
            </span>
          </div>
          {chg != null && (
            <div
              className={`price-change ${isUp ? "up" : "down"}`}
              style={{
                display: "inline-flex",
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                fontWeight: 700,
                fontSize: 13,
                fontFamily: "var(--font-mono)",
              }}
            >
              {isUp ? "▲" : "▼"} {Math.abs(chg).toFixed(2)} ({Math.abs((chgPct ?? 0) * 100).toFixed(2)} %)
            </div>
          )}
          {pr?.regularMarketVolume?.raw != null && (
            <div
              className="stock-volume"
              style={{ fontSize: 11, color: "var(--text-3)" }}
            >
              Vol. {fmt(pr.regularMarketVolume.raw, "currency")}
            </div>
          )}
          {pr?.regularMarketTime && (
            <div
              className="stock-time"
              style={{ fontSize: 11, color: "var(--text-3)" }}
            >
              {new Date(pr.regularMarketTime * 1000).toLocaleString("fr-FR", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
              })}
            </div>
          )}
          {fetchedAt && (
            <div
              className="stock-fetched-at"
              style={{ fontSize: 11, color: "var(--text-3)" }}
            >
              {formatElapsed(elapsed)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

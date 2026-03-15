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
    <div className="card stock-header-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <h1 className="stock-name">{pr?.shortName || pr?.longName || symbol}</h1>
            <span className="badge badge-primary">{symbol}</span>
            {prof?.sector && <span className="badge badge-green">{prof.sector}</span>}
            {pr?.exchangeName && <span className="badge badge-orange">{pr.exchangeName}</span>}
            <button className="watchlist-btn" onClick={() => onToggleWatchlist(symbol, pr?.shortName || symbol)} title={inWl ? "Retirer des favoris" : "Ajouter aux favoris"}>
              {inWl ? "★" : "☆"}
            </button>
          </div>
{prof?.country && <p className="stock-meta">{prof.country} · {prof.industry}</p>}
          {prof?.website && <a href={prof.website} target="_blank" rel="noopener noreferrer" className="stock-link">{prof.website}</a>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="stock-price">
            {curPrice != null ? curPrice.toFixed(2) : "—"}
            <span className="stock-currency">{pr?.currency}</span>
          </div>
          {chg != null && (
            <div className={`price-change ${isUp ? "up" : "down"}`}>
              {isUp ? "▲" : "▼"} {Math.abs(chg).toFixed(2)} ({Math.abs((chgPct ?? 0) * 100).toFixed(2)} %)
            </div>
          )}
          {pr?.regularMarketVolume?.raw != null && (
            <div className="stock-volume">Vol. {fmt(pr.regularMarketVolume.raw, "currency")}</div>
          )}
          {pr?.regularMarketTime && (
            <div className="stock-time">
              {new Date(pr.regularMarketTime * 1000).toLocaleString("fr-FR", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
              })}
            </div>
          )}
          {fetchedAt && (
            <div className="stock-fetched-at">
              {formatElapsed(elapsed)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

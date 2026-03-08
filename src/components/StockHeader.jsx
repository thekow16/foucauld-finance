import { fmt } from "../utils/format";

export default function StockHeader({ data, symbol, isInWatchlist, onToggleWatchlist }) {
  const pr = data?.price;
  const prof = data?.assetProfile;
  const curPrice = pr?.regularMarketPrice?.raw;
  const chg = pr?.regularMarketChange?.raw;
  const chgPct = pr?.regularMarketChangePercent?.raw;
  const isUp = (chg ?? 0) >= 0;
  const inWl = isInWatchlist(symbol);

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
        </div>
      </div>
    </div>
  );
}

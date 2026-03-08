import { useState, useEffect } from "react";
import { fetchChartData } from "../utils/api";

function MiniSparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const prices = data.map(d => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 120, h = 40;
  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w;
    const y = h - ((p - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function WatchlistCard({ item, onSelect, onRemove }) {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchChartData(item.symbol, "1d", "1mo")
      .then(d => { if (!cancelled) setChartData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [item.symbol]);

  const lastPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : null;
  const firstPrice = chartData.length > 1 ? chartData[0].price : null;
  const change = lastPrice != null && firstPrice != null ? ((lastPrice - firstPrice) / firstPrice) * 100 : null;
  const isUp = (change ?? 0) >= 0;
  const sparkColor = isUp ? "#10b981" : "#ef4444";

  return (
    <div className="wl-card">
      <button className="wl-card-remove" onClick={() => onRemove(item.symbol)} title="Retirer des favoris">×</button>
      <button className="wl-card-body" onClick={() => onSelect(item.symbol)}>
        <div className="wl-card-header">
          <span className="wl-card-symbol">{item.symbol}</span>
          {change != null && (
            <span className={`wl-card-change ${isUp ? "up" : "down"}`}>
              {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
            </span>
          )}
        </div>
        <div className="wl-card-name">{item.name}</div>
        <div className="wl-card-chart">
          {loading ? (
            <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            </div>
          ) : (
            <MiniSparkline data={chartData} color={sparkColor} />
          )}
        </div>
        {lastPrice != null && (
          <div className="wl-card-price">{lastPrice.toFixed(2)}</div>
        )}
      </button>
    </div>
  );
}

export default function WatchlistTab({ watchlist, onSelect, onRemove, onBack }) {
  if (watchlist.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "64px 24px" }}>
        <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.3, fontWeight: 700 }}>Watchlist</div>
        <h2 style={{ color: "var(--text)", fontSize: 20, fontWeight: 800, marginBottom: 10 }}>
          Votre Watchlist est vide
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, maxWidth: 400, margin: "0 auto" }}>
          Ajoutez des actions à votre watchlist en cliquant sur l'étoile ☆ lors de l'analyse d'une action.
        </p>
        <button className="ff-btn" style={{ marginTop: 24, background: "#4f46e5", color: "white" }} onClick={onBack}>
          Rechercher une action
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--text)", letterSpacing: -0.5 }}>
            Ma Watchlist
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            {watchlist.length} action{watchlist.length > 1 ? "s" : ""} suivie{watchlist.length > 1 ? "s" : ""}
          </p>
        </div>
        <button className="ff-btn" style={{ background: "#4f46e5", color: "white", padding: "10px 20px", fontSize: 13 }} onClick={onBack}>
          Retour
        </button>
      </div>
      <div className="wl-grid">
        {watchlist.map(item => (
          <WatchlistCard key={item.symbol} item={item} onSelect={onSelect} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}

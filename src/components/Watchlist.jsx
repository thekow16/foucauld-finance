export default function Watchlist({ watchlist, onSelect, onRemove }) {
  if (watchlist.length === 0) return null;

  return (
    <div className="card watchlist-card">
      <div className="section-title" style={{ marginBottom: 14 }}>Mes Favoris</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {watchlist.map(w => (
          <div key={w.symbol} className="watchlist-item">
            <button className="watchlist-item-btn" onClick={() => onSelect(w.symbol)}>
              <span className="wl-symbol">{w.symbol}</span>
              <span className="wl-name">{w.name}</span>
            </button>
            <button className="wl-remove" onClick={() => onRemove(w.symbol)} title="Retirer">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

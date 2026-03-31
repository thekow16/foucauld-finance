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
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }} aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function AlertToggle({ label, active, onClick, dist }) {
  return (
    <button
      className={`alert-toggle ${active ? "active" : ""}`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={active ? `Désactiver l'alerte ${label}` : `Activer l'alerte ${label}`}
    >
      <span className="alert-toggle-bell">{active ? "🔔" : "🔕"}</span>
      <span className="alert-toggle-label">{label}</span>
      {dist != null && <span className={`alert-toggle-dist ${Math.abs(dist) < 2 ? "near" : ""}`}>{dist > 0 ? "+" : ""}{dist.toFixed(1)}%</span>}
    </button>
  );
}

function WatchlistCard({ item, onSelect, onRemove, alertState, onToggleAlert, maInfo, priceAlerts, onSetPriceAlert, onRemovePriceAlert }) {
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
      <div className="wl-card-alerts">
        <AlertToggle label="MA50" active={alertState.ma50} onClick={() => onToggleAlert(item.symbol, "ma50")} dist={maInfo?.dist50} />
        <AlertToggle label="MA200" active={alertState.ma200} onClick={() => onToggleAlert(item.symbol, "ma200")} dist={maInfo?.dist200} />
      </div>
      <div style={{ padding: "0 10px 10px" }}>
        <PriceAlertList alerts={priceAlerts} onRemove={onRemovePriceAlert} />
        <PriceAlertForm symbol={item.symbol} onAdd={onSetPriceAlert} />
      </div>
    </div>
  );
}

function TriggeredAlerts({ triggered, onDismiss, onSelect }) {
  if (triggered.length === 0) return null;
  return (
    <div className="triggered-alerts">
      <div className="triggered-header">
        <span>🔔 Alertes déclenchées</span>
      </div>
      {triggered.map((t, i) => (
        <div key={`${t.symbol}-${t.ma}-${t.time}`} className={`triggered-item ${t.direction}`}>
          <button className="triggered-body" onClick={() => onSelect(t.symbol)}>
            <span className="triggered-symbol">{t.symbol}</span>
            <span className="triggered-detail">
              {t.direction === "above"
                ? `Prix (${t.price.toFixed(2)}) a croisé au-dessus de ${t.ma} (${t.maValue.toFixed(2)})`
                : `Prix (${t.price.toFixed(2)}) a croisé en dessous de ${t.ma} (${t.maValue.toFixed(2)})`}
            </span>
            <span className="triggered-arrow">{t.direction === "above" ? "↗" : "↘"}</span>
          </button>
          <button className="triggered-dismiss" onClick={() => onDismiss(i)} title="Fermer">×</button>
        </div>
      ))}
    </div>
  );
}

function PriceAlertForm({ symbol, onAdd }) {
  const [type, setType] = useState("above");
  const [target, setTarget] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        style={{ background: "none", border: "1px dashed var(--border)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "var(--muted)", cursor: "pointer", width: "100%" }}
      >
        + Alerte prix
      </button>
    );
  }

  return (
    <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
      <select value={type} onChange={e => setType(e.target.value)} style={{ padding: "4px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 11 }}>
        <option value="above">Prix ≥</option>
        <option value="below">Prix ≤</option>
      </select>
      <input
        type="number" step="any" min="0" value={target} onChange={e => setTarget(e.target.value)}
        placeholder="Prix cible"
        style={{ width: 80, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 11 }}
      />
      <button
        onClick={() => { if (target) { onAdd(symbol, type, Number(target)); setTarget(""); setOpen(false); } }}
        style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
      >
        OK
      </button>
      <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13 }}>×</button>
    </div>
  );
}

function PriceAlertList({ alerts, onRemove }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
      {alerts.map(a => (
        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <span style={{ color: a.triggered ? "var(--green)" : "var(--muted)", fontWeight: 600 }}>
            {a.triggered ? "✓ " : ""}{a.type === "above" ? "≥" : "≤"} {a.target.toFixed(2)}
          </span>
          <button onClick={(e) => { e.stopPropagation(); onRemove(a.id); }} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 11, padding: 0 }}>×</button>
        </div>
      ))}
    </div>
  );
}

export default function WatchlistTab({ watchlist, onSelect, onRemove, onBack, alertState, onToggleAlert, triggered, onDismissAlert, maData, checking, priceAlerts = [], onSetPriceAlert, onRemovePriceAlert }) {
  if (watchlist.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "64px 24px" }}>
        <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.3 }}>★</div>
        <h2 className="empty-state-title">
          Votre Watchlist est vide
        </h2>
        <p className="empty-state-text">
          Ajoutez des actions à votre watchlist en cliquant sur l'étoile ☆ lors de l'analyse d'une action.
        </p>
        <button className="ff-btn empty-state-btn" onClick={onBack}>
          Rechercher une action
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="tab-header">
        <div>
          <h2 className="tab-title">
            ★ Ma Watchlist
          </h2>
          <p className="tab-subtitle">
            {watchlist.length} action{watchlist.length > 1 ? "s" : ""} suivie{watchlist.length > 1 ? "s" : ""}
            {checking && <span style={{ marginLeft: 8, opacity: 0.6 }}>— vérification des alertes…</span>}
          </p>
        </div>
        <button className="ff-btn tab-btn-primary" onClick={onBack}>
          Retour
        </button>
      </div>

      <TriggeredAlerts triggered={triggered || []} onDismiss={onDismissAlert} onSelect={onSelect} />

      <div className="wl-grid">
        {watchlist.map(item => (
          <WatchlistCard
            key={item.symbol}
            item={item}
            onSelect={onSelect}
            onRemove={onRemove}
            alertState={alertState?.(item.symbol) || { ma50: false, ma200: false }}
            onToggleAlert={onToggleAlert}
            maInfo={maData?.[item.symbol]}
            priceAlerts={priceAlerts?.filter(a => a.symbol === item.symbol) || []}
            onSetPriceAlert={onSetPriceAlert}
            onRemovePriceAlert={onRemovePriceAlert}
          />
        ))}
      </div>
    </div>
  );
}

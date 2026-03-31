import { useState, useEffect } from "react";
import { fetchChartData } from "../utils/api";
import { fmt } from "../utils/format";

function AddPositionForm({ onAdd, defaultSymbol, defaultName }) {
  const [symbol, setSymbol] = useState(defaultSymbol || "");
  const [name, setName] = useState(defaultName || "");
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!symbol || !quantity || !buyPrice) return;
    onAdd(symbol.toUpperCase(), name || symbol.toUpperCase(), Number(quantity), Number(buyPrice), date);
    setSymbol(defaultSymbol || "");
    setName(defaultName || "");
    setQuantity("");
    setBuyPrice("");
    setDate(new Date().toISOString().slice(0, 10));
  };

  return (
    <form onSubmit={handleSubmit} className="portfolio-form">
      <div className="portfolio-form-row">
        <input className="pf-input" value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="Symbole" required style={{ flex: 1 }} />
        <input className="pf-input" value={name} onChange={e => setName(e.target.value)} placeholder="Nom (optionnel)" style={{ flex: 2 }} />
      </div>
      <div className="portfolio-form-row">
        <input className="pf-input" type="number" min="0.01" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Quantité" required style={{ flex: 1 }} />
        <input className="pf-input" type="number" min="0.01" step="any" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} placeholder="Prix d'achat" required style={{ flex: 1 }} />
        <input className="pf-input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ flex: 1 }} />
      </div>
      <button type="submit" className="ff-btn" style={{ background: "#4f46e5", color: "#fff", padding: "10px 24px", fontSize: 13, width: "100%" }}>
        Ajouter la position
      </button>
    </form>
  );
}

function PortfolioSummary({ positions, prices }) {
  let totalInvested = 0;
  let totalCurrent = 0;

  positions.forEach(p => {
    const invested = p.quantity * p.buyPrice;
    const currentPrice = prices[p.symbol];
    totalInvested += invested;
    if (currentPrice != null) totalCurrent += p.quantity * currentPrice;
    else totalCurrent += invested; // fallback
  });

  const totalPnl = totalCurrent - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const isUp = totalPnl >= 0;

  return (
    <div className="card portfolio-summary">
      <div className="pf-summary-item">
        <div className="pf-summary-label">Valeur totale</div>
        <div className="pf-summary-value">{fmt(totalCurrent, "currency")}</div>
      </div>
      <div className="pf-summary-item">
        <div className="pf-summary-label">Investi</div>
        <div className="pf-summary-value" style={{ color: "var(--muted)" }}>{fmt(totalInvested, "currency")}</div>
      </div>
      <div className="pf-summary-item">
        <div className="pf-summary-label">P&L</div>
        <div className="pf-summary-value" style={{ color: isUp ? "var(--green)" : "var(--red)" }}>
          {isUp ? "+" : ""}{fmt(totalPnl, "currency")}
        </div>
      </div>
      <div className="pf-summary-item">
        <div className="pf-summary-label">Performance</div>
        <div className="pf-summary-value" style={{ color: isUp ? "var(--green)" : "var(--red)" }}>
          {isUp ? "+" : ""}{totalPnlPct.toFixed(2)} %
        </div>
      </div>
    </div>
  );
}

export default function PortfolioTab({ positions, onAdd, onRemove, onSelect, onBack }) {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Fetch current prices for all symbols
  useEffect(() => {
    const symbols = [...new Set(positions.map(p => p.symbol))];
    if (symbols.length === 0) return;
    setLoading(true);
    Promise.allSettled(
      symbols.map(async (sym) => {
        const data = await fetchChartData(sym, "1d", "5d");
        if (data.length > 0) return { sym, price: data[data.length - 1].price };
        return { sym, price: null };
      })
    ).then(results => {
      const newPrices = {};
      results.forEach(r => {
        if (r.status === "fulfilled" && r.value) {
          newPrices[r.value.sym] = r.value.price;
        }
      });
      setPrices(newPrices);
      setLoading(false);
    });
  }, [positions]);

  if (positions.length === 0 && !showForm) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "64px 24px" }}>
        <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.3 }}>💼</div>
        <h2 className="empty-state-title">
          Portefeuille vide
        </h2>
        <p className="empty-state-text">
          Ajoutez des positions pour suivre la performance de votre portefeuille virtuel.
        </p>
        <button className="ff-btn empty-state-btn" onClick={() => setShowForm(true)}>
          Ajouter une position
        </button>
        <button className="ff-btn empty-state-btn-secondary" onClick={onBack}>
          Retour
        </button>
      </div>
    );
  }

  // Group positions by symbol
  const grouped = {};
  positions.forEach(p => {
    if (!grouped[p.symbol]) grouped[p.symbol] = [];
    grouped[p.symbol].push(p);
  });

  return (
    <div>
      <div className="tab-header">
        <div>
          <h2 className="tab-title">
            💼 Mon Portefeuille
          </h2>
          <p className="tab-subtitle">
            {positions.length} position{positions.length > 1 ? "s" : ""} · {Object.keys(grouped).length} action{Object.keys(grouped).length > 1 ? "s" : ""}
            {loading && <span style={{ marginLeft: 8, opacity: 0.6 }}>— chargement des cours…</span>}
          </p>
        </div>
        <div className="tab-actions">
          <button className="ff-btn tab-btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Fermer" : "+ Ajouter"}
          </button>
          <button className="ff-btn tab-btn-secondary" onClick={onBack}>
            Retour
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>Nouvelle position</div>
          <AddPositionForm onAdd={(s, n, q, p, d) => { onAdd(s, n, q, p, d); setShowForm(false); }} />
        </div>
      )}

      <PortfolioSummary positions={positions} prices={prices} />

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="ff-table">
            <thead>
              <tr>
                <th>Action</th>
                <th style={{ textAlign: "right" }}>Qté</th>
                <th style={{ textAlign: "right" }}>PRU</th>
                <th style={{ textAlign: "right" }}>Cours</th>
                <th style={{ textAlign: "right" }}>Valeur</th>
                <th style={{ textAlign: "right" }}>P&L</th>
                <th style={{ textAlign: "right" }}>%</th>
                <th style={{ textAlign: "right" }}>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {positions.map(p => {
                const currentPrice = prices[p.symbol];
                const invested = p.quantity * p.buyPrice;
                const current = currentPrice != null ? p.quantity * currentPrice : null;
                const pnl = current != null ? current - invested : null;
                const pnlPct = pnl != null && invested > 0 ? (pnl / invested) * 100 : null;
                const isUp = (pnl ?? 0) >= 0;
                return (
                  <tr key={p.id}>
                    <td>
                      <button onClick={() => onSelect(p.symbol)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "var(--accent)", fontFamily: "inherit", fontSize: "inherit", padding: 0 }}>
                        {p.symbol}
                      </button>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.name}</div>
                    </td>
                    <td style={{ textAlign: "right" }}>{p.quantity}</td>
                    <td style={{ textAlign: "right" }}>{p.buyPrice.toFixed(2)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      {currentPrice != null ? currentPrice.toFixed(2) : <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, display: "inline-block" }} />}
                    </td>
                    <td style={{ textAlign: "right" }}>{current != null ? fmt(current, "currency") : "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: isUp ? "var(--green)" : "var(--red)" }}>
                      {pnl != null ? `${isUp ? "+" : ""}${fmt(pnl, "currency")}` : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: isUp ? "var(--green)" : "var(--red)" }}>
                      {pnlPct != null ? `${isUp ? "+" : ""}${pnlPct.toFixed(2)}%` : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontSize: 11, color: "var(--muted)" }}>{p.date}</td>
                    <td style={{ textAlign: "center" }}>
                      <button onClick={() => onRemove(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 16, padding: "4px 8px" }} title="Supprimer">
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

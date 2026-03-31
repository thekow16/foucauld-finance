import { useState, useEffect } from "react";
import { fmt } from "../utils/format";

const WORKER_URL = "https://foucauld-proxy.foucauld-finance.workers.dev";
const FMP_BASE = "https://financialmodelingprep.com/api/v3";
const CACHE_KEY = "alphaview-screener-cache";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const SECTORS = [
  "Technology", "Healthcare", "Financial Services", "Consumer Cyclical",
  "Communication Services", "Industrials", "Consumer Defensive", "Energy",
  "Basic Materials", "Real Estate", "Utilities",
];

const EXCHANGES = ["NYSE", "NASDAQ", "EURONEXT", "XETRA", "LSE"];

const MARKET_CAP_OPTIONS = [
  { label: "Toutes", min: 0, max: Infinity },
  { label: "Mega cap (> 200 Md$)", min: 200e9, max: Infinity },
  { label: "Large cap (10-200 Md$)", min: 10e9, max: 200e9 },
  { label: "Mid cap (2-10 Md$)", min: 2e9, max: 10e9 },
  { label: "Small cap (< 2 Md$)", min: 0, max: 2e9 },
];

function getCachedData() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function setCachedData(data) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
}

async function fetchScreenerData() {
  const cached = getCachedData();
  if (cached) return cached;

  const url = `${FMP_BASE}/stock-screener?marketCapMoreThan=1000000000&isActivelyTrading=true&limit=500`;
  const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Format inattendu");
  setCachedData(data);
  return data;
}

export default function ScreenerView({ onSelect, onBack }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [sector, setSector] = useState("");
  const [exchange, setExchange] = useState("");
  const [capIdx, setCapIdx] = useState(0);
  const [country, setCountry] = useState("");
  const [minDiv, setMinDiv] = useState("");
  const [sortKey, setSortKey] = useState("marketCap");
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchScreenerData()
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const cap = MARKET_CAP_OPTIONS[capIdx];
  const filtered = data.filter(s => {
    if (sector && s.sector !== sector) return false;
    if (exchange && s.exchangeShortName !== exchange) return false;
    if (s.marketCap < cap.min || s.marketCap > cap.max) return false;
    if (country && s.country !== country) return false;
    if (minDiv && (s.lastAnnualDividend || 0) < Number(minDiv)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.symbol?.toLowerCase().includes(q) && !s.companyName?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortKey] ?? 0;
    const vb = b[sortKey] ?? 0;
    return sortDir === "desc" ? vb - va : va - vb;
  });

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sortIcon = (key) => sortKey === key ? (sortDir === "desc" ? " ▼" : " ▲") : "";

  // Unique countries from data
  const countries = [...new Set(data.map(s => s.country).filter(Boolean))].sort();

  if (loading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
        <div className="spinner" />
        <p style={{ color: "var(--accent)", fontWeight: 700, fontSize: 15, marginTop: 16 }}>Chargement du screener…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "52px 24px" }}>
        <p style={{ color: "var(--red)", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Erreur : {error}</p>
        <button className="ff-btn" onClick={onBack} style={{ marginTop: 16 }}>Retour</button>
      </div>
    );
  }

  return (
    <div>
      <div className="tab-header">
        <div>
          <h2 className="tab-title">
            Screener
          </h2>
          <p className="tab-subtitle">
            {sorted.length} résultat{sorted.length > 1 ? "s" : ""} sur {data.length} actions
          </p>
        </div>
        <button className="ff-btn tab-btn-secondary" onClick={onBack}>
          Retour
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="screener-filters">
          <div className="screener-filter">
            <label className="screener-label">Recherche</label>
            <input className="pf-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Symbole ou nom…" />
          </div>
          <div className="screener-filter">
            <label className="screener-label">Secteur</label>
            <select className="pf-input" value={sector} onChange={e => setSector(e.target.value)}>
              <option value="">Tous</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="screener-filter">
            <label className="screener-label">Capitalisation</label>
            <select className="pf-input" value={capIdx} onChange={e => setCapIdx(Number(e.target.value))}>
              {MARKET_CAP_OPTIONS.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
            </select>
          </div>
          <div className="screener-filter">
            <label className="screener-label">Place</label>
            <select className="pf-input" value={exchange} onChange={e => setExchange(e.target.value)}>
              <option value="">Toutes</option>
              {EXCHANGES.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="screener-filter">
            <label className="screener-label">Pays</label>
            <select className="pf-input" value={country} onChange={e => setCountry(e.target.value)}>
              <option value="">Tous</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="screener-filter">
            <label className="screener-label">Dividende min ($)</label>
            <input className="pf-input" type="number" min="0" step="0.1" value={minDiv} onChange={e => setMinDiv(e.target.value)} placeholder="0" />
          </div>
        </div>
      </div>

      {/* Results table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="ff-table">
            <thead>
              <tr>
                <th style={{ cursor: "pointer" }} onClick={() => handleSort("symbol")}>Symbole{sortIcon("symbol")}</th>
                <th>Nom</th>
                <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("marketCap")}>Cap.{sortIcon("marketCap")}</th>
                <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("price")}>Prix{sortIcon("price")}</th>
                <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("beta")}>Beta{sortIcon("beta")}</th>
                <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("lastAnnualDividend")}>Div.{sortIcon("lastAnnualDividend")}</th>
                <th>Secteur</th>
                <th>Pays</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 100).map(s => (
                <tr key={s.symbol} style={{ cursor: "pointer" }} onClick={() => onSelect(s.symbol)}>
                  <td style={{ fontWeight: 700, color: "var(--accent)" }}>{s.symbol}</td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.companyName}</td>
                  <td style={{ textAlign: "right" }}>{fmt(s.marketCap, "currency")}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{s.price?.toFixed(2) || "—"}</td>
                  <td style={{ textAlign: "right" }}>{s.beta?.toFixed(2) || "—"}</td>
                  <td style={{ textAlign: "right" }}>{s.lastAnnualDividend?.toFixed(2) || "—"}</td>
                  <td style={{ fontSize: 11, color: "var(--muted)" }}>{s.sector || "—"}</td>
                  <td style={{ fontSize: 11 }}>{s.country || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length > 100 && (
          <div style={{ textAlign: "center", padding: "12px", color: "var(--muted)", fontSize: 12 }}>
            Affichage limité aux 100 premiers résultats. Affinez vos filtres pour plus de précision.
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, Component } from "react";
import Header from "./components/Header";
import StockHeader from "./components/StockHeader";
import MetricCards from "./components/MetricCards";
import ScoreCard from "./components/ScoreCard";
import CandlestickChart from "./components/CandlestickChart";
import RatiosTab from "./components/RatiosTab";
import { BilanTab, ResultatsTab, TresorerieTab } from "./components/FinancialTabs";
import CompareMode from "./components/CompareMode";
import Watchlist from "./components/Watchlist";
import WatchlistTab from "./components/WatchlistTab";
import { useWatchlist } from "./hooks/useWatchlist";
import { useDarkMode } from "./hooks/useDarkMode";
import { fetchStockData } from "./utils/api";

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("[FF] Render crash:", error, info.componentStack); }
  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
          <p style={{ color: "#ef4444", fontWeight: 700 }}>Erreur d'affichage</p>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>{this.state.error.message}</p>
          <button className="ff-btn" style={{ marginTop: 16 }} onClick={() => this.setState({ error: null })}>Réessayer</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const TABS = [
  { id: "ratios", label: "Ratios" },
  { id: "bilan", label: "Bilan" },
  { id: "resultats", label: "Résultats" },
  { id: "tresorerie", label: "Trésorerie" },
  { id: "compare", label: "Comparer" },
];

export default function FoucauldFinance() {
  const [symbol, setSymbol] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("ratios");
  const [showWatchlist, setShowWatchlist] = useState(false);

  const [dark, toggleDark] = useDarkMode();
  const { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();

  const doFetchStock = async (sym) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await fetchStockData(sym);
      setData(result);
    } catch (e) {
      setError(e.message || "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (sym) => {
    setSymbol(sym);
    setActiveTab("ratios");
    setShowWatchlist(false);
    doFetchStock(sym);
  };

  const handleToggleWatchlist = (sym, name) => {
    if (isInWatchlist(sym)) removeFromWatchlist(sym);
    else addToWatchlist(sym, name);
  };

  return (
    <div className={`app ${dark ? "dark" : "light"}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}

        :root {
          --bg: #F2F4FF;
          --card: #ffffff;
          --text: #0f172a;
          --text-secondary: #334155;
          --muted: #94a3b8;
          --border: #e8ecff;
          --highlight-row: #f8f9ff;
          --input-bg: rgba(255,255,255,.12);
          --shadow: rgba(79,70,229,.08);
        }

        .dark {
          --bg: #0f172a;
          --card: #1e293b;
          --text: #f1f5f9;
          --text-secondary: #cbd5e1;
          --muted: #64748b;
          --border: #334155;
          --highlight-row: #253348;
          --shadow: rgba(0,0,0,.3);
        }

        .app {
          font-family: 'Outfit', sans-serif;
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          transition: background .3s, color .3s;
        }

        .hero {
          background: linear-gradient(135deg, #312e81 0%, #4f46e5 45%, #7c3aed 75%, #0f766e 100%);
          padding: 28px 20px 72px;
          position: relative;
          overflow: hidden;
        }
        .hero::before {
          content: '';
          position: absolute;
          top: -80px; right: -80px;
          width: 300px; height: 300px;
          background: rgba(255,255,255,.06);
          border-radius: 50%;
        }
        .hero::after {
          content: '';
          position: absolute;
          bottom: -100px; left: -60px;
          width: 340px; height: 340px;
          background: rgba(255,255,255,.04);
          border-radius: 50%;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .logo-icon {
          width: 42px; height: 42px;
          background: rgba(255,255,255,.15);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
        }
        .logo-text {
          color: white;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -.5px;
        }

        .dark-toggle {
          background: rgba(255,255,255,.15);
          border: 1px solid rgba(255,255,255,.25);
          border-radius: 50%;
          width: 40px; height: 40px;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background .2s;
        }
        .dark-toggle:hover {
          background: rgba(255,255,255,.25);
        }

        .search-wrap {
          display: flex;
          gap: 10px;
          max-width: 700px;
          position: relative;
          z-index: 1;
        }
        .ff-input {
          flex: 1;
          padding: 14px 20px;
          border-radius: 50px;
          border: 2px solid rgba(255,255,255,.2);
          background: rgba(255,255,255,.12);
          backdrop-filter: blur(10px);
          color: white;
          font-family: 'Outfit', sans-serif;
          font-size: 15px;
          font-weight: 500;
          outline: none;
          transition: border .2s, background .2s;
        }
        .ff-input::placeholder { color: rgba(255,255,255,.5) }
        .ff-input:focus {
          border-color: rgba(255,255,255,.55);
          background: rgba(255,255,255,.18);
        }
        .ff-btn {
          padding: 14px 26px;
          background: white;
          color: #4f46e5;
          border: none;
          border-radius: 50px;
          font-family: 'Outfit', sans-serif;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          transition: transform .15s, box-shadow .15s;
          box-shadow: 0 4px 20px rgba(0,0,0,.2);
          white-space: nowrap;
        }
        .ff-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 26px rgba(0,0,0,.25);
        }

        .autocomplete-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 100px;
          background: var(--card);
          border-radius: 16px;
          margin-top: 6px;
          box-shadow: 0 8px 32px rgba(0,0,0,.2);
          overflow: hidden;
          z-index: 100;
        }
        .autocomplete-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 18px;
          border: none;
          background: none;
          cursor: pointer;
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          color: var(--text);
          transition: background .15s;
          text-align: left;
        }
        .autocomplete-item:hover {
          background: var(--highlight-row);
        }
        .ac-symbol {
          font-weight: 800;
          color: #4f46e5;
          min-width: 70px;
        }
        .ac-name {
          flex: 1;
          color: var(--text-secondary);
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ac-exchange {
          font-size: 11px;
          color: var(--muted);
          font-weight: 600;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 16px;
          position: relative;
          z-index: 1;
        }
        .chip {
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.25);
          color: rgba(255,255,255,.85);
          padding: 5px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'Outfit', sans-serif;
          cursor: pointer;
          transition: background .2s;
        }
        .chip:hover { background: rgba(255,255,255,.22) }

        .main {
          max-width: 960px;
          margin: -38px auto 0;
          padding: 0 16px 52px;
          position: relative;
        }

        .card {
          background: var(--card);
          border-radius: 22px;
          padding: 24px;
          box-shadow: 0 4px 24px var(--shadow);
          margin-bottom: 18px;
          transition: background .3s;
        }

        .grid8 {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }
        .metric-card {
          background: var(--card);
          border-radius: 18px;
          padding: 18px 16px;
          box-shadow: 0 2px 14px rgba(0,0,0,.05);
          border-top: 3px solid;
          transition: transform .15s, background .3s;
        }
        .metric-card:hover { transform: translateY(-2px) }
        .metric-value {
          font-size: 20px;
          font-weight: 900;
          color: var(--text);
          letter-spacing: -.5px;
        }
        .metric-label {
          font-size: 11px;
          color: var(--muted);
          font-weight: 600;
          margin-top: 4px;
        }

        .stock-name {
          font-size: 23px;
          font-weight: 900;
          color: var(--text);
          letter-spacing: -.5px;
        }
        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
        }
        .badge-primary { background: #e0e7ff; color: #4f46e5 }
        .badge-green { background: #f0fdf4; color: #16a34a }
        .badge-orange { background: #fff7ed; color: #ea580c }
        .dark .badge-primary { background: #312e81; color: #a5b4fc }
        .dark .badge-green { background: #14532d; color: #86efac }
        .dark .badge-orange { background: #7c2d12; color: #fed7aa }

        .stock-summary {
          color: var(--text-secondary);
          font-size: 13px;
          line-height: 1.6;
          max-width: 480px;
        }
        .stock-meta {
          color: var(--muted);
          font-size: 12px;
          margin-top: 6px;
        }
        .stock-link {
          color: #4f46e5;
          font-size: 12px;
          text-decoration: none;
          font-weight: 600;
        }
        .stock-link:hover { text-decoration: underline }
        .stock-price {
          font-size: 38px;
          font-weight: 900;
          color: var(--text);
          letter-spacing: -1px;
          line-height: 1;
        }
        .stock-currency {
          font-size: 15px;
          font-weight: 600;
          color: var(--muted);
          margin-left: 6px;
        }
        .price-change {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: 800;
          font-size: 14px;
        }
        .price-change.up { background: #f0fdf4; color: #16a34a }
        .price-change.down { background: #fef2f2; color: #dc2626 }
        .dark .price-change.up { background: #14532d; color: #86efac }
        .dark .price-change.down { background: #7f1d1d; color: #fca5a5 }
        .stock-volume {
          font-size: 12px;
          color: var(--muted);
          margin-top: 8px;
        }
        .stock-time {
          font-size: 11px;
          color: var(--muted);
          margin-top: 4px;
        }

        .watchlist-btn {
          background: none;
          border: none;
          font-size: 22px;
          cursor: pointer;
          color: #f59e0b;
          transition: transform .15s;
          line-height: 1;
        }
        .watchlist-btn:hover { transform: scale(1.2) }

        .watchlist-card { margin-bottom: 18px }
        .watchlist-item {
          display: flex;
          align-items: center;
          background: var(--highlight-row);
          border-radius: 12px;
          overflow: hidden;
          transition: background .2s;
        }
        .watchlist-item:hover { background: var(--border) }
        .watchlist-item-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: none;
          background: none;
          cursor: pointer;
          font-family: 'Outfit', sans-serif;
          color: var(--text);
        }
        .wl-symbol { font-weight: 800; color: #4f46e5; font-size: 13px }
        .wl-name { font-size: 12px; color: var(--muted); font-weight: 500 }
        .wl-remove {
          padding: 8px 10px;
          border: none;
          background: none;
          cursor: pointer;
          color: var(--muted);
          font-size: 16px;
          font-weight: 700;
          transition: color .15s;
        }
        .wl-remove:hover { color: #ef4444 }

        .watchlist-header-btn {
          background: rgba(255,255,255,.15);
          border: 1px solid rgba(255,255,255,.25);
          border-radius: 50%;
          width: 40px; height: 40px;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f59e0b;
          transition: background .2s;
          position: relative;
        }
        .watchlist-header-btn:hover { background: rgba(255,255,255,.25) }
        .wl-count {
          position: absolute;
          top: -4px; right: -4px;
          background: #ef4444;
          color: white;
          font-size: 10px;
          font-weight: 800;
          width: 18px; height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Outfit', sans-serif;
        }

        .wl-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 14px;
        }
        .wl-card {
          background: var(--card);
          border-radius: 18px;
          box-shadow: 0 2px 14px var(--shadow);
          position: relative;
          transition: transform .15s, box-shadow .15s;
          overflow: hidden;
        }
        .wl-card:hover { transform: translateY(-3px); box-shadow: 0 8px 30px var(--shadow) }
        .wl-card-body {
          display: block;
          width: 100%;
          padding: 20px 18px 16px;
          border: none;
          background: none;
          cursor: pointer;
          font-family: 'Outfit', sans-serif;
          text-align: left;
          color: var(--text);
        }
        .wl-card-remove {
          position: absolute;
          top: 8px; right: 8px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--muted);
          font-size: 18px;
          font-weight: 700;
          width: 26px; height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all .15s;
          z-index: 2;
        }
        .wl-card-remove:hover { color: #ef4444; background: var(--highlight-row) }
        .wl-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .wl-card-symbol { font-weight: 900; font-size: 16px; color: #4f46e5 }
        .wl-card-name {
          font-size: 12px;
          color: var(--muted);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 10px;
        }
        .wl-card-chart { margin-bottom: 8px }
        .wl-card-price {
          font-size: 20px;
          font-weight: 900;
          color: var(--text);
          letter-spacing: -.5px;
        }
        .wl-card-change {
          font-size: 12px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 10px;
        }
        .wl-card-change.up { background: #f0fdf4; color: #16a34a }
        .wl-card-change.down { background: #fef2f2; color: #dc2626 }
        .dark .wl-card-change.up { background: #14532d; color: #86efac }
        .dark .wl-card-change.down { background: #7f1d1d; color: #fca5a5 }

        .section-title {
          font-size: 15px;
          font-weight: 800;
          color: var(--text);
        }
        .score-desc {
          color: var(--text-secondary);
          font-size: 13px;
          margin-top: 6px;
          line-height: 1.6;
          max-width: 420px;
        }
        .indicator-label {
          font-size: 11px;
          color: var(--muted);
          font-weight: 600;
          margin-bottom: 3px;
        }
        .stag {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 10px;
          display: inline-block;
        }
        .stag-good { background: #f0fdf4; color: #16a34a }
        .stag-bad { background: #fef2f2; color: #dc2626 }
        .dark .stag-good { background: #14532d; color: #86efac }
        .dark .stag-bad { background: #7f1d1d; color: #fca5a5 }

        .period-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 7px 13px;
          border-radius: 20px;
          font-family: 'Outfit', sans-serif;
          font-size: 13px;
          font-weight: 700;
          color: var(--muted);
          transition: all .18s;
        }
        .period-btn:hover { background: #e0e7ff; color: #4f46e5 }
        .period-btn.active { background: #4f46e5; color: white }
        .dark .period-btn:hover { background: #312e81; color: #a5b4fc }

        .tab-bar {
          border-bottom: 2px solid var(--border);
          display: flex;
          overflow-x: auto;
        }
        .tab-btn {
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          padding: 14px 20px;
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: var(--muted);
          transition: all .18s;
          white-space: nowrap;
        }
        .tab-btn.active { color: #4f46e5; border-bottom-color: #4f46e5 }
        .tab-btn:hover { color: #4f46e5 }

        .ff-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .ff-table th {
          background: var(--highlight-row);
          text-align: left;
          padding: 10px 14px;
          color: var(--muted);
          font-weight: 700;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .5px;
          border-bottom: 2px solid var(--border);
        }
        .ff-table th:not(:first-child) { text-align: right }
        .ff-table td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
        }
        .ff-table td:not(:first-child) { text-align: right; font-weight: 600 }
        .ff-table tr:hover td { background: var(--highlight-row) }
        .ff-table tr:last-child td { border-bottom: none }

        .ratio-cat {
          font-size: 11px;
          font-weight: 800;
          color: #4f46e5;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
          margin-top: 4px;
        }
        .ratio-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 12px 4px;
          border-bottom: 1px solid var(--border);
        }
        .ratio-row:last-child { border-bottom: none }
        .ratio-label { font-weight: 600; font-size: 13px; color: var(--text-secondary) }
        .ratio-hint { font-size: 11px; color: var(--muted) }
        .ratio-value { font-size: 15px; font-weight: 800; color: #4f46e5 }
        .ratio-value.muted { color: var(--muted) }

        .chart-label {
          font-size: 12px;
          color: var(--muted);
          font-weight: 700;
          margin-bottom: 12px;
        }

        .compare-input {
          flex: 1;
          padding: 10px 18px;
          border-radius: 50px;
          border: 2px solid var(--border);
          background: var(--bg);
          color: var(--text);
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          font-weight: 500;
          outline: none;
          transition: border .2s;
        }
        .compare-input:focus { border-color: #4f46e5 }
        .compare-btn {
          padding: 10px 22px;
          background: #4f46e5;
          color: white;
          border: none;
          border-radius: 50px;
          font-family: 'Outfit', sans-serif;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: background .2s;
        }
        .compare-btn:hover { background: #4338ca }
        .compare-btn:disabled { opacity: .5; cursor: default }
        .compare-error {
          color: #ef4444;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .compare-table th:not(:first-child),
        .compare-table td:not(:first-child) {
          text-align: center !important;
          min-width: 140px;
        }

        .spinner {
          width: 42px; height: 42px;
          border: 4px solid var(--border);
          border-top-color: #4f46e5;
          border-radius: 50%;
          animation: spin .7s linear infinite;
          margin: 0 auto 14px;
        }
        @keyframes spin { to { transform: rotate(360deg) } }

        .footer {
          text-align: center;
          color: var(--muted);
          font-size: 12px;
          padding-top: 8px;
          line-height: 2;
        }

        @media (max-width: 640px) {
          .grid8 { grid-template-columns: repeat(2, 1fr) }
          .search-wrap { flex-direction: column }
          .ff-btn { padding: 12px 20px }
          .stock-price { font-size: 28px }
          .main { padding: 0 10px 40px }
        }
      `}</style>

      <Header onSearch={handleSearch} dark={dark} toggleDark={toggleDark} onShowWatchlist={() => setShowWatchlist(true)} watchlistCount={watchlist.length} />

      <div className="main">
        {showWatchlist ? (
          <WatchlistTab
            watchlist={watchlist}
            onSelect={handleSearch}
            onRemove={removeFromWatchlist}
            onBack={() => setShowWatchlist(false)}
          />
        ) : (<>
        <Watchlist watchlist={watchlist} onSelect={handleSearch} onRemove={removeFromWatchlist} />

        {loading && (
          <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
            <div className="spinner" />
            <p style={{ color: "#4f46e5", fontWeight: 700, fontSize: 15 }}>Analyse de {symbol} en cours...</p>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>Connexion à Yahoo Finance</p>
          </div>
        )}

        {!loading && error && (
          <div className="card" style={{ textAlign: "center", padding: "52px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>!</div>
            <p style={{ color: "#ef4444", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{error}</p>
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Exemples : AAPL · MC.PA · TSLA · BNP.PA · 7203.T · NESN.SW</p>
          </div>
        )}

        {!loading && !error && !data && (
          <div className="card" style={{ textAlign: "center", padding: "64px 24px" }}>
            <div style={{ fontSize: 64, marginBottom: 18 }}>
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                <circle cx="40" cy="40" r="38" stroke="#4f46e5" strokeWidth="2" opacity=".2" />
                <path d="M20 50 L32 38 L42 46 L60 25" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="60" cy="25" r="4" fill="#4f46e5" />
              </svg>
            </div>
            <h2 style={{ color: "var(--text)", fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
              Analysez n'importe quelle action mondiale
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 15, lineHeight: 1.7 }}>
              Cours en temps réel · Ratios financiers · Bilan · Compte de résultats · Trésorerie · Comparaison
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 24, flexWrap: "wrap" }}>
              {[
                { icon: "📊", title: "30+ ratios", desc: "P/E, ROE, marges..." },
                { icon: "📈", title: "Graphiques", desc: "Cours & états financiers" },
                { icon: "⚖️", title: "Comparer", desc: "2 actions côte à côte" },
                { icon: "★", title: "Favoris", desc: "Sauvegardez vos actions" },
              ].map(f => (
                <div key={f.title} style={{ textAlign: "center", minWidth: 100 }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{f.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{f.desc}</div>
                </div>
              ))}
            </div>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 24 }}>
              Tapez un symbole ou cliquez sur une suggestion pour commencer
            </p>
          </div>
        )}

        {!loading && !error && data && (
          <ErrorBoundary>
            <StockHeader
              data={data}
              symbol={symbol}
              isInWatchlist={isInWatchlist}
              onToggleWatchlist={handleToggleWatchlist}
            />

            <MetricCards data={data} />
            <ScoreCard data={data} />

            <CandlestickChart symbol={symbol} dark={dark} currency={data?.price?.currency} />

            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="tab-bar">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    className={`tab-btn${activeTab === t.id ? " active" : ""}`}
                    onClick={() => setActiveTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div style={{ padding: 24 }}>
                {activeTab === "ratios" && <RatiosTab data={data} />}
                {activeTab === "bilan" && <BilanTab data={data} />}
                {activeTab === "resultats" && <ResultatsTab data={data} />}
                {activeTab === "tresorerie" && <TresorerieTab data={data} />}
                {activeTab === "compare" && <CompareMode currentSymbol={symbol} currentData={data} />}
              </div>
            </div>

            <div className="footer">
              Données Yahoo Finance · Usage éducatif uniquement · Pas un conseil en investissement<br />
              <strong style={{ color: "#4f46e5" }}>Foucauld Finance</strong>
            </div>
          </ErrorBoundary>
        )}
        </>)}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, Component, lazy, Suspense } from "react";
import Header from "./components/Header";
import StockHeader from "./components/StockHeader";
import AuthModal from "./components/AuthModal";
const KeyMetricsCharts = lazy(() => import("./components/KeyMetricsCharts"));
const RevenueBreakdown = lazy(() => import("./components/RevenueBreakdown"));

// Lazy-loaded components (code splitting)
const CandlestickChart = lazy(() => import("./components/CandlestickChart"));
const CompareMode = lazy(() => import("./components/CompareMode"));
const EarningsTab = lazy(() => import("./components/EarningsTab"));
const InvestorsTab = lazy(() => import("./components/InvestorsTab"));
const Watchlist = lazy(() => import("./components/Watchlist"));
const WatchlistTab = lazy(() => import("./components/WatchlistTab"));
const BilanTab = lazy(() => import("./components/FinancialTabs").then(m => ({ default: m.BilanTab })));
const ResultatsTab = lazy(() => import("./components/FinancialTabs").then(m => ({ default: m.ResultatsTab })));
const TresorerieTab = lazy(() => import("./components/FinancialTabs").then(m => ({ default: m.TresorerieTab })));
const MentionsLegales = lazy(() => import("./components/LegalPages").then(m => ({ default: m.MentionsLegales })));
const PolitiqueConfidentialite = lazy(() => import("./components/LegalPages").then(m => ({ default: m.PolitiqueConfidentialite })));
const CGU = lazy(() => import("./components/LegalPages").then(m => ({ default: m.CGU })));
const CGV = lazy(() => import("./components/LegalPages").then(m => ({ default: m.CGV })));
import { useWatchlist } from "./hooks/useWatchlist";
import { useAlerts } from "./hooks/useAlerts";
import { useDarkMode } from "./hooks/useDarkMode";
import { fetchStockData, classifyError, checkWorkerHealth } from "./utils/api";
import { getCurrentUser, logoutUser } from "./utils/auth";

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
  { id: "bilan", label: "Bilan" },
  { id: "resultats", label: "Résultats" },
  { id: "tresorerie", label: "Trésorerie" },
  { id: "publications", label: "Publications" },
  { id: "compare", label: "Comparer" },
];

function getInitialSymbol() {
  const params = new URLSearchParams(window.location.search);
  return params.get("s")?.toUpperCase() || null;
}

export default function FoucauldFinance() {
  const [symbol, setSymbol] = useState(getInitialSymbol);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [activeTab, setActiveTab] = useState("bilan");
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [showInvestors, setShowInvestors] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState(() => getCurrentUser());
  const [legalPage, setLegalPage] = useState(null); // "mentions" | "confidentialite" | "cgu" | "cgv"
  const [workerDown, setWorkerDown] = useState(false);

  const handleLogout = () => {
    logoutUser();
    setUser(null);
  };

  const [dark, toggleDark] = useDarkMode();
  const { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();
  const { toggleAlert, getAlerts, triggered, dismissTriggered, maData, checking } = useAlerts(watchlist);
  const [toasts, setToasts] = useState([]);

  // Toast notifications quand de nouvelles alertes sont déclenchées
  const triggeredCountRef = useRef(0);
  useEffect(() => {
    if (triggered.length > triggeredCountRef.current) {
      const newOnes = triggered.slice(0, triggered.length - triggeredCountRef.current);
      const newToasts = newOnes.map(t => ({
        id: Date.now() + Math.random(),
        symbol: t.symbol,
        ma: t.ma,
        direction: t.direction,
        price: t.price,
        maValue: t.maValue,
      }));
      setToasts(prev => [...newToasts, ...prev]);
      // Auto-dismiss après 8s
      newToasts.forEach(toast => {
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toast.id)), 8000);
      });
    }
    triggeredCountRef.current = triggered.length;
  }, [triggered]);

  // ── Dynamic page title ──
  useEffect(() => {
    if (!data || !symbol) {
      document.title = "Foucauld Finance";
      return;
    }
    const pr = data.price;
    const price = pr?.regularMarketPrice?.raw;
    const name = pr?.shortName || symbol;
    const currency = pr?.currencySymbol || pr?.currency || "";
    document.title = price != null
      ? `${symbol} — ${price.toFixed(2)} ${currency} | Foucauld Finance`
      : `${name} | Foucauld Finance`;
  }, [data, symbol]);

  const doFetchStock = async (sym, { silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError(null);
      setData(null);
      setFetchedAt(null);
    }
    try {
      const result = await fetchStockData(sym);
      setData(result.data);
      setFetchedAt(result.fetchedAt);
      if (silent) setError(null);
    } catch (e) {
      if (!silent) setError(classifyError(e));
      // Silent refresh: keep existing data, ignore error
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // ── Deep linking: sync URL ↔ symbol ──
  useEffect(() => {
    if (symbol) {
      const url = new URL(window.location);
      url.searchParams.set("s", symbol);
      window.history.replaceState(null, "", url);
    }
  }, [symbol]);

  // Load from URL on first mount
  useEffect(() => {
    const init = getInitialSymbol();
    if (init) doFetchStock(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const onPop = () => {
      const sym = new URLSearchParams(window.location.search).get("s")?.toUpperCase();
      if (sym && sym !== symbol) { setSymbol(sym); doFetchStock(sym); }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // ── Auto-refresh every 5 min when tab is visible ──
  useEffect(() => {
    if (!symbol) return;
    const REFRESH_INTERVAL = 5 * 60 * 1000;
    let id;
    const schedule = () => {
      id = setInterval(() => {
        if (document.visibilityState === "visible") doFetchStock(symbol, { silent: true });
      }, REFRESH_INTERVAL);
    };
    schedule();
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // ── Worker health check (on mount + every 3 min) ──
  useEffect(() => {
    const check = () => checkWorkerHealth().then(ok => setWorkerDown(!ok));
    check();
    const id = setInterval(check, 3 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // ── Search history (localStorage, last 10) ──
  const HISTORY_KEY = "ff_search_history";
  const getSearchHistory = () => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
  };
  const addToHistory = (sym) => {
    const history = getSearchHistory().filter(s => s !== sym);
    history.unshift(sym);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
  };

  const handleSearch = (sym) => {
    setSymbol(sym);
    setActiveTab("bilan");
    setShowWatchlist(false);
    setShowInvestors(false);
    addToHistory(sym);
    // Push state for back/forward navigation
    const url = new URL(window.location);
    url.searchParams.set("s", sym);
    window.history.pushState(null, "", url);
    doFetchStock(sym);
  };

  const handleToggleWatchlist = (sym, name) => {
    if (isInWatchlist(sym)) removeFromWatchlist(sym);
    else addToWatchlist(sym, name);
  };

  return (
    <div className={`app ${dark ? "dark" : "light"}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}

        :root {
          --bg: #f8f9fb;
          --card: #ffffff;
          --text: #111827;
          --text-secondary: #4b5563;
          --muted: #9ca3af;
          --border: #e5e7eb;
          --highlight-row: #f9fafb;
          --input-bg: rgba(255,255,255,.12);
          --shadow: rgba(0,0,0,.04);
          --accent: #2563eb;
          --accent-light: #dbeafe;
          --accent-dark: #1d4ed8;
        }

        .dark {
          --bg: #0b0f1a;
          --card: #141b2d;
          --text: #f1f5f9;
          --text-secondary: #cbd5e1;
          --muted: #64748b;
          --border: #1e293b;
          --highlight-row: #1a2332;
          --shadow: rgba(0,0,0,.35);
          --accent: #3b82f6;
          --accent-light: #1e3a5f;
          --accent-dark: #60a5fa;
        }

        .app {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          transition: background .3s, color .3s;
          -webkit-font-smoothing: antialiased;
        }

        .hero {
          background: linear-gradient(160deg, #0f172a 0%, #1e293b 40%, #1e3a5f 100%);
          padding: 24px 20px 68px;
          position: relative;
          overflow: hidden;
        }
        .hero::before {
          content: '';
          position: absolute;
          top: -120px; right: -120px;
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(59,130,246,.08) 0%, transparent 70%);
          border-radius: 50%;
        }
        .hero::after {
          content: '';
          position: absolute;
          bottom: -140px; left: -80px;
          width: 380px; height: 380px;
          background: radial-gradient(circle, rgba(59,130,246,.05) 0%, transparent 70%);
          border-radius: 50%;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .logo-icon {
          width: 38px; height: 38px;
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
        .logo-text {
          color: white;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -.3px;
        }

        .dark-toggle {
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 10px;
          width: 38px; height: 38px;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background .2s;
        }
        .dark-toggle:hover {
          background: rgba(255,255,255,.15);
        }

        .search-wrap {
          display: flex;
          gap: 10px;
          max-width: 680px;
          position: relative;
          z-index: 1;
        }
        .ff-input {
          flex: 1;
          padding: 13px 20px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.06);
          backdrop-filter: blur(12px);
          color: white;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 500;
          outline: none;
          transition: border .2s, background .2s;
        }
        .ff-input::placeholder { color: rgba(255,255,255,.4) }
        .ff-input:focus {
          border-color: rgba(59,130,246,.5);
          background: rgba(255,255,255,.1);
        }
        .ff-btn {
          padding: 13px 24px;
          background: var(--accent, #2563eb);
          color: white;
          border: none;
          border-radius: 12px;
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: transform .15s, background .15s;
          white-space: nowrap;
        }
        .ff-btn:hover {
          transform: translateY(-1px);
          background: var(--accent-dark, #1d4ed8);
        }

        .autocomplete-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 100px;
          background: var(--card);
          border-radius: 14px;
          margin-top: 6px;
          box-shadow: 0 12px 40px rgba(0,0,0,.15);
          border: 1px solid var(--border);
          overflow: hidden;
          z-index: 100;
        }
        .history-label {
          padding: 8px 16px 4px;
          font-size: 11px;
          color: var(--muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .autocomplete-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 11px 16px;
          border: none;
          background: none;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: var(--text);
          transition: background .15s;
          text-align: left;
        }
        .autocomplete-item:hover {
          background: var(--highlight-row);
        }
        .ac-symbol {
          font-weight: 800;
          color: var(--accent);
          min-width: 65px;
          font-size: 13px;
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
          gap: 6px;
          margin-top: 14px;
          position: relative;
          z-index: 1;
        }
        .chip {
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.12);
          color: rgba(255,255,255,.7);
          padding: 5px 13px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: all .2s;
        }
        .chip:hover { background: rgba(255,255,255,.12); color: white }

        .main {
          max-width: 980px;
          margin: -34px auto 0;
          padding: 0 16px 52px;
          position: relative;
        }

        .card {
          background: var(--card);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 1px 3px var(--shadow), 0 0 0 1px rgba(0,0,0,.03);
          margin-bottom: 16px;
          transition: background .3s;
          border: 1px solid var(--border);
        }
        .dark .card { border-color: transparent }

        .grid8 {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .metric-card {
          background: var(--card);
          border-radius: 14px;
          padding: 16px 14px;
          box-shadow: 0 1px 3px var(--shadow);
          border: 1px solid var(--border);
          border-top: 3px solid;
          transition: transform .15s, box-shadow .15s;
        }
        .dark .metric-card { border-color: transparent; border-top: 3px solid }
        .metric-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px var(--shadow) }
        .metric-value {
          font-size: 18px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -.3px;
        }
        .metric-label {
          font-size: 11px;
          color: var(--muted);
          font-weight: 600;
          margin-top: 4px;
          letter-spacing: .01em;
        }

        .stock-name {
          font-size: 22px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -.3px;
        }
        .badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
        }
        .badge-primary { background: var(--accent-light, #dbeafe); color: var(--accent) }
        .badge-green { background: #ecfdf5; color: #059669 }
        .badge-orange { background: #fffbeb; color: #d97706 }
        .dark .badge-primary { background: #1e3a5f; color: #93c5fd }
        .dark .badge-green { background: #064e3b; color: #6ee7b7 }
        .dark .badge-orange { background: #78350f; color: #fcd34d }

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
          color: var(--accent);
          font-size: 12px;
          text-decoration: none;
          font-weight: 600;
        }
        .stock-link:hover { text-decoration: underline }
        .stock-price {
          font-size: 36px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -1px;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .stock-currency {
          font-size: 14px;
          font-weight: 600;
          color: var(--muted);
          margin-left: 6px;
        }
        .price-change {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          margin-top: 8px;
          padding: 5px 12px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 13px;
          font-variant-numeric: tabular-nums;
        }
        .price-change.up { background: #ecfdf5; color: #059669 }
        .price-change.down { background: #fef2f2; color: #dc2626 }
        .dark .price-change.up { background: #064e3b; color: #6ee7b7 }
        .dark .price-change.down { background: #7f1d1d; color: #fca5a5 }
        .stock-volume {
          font-size: 12px;
          color: var(--muted);
          margin-top: 8px;
          font-variant-numeric: tabular-nums;
        }
        .stock-time {
          font-size: 11px;
          color: var(--muted);
          margin-top: 4px;
        }
        .worker-banner {
          background: #fef3c7;
          color: #92400e;
          text-align: center;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 500;
          border-bottom: 1px solid #fcd34d;
        }
        [data-theme="dark"] .worker-banner {
          background: #78350f;
          color: #fde68a;
          border-bottom-color: #92400e;
        }
        .stock-fetched-at {
          font-size: 10px;
          color: var(--muted);
          margin-top: 4px;
          opacity: 0.75;
          font-style: italic;
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
        .watchlist-btn:hover { transform: scale(1.15) }

        .watchlist-card { margin-bottom: 16px }
        .watchlist-item {
          display: flex;
          align-items: center;
          background: var(--highlight-row);
          border-radius: 10px;
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
          font-family: 'Inter', sans-serif;
          color: var(--text);
        }
        .wl-symbol { font-weight: 800; color: var(--accent); font-size: 13px }
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
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 10px;
          width: 38px; height: 38px;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f59e0b;
          transition: background .2s;
          position: relative;
        }
        .watchlist-header-btn:hover { background: rgba(255,255,255,.15) }
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
          font-family: 'Inter', sans-serif;
        }

        /* Auth header */
        .auth-header-group {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: 4px;
        }
        .auth-header-name {
          font-size: 13px;
          font-weight: 700;
          color: white;
          font-family: 'Inter', sans-serif;
        }
        .auth-header-btn {
          background: rgba(79, 70, 229, .85);
          border: 1px solid rgba(255,255,255,.15);
          border-radius: 10px;
          padding: 7px 16px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          color: white;
          font-family: 'Inter', sans-serif;
          transition: background .2s;
          white-space: nowrap;
        }
        .auth-header-btn:hover { background: rgba(79, 70, 229, 1) }
        .auth-logout-btn {
          background: rgba(239, 68, 68, .2);
          border-color: rgba(239, 68, 68, .3);
          color: #fca5a5;
          font-size: 12px;
          padding: 5px 12px;
        }
        .auth-logout-btn:hover { background: rgba(239, 68, 68, .4) }

        /* Auth modal */
        .auth-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .auth-modal {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 36px 32px 28px;
          width: 100%;
          max-width: 400px;
          position: relative;
          box-shadow: 0 25px 60px rgba(0,0,0,.4);
        }
        .auth-close {
          position: absolute;
          top: 14px; right: 16px;
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: var(--muted);
          line-height: 1;
        }
        .auth-close:hover { color: var(--text) }
        .auth-tabs {
          display: flex;
          gap: 0;
          margin-bottom: 24px;
          border-bottom: 2px solid var(--border);
        }
        .auth-tab {
          flex: 1;
          background: none;
          border: none;
          padding: 10px 0;
          font-size: 15px;
          font-weight: 700;
          color: var(--muted);
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          transition: color .2s, border-color .2s;
        }
        .auth-tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }
        .auth-form { display: flex; flex-direction: column; gap: 16px }
        .auth-field label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: var(--muted);
          margin-bottom: 6px;
          font-family: 'Inter', sans-serif;
        }
        .auth-field input {
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--highlight-row);
          color: var(--text);
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color .2s;
          box-sizing: border-box;
        }
        .auth-field input:focus { border-color: var(--accent) }
        .auth-error {
          background: rgba(239, 68, 68, .1);
          border: 1px solid rgba(239, 68, 68, .3);
          color: #ef4444;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
        }
        .auth-submit {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 12px;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: opacity .2s;
          margin-top: 4px;
        }
        .auth-submit:hover { opacity: .9 }
        .auth-submit:disabled { opacity: .5; cursor: not-allowed }
        .auth-switch {
          text-align: center;
          margin-top: 18px;
          font-size: 13px;
          color: var(--muted);
          font-family: 'Inter', sans-serif;
        }
        .auth-switch button {
          background: none;
          border: none;
          color: var(--accent);
          font-weight: 700;
          cursor: pointer;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
        }
        .auth-switch button:hover { text-decoration: underline }

        .wl-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
        }
        .wl-card {
          background: var(--card);
          border-radius: 14px;
          border: 1px solid var(--border);
          position: relative;
          transition: transform .15s, box-shadow .15s;
          overflow: hidden;
        }
        .dark .wl-card { border-color: transparent }
        .wl-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px var(--shadow) }
        .wl-card-body {
          display: block;
          width: 100%;
          padding: 18px 16px 14px;
          border: none;
          background: none;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
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
          font-size: 16px;
          font-weight: 700;
          width: 24px; height: 24px;
          border-radius: 6px;
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
        .wl-card-symbol { font-weight: 800; font-size: 15px; color: var(--accent) }
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
          font-size: 19px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -.3px;
          font-variant-numeric: tabular-nums;
        }
        .wl-card-change {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 7px;
          border-radius: 6px;
        }
        .wl-card-change.up { background: #ecfdf5; color: #059669 }
        .wl-card-change.down { background: #fef2f2; color: #dc2626 }
        .dark .wl-card-change.up { background: #064e3b; color: #6ee7b7 }
        .dark .wl-card-change.down { background: #7f1d1d; color: #fca5a5 }

        .section-title {
          font-size: 14px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -.2px;
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
          padding: 3px 8px;
          border-radius: 6px;
          display: inline-block;
        }
        .stag-good { background: #ecfdf5; color: #059669 }
        .stag-bad { background: #fef2f2; color: #dc2626 }
        .dark .stag-good { background: #064e3b; color: #6ee7b7 }
        .dark .stag-bad { background: #7f1d1d; color: #fca5a5 }

        .period-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 8px;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          font-weight: 700;
          color: var(--muted);
          transition: all .18s;
        }
        .period-btn:hover { background: var(--accent-light, #dbeafe); color: var(--accent) }
        .period-btn.active { background: var(--accent); color: white }
        .dark .period-btn:hover { background: #1e3a5f; color: #93c5fd }

        .measure-btn {
          background: none;
          border: 1px solid var(--border);
          cursor: pointer;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          font-family: 'Inter', sans-serif;
          color: var(--text-secondary);
          transition: all .2s;
          margin-right: 8px;
        }
        .measure-btn:hover { border-color: var(--accent); color: var(--accent) }
        .measure-btn.active {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }
        .measure-banner {
          background: var(--accent-light, #dbeafe);
          color: var(--accent);
          font-size: 12px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 8px;
          margin-bottom: 12px;
          text-align: center;
        }
        .dark .measure-banner { background: #1e3a5f; color: #93c5fd }
        .measure-result {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 14px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .measure-result.up { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0 }
        .measure-result.down { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca }
        .dark .measure-result.up { background: #064e3b; color: #6ee7b7; border-color: #065f46 }
        .dark .measure-result.down { background: #7f1d1d; color: #fca5a5; border-color: #991b1b }
        .measure-label { font-weight: 600; font-size: 13px }
        .measure-diff { font-weight: 800; font-size: 17px }
        .measure-pct { font-weight: 700; font-size: 15px }
        .measure-clear {
          background: none; border: none; cursor: pointer;
          font-size: 18px; font-weight: 700; color: inherit;
          opacity: .6; margin-left: auto; padding: 2px 8px; border-radius: 6px;
        }
        .measure-clear:hover { opacity: 1; background: rgba(0,0,0,.08) }

        .tab-bar {
          border-bottom: 1px solid var(--border);
          display: flex;
          overflow-x: auto;
          background: var(--highlight-row);
        }
        .tab-btn {
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          padding: 13px 18px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: var(--muted);
          transition: all .18s;
          white-space: nowrap;
        }
        .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); background: var(--card) }
        .tab-btn:hover { color: var(--accent) }

        .ff-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .ff-table th {
          background: var(--highlight-row);
          text-align: left;
          padding: 9px 14px;
          color: var(--muted);
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .5px;
          border-bottom: 1px solid var(--border);
        }
        .ff-table th:not(:first-child) { text-align: right }
        .ff-table td {
          padding: 10px 14px;
          border-bottom: 1px solid var(--border);
        }
        .ff-table td:not(:first-child) { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums }
        .ff-table tr:hover td { background: var(--highlight-row) }
        .ff-table tr:last-child td { border-bottom: none }

        .ratio-cat {
          font-size: 11px;
          font-weight: 800;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: .8px;
          margin-bottom: 8px;
          margin-top: 4px;
        }
        .ratio-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 10px 4px;
          border-bottom: 1px solid var(--border);
        }
        .ratio-row:last-child { border-bottom: none }
        .ratio-label { font-weight: 600; font-size: 13px; color: var(--text-secondary) }
        .ratio-hint { font-size: 11px; color: var(--muted) }
        .ratio-value { font-size: 14px; font-weight: 800; color: var(--accent); font-variant-numeric: tabular-nums }
        .ratio-value.muted { color: var(--muted) }

        .chart-label {
          font-size: 11px;
          color: var(--muted);
          font-weight: 700;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: .5px;
        }

        .compare-input {
          flex: 1;
          padding: 10px 16px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 500;
          outline: none;
          transition: border .2s;
        }
        .compare-input:focus { border-color: var(--accent) }
        .compare-btn {
          padding: 10px 20px;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: 10px;
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: background .2s;
        }
        .compare-btn:hover { background: var(--accent-dark) }
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

        /* Investors Tab */
        .investor-card {
          background: var(--card);
          border-radius: 14px;
          margin-bottom: 10px;
          box-shadow: 0 1px 3px var(--shadow);
          border: 1px solid var(--border);
          border-left: 4px solid;
          overflow: hidden;
          transition: box-shadow .2s;
        }
        .dark .investor-card { border-color: transparent; border-left: 4px solid }
        .investor-card:hover { box-shadow: 0 4px 16px var(--shadow) }
        .investor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 16px 18px;
          border: none;
          background: none;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          color: var(--text);
          gap: 12px;
        }
        .investor-emoji {
          font-size: 28px;
          min-width: 38px;
          text-align: center;
        }
        .investor-name {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.2px;
        }
        .investor-fund {
          font-size: 12px;
          color: var(--muted);
          font-weight: 600;
        }
        .investor-aum {
          font-size: 15px;
          font-weight: 800;
          color: var(--accent);
          font-variant-numeric: tabular-nums;
        }
        .investor-style {
          font-size: 11px;
          color: var(--muted);
          font-weight: 600;
        }
        .investor-chevron {
          font-size: 11px;
          color: var(--muted);
          font-weight: 700;
          transition: transform .2s;
        }
        .investor-detail {
          padding: 0 18px 18px;
          border-top: 1px solid var(--border);
        }
        .investor-desc {
          color: var(--text-secondary);
          font-size: 13px;
          font-style: italic;
          padding: 14px 0;
          line-height: 1.6;
        }
        .investor-table th { font-size: 11px !important }
        .investor-table td { font-size: 13px; vertical-align: middle }
        .investor-footer {
          text-align: center;
          color: var(--muted);
          font-size: 11px;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }
        .activity-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 6px;
          white-space: nowrap;
        }
        .activity-badge.new { background: var(--accent-light, #dbeafe); color: var(--accent) }
        .activity-badge.increased { background: #ecfdf5; color: #059669 }
        .activity-badge.reduced { background: #fffbeb; color: #d97706 }
        .dark .activity-badge.new { background: #1e3a5f; color: #93c5fd }
        .dark .activity-badge.increased { background: #064e3b; color: #6ee7b7 }
        .dark .activity-badge.reduced { background: #78350f; color: #fcd34d }

        .investor-activity {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 6px;
          white-space: nowrap;
        }
        .investor-activity.new { background: var(--accent-light, #dbeafe); color: var(--accent) }
        .investor-activity.increased { background: #ecfdf5; color: #059669 }
        .investor-activity.reduced { background: #fffbeb; color: #d97706 }
        .investor-activity.sold { background: #fef2f2; color: #dc2626 }
        .investor-activity.held { background: var(--highlight-row); color: var(--muted) }
        .dark .investor-activity.new { background: #1e3a5f; color: #93c5fd }
        .dark .investor-activity.increased { background: #064e3b; color: #6ee7b7 }
        .dark .investor-activity.reduced { background: #78350f; color: #fcd34d }
        .dark .investor-activity.sold { background: #7f1d1d; color: #fca5a5 }

        .investor-filter {
          background: none;
          border: 1px solid var(--border);
          padding: 5px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          color: var(--muted);
          transition: all .18s;
          white-space: nowrap;
        }
        .investor-filter:hover { border-color: var(--accent); color: var(--accent) }
        .investor-filter.active {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }

        .investor-moves-banner {
          background: var(--card);
          border-radius: 14px;
          padding: 16px 18px;
          margin-bottom: 16px;
          border: 1px solid var(--border);
          box-shadow: 0 1px 3px var(--shadow);
        }
        .dark .investor-moves-banner { border-color: transparent }
        .investor-moves-title {
          font-size: 13px;
          font-weight: 800;
          color: var(--text);
          margin-bottom: 12px;
        }
        .investor-moves-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 8px;
        }
        .investor-move-chip {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--highlight-row);
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: all .15s;
          text-align: left;
          color: var(--text);
        }
        .investor-move-chip:hover {
          border-color: var(--accent);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px var(--shadow);
        }
        .move-tag {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 5px;
          display: inline-block;
          width: fit-content;
        }
        .move-tag.new { background: var(--accent-light, #dbeafe); color: var(--accent) }
        .move-tag.increased { background: #ecfdf5; color: #059669 }
        .dark .move-tag.new { background: #1e3a5f; color: #93c5fd }
        .dark .move-tag.increased { background: #064e3b; color: #6ee7b7 }

        @media (max-width: 640px) {
          .investor-header { flex-direction: column; align-items: flex-start }
          .investor-moves-grid { grid-template-columns: 1fr 1fr }
          .investor-table { font-size: 12px }
        }

        .spinner {
          width: 36px; height: 36px;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin .7s linear infinite;
          margin: 0 auto 14px;
        }
        @keyframes spin { to { transform: rotate(360deg) } }

        .footer {
          text-align: center;
          color: var(--muted);
          font-size: 11px;
          padding: 20px 0 4px;
          line-height: 1.8;
        }

        /* ── Alertes MA ── */
        .wl-card-alerts {
          display: flex;
          gap: 6px;
          padding: 8px 12px 10px;
          border-top: 1px solid var(--border);
        }
        .alert-toggle {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 8px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--card);
          color: var(--muted);
          font-size: 11px;
          font-family: inherit;
          cursor: pointer;
          transition: all .2s;
        }
        .alert-toggle:hover { border-color: var(--accent); color: var(--text) }
        .alert-toggle.active {
          background: #fef3c7;
          border-color: #f59e0b;
          color: #92400e;
        }
        .dark .alert-toggle.active {
          background: #451a03;
          border-color: #d97706;
          color: #fbbf24;
        }
        .alert-toggle-bell { font-size: 12px }
        .alert-toggle-label { font-weight: 700 }
        .alert-toggle-dist {
          margin-left: auto;
          font-size: 10px;
          font-weight: 600;
          opacity: .7;
        }
        .alert-toggle-dist.near {
          color: #f59e0b;
          opacity: 1;
          font-weight: 800;
        }

        /* Triggered alerts banner */
        .triggered-alerts {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          margin-bottom: 16px;
          overflow: hidden;
        }
        .triggered-header {
          padding: 10px 16px;
          font-weight: 800;
          font-size: 14px;
          color: var(--text);
          border-bottom: 1px solid var(--border);
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        }
        .dark .triggered-header {
          background: linear-gradient(135deg, #451a03 0%, #78350f 100%);
        }
        .triggered-item {
          display: flex;
          align-items: center;
          border-bottom: 1px solid var(--border);
        }
        .triggered-item:last-child { border-bottom: none }
        .triggered-item.above { border-left: 3px solid #10b981 }
        .triggered-item.below { border-left: 3px solid #ef4444 }
        .triggered-body {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          color: var(--text);
        }
        .triggered-body:hover { background: var(--highlight-row) }
        .triggered-symbol { font-weight: 800; font-size: 14px; min-width: 60px }
        .triggered-detail { font-size: 12px; color: var(--text-secondary); flex: 1 }
        .triggered-arrow { font-size: 18px; font-weight: 700 }
        .triggered-item.above .triggered-arrow { color: #10b981 }
        .triggered-item.below .triggered-arrow { color: #ef4444 }
        .triggered-dismiss {
          background: none;
          border: none;
          color: var(--muted);
          font-size: 18px;
          cursor: pointer;
          padding: 10px 14px;
          font-family: inherit;
        }
        .triggered-dismiss:hover { color: var(--text) }

        /* Toast notifications */
        .toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 380px;
        }
        .toast-alert {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px 16px;
          border-radius: 12px;
          background: var(--card);
          border: 1px solid var(--border);
          box-shadow: 0 8px 24px rgba(0,0,0,.15);
          animation: toastIn .3s ease-out;
          font-size: 13px;
          color: var(--text);
        }
        .toast-alert.above { border-left: 4px solid #10b981 }
        .toast-alert.below { border-left: 4px solid #ef4444 }
        .toast-icon { font-size: 20px }
        .toast-content { flex: 1; line-height: 1.5 }
        .toast-content strong { font-weight: 800 }
        .toast-detail { font-size: 11px; color: var(--muted); margin-top: 2px }
        .toast-close {
          background: none;
          border: none;
          color: var(--muted);
          font-size: 16px;
          cursor: pointer;
          padding: 0 2px;
          font-family: inherit;
        }
        .toast-close:hover { color: var(--text) }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(40px) }
          to { opacity: 1; transform: translateX(0) }
        }

        /* ── Earnings / Publications ── */
        .earnings-est-card {
          background: var(--highlight-row);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 14px;
        }
        .earnings-est-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: .3px;
          margin-bottom: 4px;
        }
        .earnings-est-value {
          font-size: 18px;
          font-weight: 800;
          color: var(--text);
          font-variant-numeric: tabular-nums;
        }
        .earnings-est-range {
          font-size: 11px;
          color: var(--muted);
          margin-top: 4px;
        }
        .press-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .press-item {
          background: var(--highlight-row);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 16px;
          transition: border-color .2s;
        }
        .press-item:hover { border-color: var(--accent) }
        .press-date {
          font-size: 11px;
          font-weight: 700;
          color: var(--muted);
          margin-bottom: 4px;
        }
        .press-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--text);
          line-height: 1.4;
        }
        .press-text {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-top: 6px;
        }
        .filing-type {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          background: var(--border);
          color: var(--text-secondary);
        }
        .filing-type.important {
          background: var(--accent-light);
          color: var(--accent);
        }
        .filing-link {
          font-size: 12px;
          color: var(--accent);
          font-weight: 600;
          text-decoration: none;
          margin-top: 6px;
          display: inline-block;
        }
        .filing-link:hover { text-decoration: underline }

        /* ── Legal pages ── */
        .legal-page {
          max-width: 720px;
          margin: 0 auto;
          padding: 8px 0 40px;
        }
        .legal-page h1 {
          font-size: 24px;
          font-weight: 900;
          color: var(--text);
          letter-spacing: -.5px;
          margin-bottom: 24px;
        }
        .legal-page h2 {
          font-size: 16px;
          font-weight: 800;
          color: var(--text);
          margin-bottom: 10px;
          margin-top: 0;
        }
        .legal-page section {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px 24px;
          margin-bottom: 12px;
        }
        .dark .legal-page section { border-color: transparent }
        .legal-page p {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.7;
          margin-bottom: 8px;
        }
        .legal-page p:last-child { margin-bottom: 0 }
        .legal-page ul {
          padding-left: 20px;
          margin: 8px 0;
        }
        .legal-page li {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.7;
          margin-bottom: 4px;
        }
        .legal-updated {
          font-size: 12px !important;
          color: var(--muted) !important;
          font-style: italic;
          margin-bottom: 20px !important;
        }
        .legal-back {
          background: none;
          border: none;
          color: var(--accent);
          cursor: pointer;
          font-weight: 700;
          font-size: 14px;
          margin-bottom: 16px;
          font-family: 'Inter', sans-serif;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0;
        }
        .legal-back:hover { text-decoration: underline }

        /* Footer links */
        .footer-links {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px 20px;
          margin-top: 8px;
        }
        .footer-link {
          background: none;
          border: none;
          color: var(--muted);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          padding: 0;
          transition: color .2s;
        }
        .footer-link:hover { color: var(--accent); text-decoration: underline }

        @media (max-width: 640px) {
          .grid8 { grid-template-columns: repeat(2, 1fr) }
          .search-wrap { flex-direction: column }
          .ff-btn { padding: 12px 20px }
          .stock-price { font-size: 28px }
          .main { padding: 0 10px 40px }
          .toast-container { left: 10px; right: 10px; max-width: none }
          .legal-page section { padding: 16px 18px }
        }
      `}</style>

      <Header onSearch={handleSearch} dark={dark} toggleDark={toggleDark} onShowWatchlist={() => setShowWatchlist(true)} watchlistCount={watchlist.length} onShowInvestors={() => { setShowInvestors(true); setShowWatchlist(false); }} user={user} onShowAuth={() => setShowAuth(true)} onLogout={handleLogout} searchHistory={getSearchHistory()} />

      {workerDown && (
        <div className="worker-banner">
          Service dégradé — le serveur proxy est temporairement indisponible. Les données peuvent être incomplètes.
        </div>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuth={(u) => setUser(u)} />}

      <div className="main">
        <Suspense fallback={<div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Chargement…</div>}>
        {legalPage === "mentions" ? (
          <MentionsLegales onBack={() => setLegalPage(null)} />
        ) : legalPage === "confidentialite" ? (
          <PolitiqueConfidentialite onBack={() => setLegalPage(null)} />
        ) : legalPage === "cgu" ? (
          <CGU onBack={() => setLegalPage(null)} />
        ) : legalPage === "cgv" ? (
          <CGV onBack={() => setLegalPage(null)} />
        ) : showInvestors ? (
          <div>
            <button onClick={() => setShowInvestors(false)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontWeight: 700, fontSize: 14, marginBottom: 16, fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
              ← Retour
            </button>
            <InvestorsTab onSymbolClick={handleSearch} />
          </div>
        ) : showWatchlist ? (
          <WatchlistTab
            watchlist={watchlist}
            onSelect={handleSearch}
            onRemove={removeFromWatchlist}
            onBack={() => setShowWatchlist(false)}
            alertState={getAlerts}
            onToggleAlert={toggleAlert}
            triggered={triggered}
            onDismissAlert={dismissTriggered}
            maData={maData}
            checking={checking}
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
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="28" r="26" stroke="#ef4444" strokeWidth="2" opacity=".3" />
                <path d="M28 18v12M28 36v2" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <p style={{ color: "#ef4444", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{error}</p>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>Vérifiez le symbole ou votre connexion.</p>
            {symbol && (
              <button
                className="ff-btn"
                onClick={() => doFetchStock(symbol)}
                style={{ fontSize: 14, padding: "10px 28px" }}
              >
                Réessayer
              </button>
            )}
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
              fetchedAt={fetchedAt}
              isInWatchlist={isInWatchlist}
              onToggleWatchlist={handleToggleWatchlist}
            />

            <KeyMetricsCharts data={data} />

            <RevenueBreakdown data={data} symbol={symbol} />


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
                {activeTab === "bilan" && <BilanTab data={data} symbol={symbol} />}
                {activeTab === "resultats" && <ResultatsTab data={data} symbol={symbol} />}
                {activeTab === "tresorerie" && <TresorerieTab data={data} symbol={symbol} />}
                {activeTab === "publications" && <EarningsTab data={data} symbol={symbol} />}
                {activeTab === "compare" && <CompareMode currentSymbol={symbol} currentData={data} />}
              </div>
            </div>

            <div className="footer">
              Données Yahoo Finance · Usage éducatif uniquement · Pas un conseil en investissement<br />
              <strong style={{ color: "#4f46e5" }}>Foucauld Finance</strong>
              <div className="footer-links">
                <button className="footer-link" onClick={() => setLegalPage("mentions")}>Mentions légales</button>
                <button className="footer-link" onClick={() => setLegalPage("confidentialite")}>Politique de confidentialité</button>
                <button className="footer-link" onClick={() => setLegalPage("cgu")}>CGU</button>
                <button className="footer-link" onClick={() => setLegalPage("cgv")}>CGV</button>
              </div>
            </div>
          </ErrorBoundary>
        )}
        </>)}

        {/* Footer global visible partout */}
        {!legalPage && !showInvestors && !showWatchlist && (!data || loading) && (
          <div className="footer" style={{ marginTop: 24 }}>
            <div className="footer-links">
              <button className="footer-link" onClick={() => setLegalPage("mentions")}>Mentions légales</button>
              <button className="footer-link" onClick={() => setLegalPage("confidentialite")}>Politique de confidentialité</button>
              <button className="footer-link" onClick={() => setLegalPage("cgu")}>CGU</button>
              <button className="footer-link" onClick={() => setLegalPage("cgv")}>CGV</button>
            </div>
          </div>
        )}
        </Suspense>
      </div>

      {/* Toast notifications pour alertes MA */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast-alert ${t.direction}`}>
              <div className="toast-icon">{t.direction === "above" ? "📈" : "📉"}</div>
              <div className="toast-content">
                <strong>{t.symbol}</strong> a croisé {t.direction === "above" ? "au-dessus" : "en dessous"} de {t.ma}
                <div className="toast-detail">Prix: {t.price.toFixed(2)} | {t.ma}: {t.maValue.toFixed(2)}</div>
              </div>
              <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useLayoutEffect, useRef, useCallback, Component, lazy, Suspense } from "react";
import Header from "./components/Header";
import StockHeader from "./components/StockHeader";
import AuthModal from "./components/AuthModal";
const KeyMetricsCharts = lazy(() => import("./components/KeyMetricsCharts"));
const RevenueBreakdown = lazy(() => import("./components/RevenueBreakdown"));
const DcfCalculator = lazy(() => import("./components/DcfCalculator"));

// Lazy-loaded components (code splitting)
const CandlestickChart = lazy(() => import("./components/CandlestickChart"));
const CompareMode = lazy(() => import("./components/CompareMode"));
const EarningsTab = lazy(() => import("./components/EarningsTab"));
const InvestorsTab = lazy(() => import("./components/InvestorsTab"));
const Watchlist = lazy(() => import("./components/Watchlist"));
const WatchlistTab = lazy(() => import("./components/WatchlistTab"));
const PortfolioTab = lazy(() => import("./components/PortfolioTab"));
const ScreenerView = lazy(() => import("./components/ScreenerView"));
const LandingPage = lazy(() => import("./components/LandingPage"));
const BilanTab = lazy(() => import("./components/FinancialTabs").then(m => ({ default: m.BilanTab })));
const ResultatsTab = lazy(() => import("./components/FinancialTabs").then(m => ({ default: m.ResultatsTab })));
const TresorerieTab = lazy(() => import("./components/FinancialTabs").then(m => ({ default: m.TresorerieTab })));
const MentionsLegales = lazy(() => import("./components/LegalPages").then(m => ({ default: m.MentionsLegales })));
const PolitiqueConfidentialite = lazy(() => import("./components/LegalPages").then(m => ({ default: m.PolitiqueConfidentialite })));
const CGU = lazy(() => import("./components/LegalPages").then(m => ({ default: m.CGU })));
const CGV = lazy(() => import("./components/LegalPages").then(m => ({ default: m.CGV })));
import { useWatchlist } from "./hooks/useWatchlist";
import { useAlerts } from "./hooks/useAlerts";
import { usePortfolio } from "./hooks/usePortfolio";
import { useDarkMode } from "./hooks/useDarkMode";
import "./App.css";
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

export default function Alphaview() {
  const [symbol, setSymbol] = useState(getInitialSymbol);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [activeTab, _setActiveTab] = useState("bilan");
  const tabPanelRef = useRef(null);
  const savedScrollRef = useRef(null);
  const switchTab = useCallback((tab) => {
    // Save scroll position and lock panel height before React re-renders
    savedScrollRef.current = window.scrollY;
    const panel = tabPanelRef.current;
    if (panel) {
      panel.style.minHeight = panel.offsetHeight + "px";
    }
    _setActiveTab(tab);
  }, []);

  // Restore scroll synchronously after DOM update, before browser paint
  useLayoutEffect(() => {
    if (savedScrollRef.current != null) {
      window.scrollTo(0, savedScrollRef.current);
      savedScrollRef.current = null;
    }
    // Release height lock after content is rendered
    const panel = tabPanelRef.current;
    if (panel) panel.style.minHeight = "";
  }, [activeTab]);
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [showInvestors, setShowInvestors] = useState(false);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [showScreener, setShowScreener] = useState(false);
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
  const { toggleAlert, getAlerts, triggered, dismissTriggered, maData, checking, priceAlerts, setPriceAlert, removePriceAlert } = useAlerts(watchlist);
  const { positions, addPosition, removePosition } = usePortfolio();
  const [toasts, setToasts] = useState([]);

  // Toast notifications quand de nouvelles alertes sont déclenchées
  const headerRef = useRef(null);
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

  // ── Dynamic page title + OG meta tags ──
  useEffect(() => {
    const setMeta = (prop, content) => {
      let el = document.querySelector(`meta[property="${prop}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute("property", prop); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    const setLink = (rel, href) => {
      let el = document.querySelector(`link[rel="${rel}"]`);
      if (!el) { el = document.createElement("link"); el.setAttribute("rel", rel); document.head.appendChild(el); }
      el.setAttribute("href", href);
    };
    const baseUrl = "https://thekow16.github.io/foucauld-finance";
    if (!data || !symbol) {
      document.title = "Alphaview";
      setMeta("og:title", "Alphaview — Analyse boursière");
      setMeta("og:url", baseUrl);
      setLink("canonical", baseUrl);
      return;
    }
    const pr = data.price;
    const price = pr?.regularMarketPrice?.raw;
    const name = pr?.shortName || symbol;
    const currency = pr?.currencySymbol || pr?.currency || "";
    const title = price != null
      ? `${symbol} — ${price.toFixed(2)} ${currency} | Alphaview`
      : `${name} | Alphaview`;
    const pageUrl = `${baseUrl}?s=${encodeURIComponent(symbol)}`;
    document.title = title;
    setMeta("og:title", title);
    setMeta("og:description", `Analyse financière de ${name} (${symbol}) — cours, ratios, bilan, résultats et trésorerie.`);
    setMeta("og:url", pageUrl);
    setLink("canonical", pageUrl);
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

  // ── Keyboard shortcuts: / → focus search, Esc → close modals ──
  useEffect(() => {
    const onKey = (e) => {
      // Ignore when typing in an input/textarea
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Escape") e.target.blur();
        return;
      }
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        headerRef.current?.focusSearch();
      }
      if (e.key === "Escape") {
        setShowWatchlist(false);
        setShowInvestors(false);
        setShowAuth(false);
        setLegalPage(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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
    _setActiveTab("bilan");
    setShowWatchlist(false);
    setShowInvestors(false);
    setShowPortfolio(false);
    setShowScreener(false);
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
      {/* CSS extracted to App.css */}
      <a href="#main-content" className="skip-link">Aller au contenu principal</a>

      <Header ref={headerRef} onSearch={handleSearch} dark={dark} toggleDark={toggleDark} onShowWatchlist={() => { setShowWatchlist(true); setShowPortfolio(false); setShowScreener(false); setShowInvestors(false); }} watchlistCount={watchlist.length} onShowInvestors={() => { setShowInvestors(true); setShowWatchlist(false); setShowPortfolio(false); setShowScreener(false); }} onShowPortfolio={() => { setShowPortfolio(true); setShowWatchlist(false); setShowInvestors(false); setShowScreener(false); }} onShowScreener={() => { setShowScreener(true); setShowWatchlist(false); setShowInvestors(false); setShowPortfolio(false); }} user={user} onShowAuth={() => setShowAuth(true)} onLogout={handleLogout} searchHistory={getSearchHistory()} portfolioCount={positions.length} />

      {workerDown && (
        <div className="worker-banner" role="alert">
          Service dégradé — le serveur proxy est temporairement indisponible. Les données peuvent être incomplètes.
        </div>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuth={(u) => setUser(u)} />}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="loading-status">
        {loading ? `Analyse de ${symbol} en cours` : ""}
      </div>

      <main className="main" id="main-content" role="main">
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
            priceAlerts={priceAlerts}
            onSetPriceAlert={setPriceAlert}
            onRemovePriceAlert={removePriceAlert}
          />
        ) : showPortfolio ? (
          <PortfolioTab
            positions={positions}
            onAdd={addPosition}
            onRemove={removePosition}
            onSelect={handleSearch}
            onBack={() => setShowPortfolio(false)}
          />
        ) : showScreener ? (
          <ScreenerView
            onSelect={handleSearch}
            onBack={() => setShowScreener(false)}
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
          <div className="card" role="alert" style={{ textAlign: "center", padding: "52px 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="28" r="26" stroke="#ef4444" strokeWidth="2" opacity=".3" />
                <path d="M28 18v12M28 36v2" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <p style={{ color: "#ef4444", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{error}</p>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
              {error.includes("hors ligne")
                ? "Reconnectez-vous à Internet puis réessayez."
                : error.includes("proxies")
                ? "Tous les serveurs sont surchargés. Réessayez dans 1-2 minutes."
                : error.includes("trop de temps")
                ? "Le serveur Yahoo Finance est lent. Réessayez dans quelques instants."
                : error.includes("Trop de recherches")
                ? "Limite anti-abus atteinte. Attendez quelques secondes avant de relancer."
                : error.includes("Trop de requêtes") || error.includes("Rate limit")
                ? "Le serveur est temporairement surchargé. Patientez 1 minute."
                : "Vérifiez le symbole ou votre connexion."}
            </p>
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
          <LandingPage onSearch={handleSearch} dark={dark} />
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


            <KeyMetricsCharts data={data} currency={data?.price?.currency || data?.summaryDetail?.currency || "USD"} />

            <RevenueBreakdown data={data} symbol={symbol} />



                                   <DcfCalculator data={data} symbol={symbol} currency={data?.price?.currency || data?.summaryDetail?.currency || "USD"} />
            <CandlestickChart symbol={symbol} dark={dark} currency={data?.price?.currency} />

            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="tab-bar" role="tablist" aria-label="Onglets financiers">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={activeTab === t.id}
                    aria-controls={`tabpanel-${t.id}`}
                    className={`tab-btn${activeTab === t.id ? " active" : ""}`}
                    onClick={() => switchTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div ref={tabPanelRef} role="tabpanel" id={`tabpanel-${activeTab}`} aria-label={TABS.find(t => t.id === activeTab)?.label} style={{ padding: 24, minHeight: 400 }}>
                <Suspense fallback={<div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Chargement…</div>}>
                  {activeTab === "bilan" && <BilanTab data={data} symbol={symbol} />}
                  {activeTab === "resultats" && <ResultatsTab data={data} symbol={symbol} />}
                  {activeTab === "tresorerie" && <TresorerieTab data={data} symbol={symbol} />}
                  {activeTab === "publications" && <EarningsTab data={data} symbol={symbol} />}
                  {activeTab === "compare" && <CompareMode currentSymbol={symbol} currentData={data} />}
                </Suspense>
              </div>
            </div>

            <footer className="footer" role="contentinfo">
              Données Yahoo Finance · Usage éducatif uniquement · Pas un conseil en investissement<br />
              <strong style={{ color: "#4f46e5" }}>Alphaview</strong>
              <div className="footer-links">
                <button className="footer-link" onClick={() => setLegalPage("mentions")}>Mentions légales</button>
                <button className="footer-link" onClick={() => setLegalPage("confidentialite")}>Politique de confidentialité</button>
                <button className="footer-link" onClick={() => setLegalPage("cgu")}>CGU</button>
                <button className="footer-link" onClick={() => setLegalPage("cgv")}>CGV</button>
              </div>
            </footer>
          </ErrorBoundary>
        )}
        </>)}

        {/* Footer global visible partout */}
        {!legalPage && !showInvestors && !showWatchlist && !showPortfolio && !showScreener && (!data || loading) && (
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
      </main>

      {/* Toast notifications pour alertes MA */}
      {toasts.length > 0 && (
        <div className="toast-container" role="status" aria-live="assertive">
          {toasts.map(t => (
            <div key={t.id} className={`toast-alert ${t.direction}`}>
              <div className="toast-icon">{t.direction === "above" ? "📈" : "📉"}</div>
              <div className="toast-content">
                <strong>{t.symbol}</strong> a croisé {t.direction === "above" ? "au-dessus" : "en dessous"} de {t.ma}
                <div className="toast-detail">Prix: {t.price.toFixed(2)} | {t.ma}: {t.maValue.toFixed(2)}</div>
              </div>
              <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} aria-label="Fermer la notification">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

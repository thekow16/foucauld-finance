import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { searchSymbols } from "../utils/api";

export default forwardRef(function Header({ onSearch, dark, toggleDark, onShowWatchlist, watchlistCount, onShowInvestors, onShowPortfolio, onShowScreener, onShowHeatmap, user, onShowAuth, onLogout, searchHistory = [], portfolioCount = 0 }, ref) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focusSearch() { inputRef.current?.focus(); },
  }));

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowSugg(false);
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (val) => {
    setQuery(val);
    setShowHistory(false);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSuggestions([]); setShowSugg(false); return; }
    debounceRef.current = setTimeout(async () => {
      const results = await searchSymbols(val.trim());
      setSuggestions(results);
      setShowSugg(results.length > 0);
    }, 300);
  };

  const handleFocus = () => {
    if (query.trim().length >= 2 && suggestions.length > 0) {
      setShowSugg(true);
    } else if (query.trim().length < 2 && searchHistory.length > 0) {
      setShowHistory(true);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const sym = query.trim().toUpperCase();
    if (!sym) return;
    setShowSugg(false);
    setShowHistory(false);
    onSearch(sym);
    setQuery("");
  };

  const pickSuggestion = (sym) => {
    setShowSugg(false);
    setShowHistory(false);
    setQuery("");
    onSearch(sym);
  };

  const navActions = (
    <>
      <button onClick={() => { onShowHeatmap?.(); setMenuOpen(false); }} className="watchlist-header-btn" title="Carte des marchés" aria-label="Carte sectorielle des marchés">
        <span aria-hidden="true" style={{ fontSize: 15 }}>🗺️</span>
      </button>
      <button onClick={() => { onShowScreener?.(); setMenuOpen(false); }} className="watchlist-header-btn" title="Screener" aria-label="Screener d'actions">
        <span aria-hidden="true" style={{ fontSize: 15 }}>🔍</span>
      </button>
      <button onClick={() => { onShowPortfolio?.(); setMenuOpen(false); }} className="watchlist-header-btn" title="Mon Portefeuille" aria-label={`Mon portefeuille (${portfolioCount} position${portfolioCount > 1 ? "s" : ""})`}>
        <span aria-hidden="true" style={{ fontSize: 15 }}>💼</span>{portfolioCount > 0 && <span className="wl-count">{portfolioCount}</span>}
      </button>
      <button onClick={() => { onShowInvestors(); setMenuOpen(false); }} className="watchlist-header-btn" title="Investisseurs" aria-label="Voir les top investisseurs" style={{ fontSize: 15, color: "#f59e0b" }}>
        <span aria-hidden="true">🏆</span>
      </button>
      <button onClick={() => { onShowWatchlist(); setMenuOpen(false); }} className="watchlist-header-btn" title="Ma Watchlist" aria-label={`Ma watchlist (${watchlistCount} action${watchlistCount > 1 ? "s" : ""})`}>
        <span aria-hidden="true">★</span>{watchlistCount > 0 && <span className="wl-count">{watchlistCount}</span>}
      </button>
      <button onClick={toggleDark} className="dark-toggle" title={dark ? "Mode clair" : "Mode sombre"} aria-label={dark ? "Activer le mode clair" : "Activer le mode sombre"}>
        <span aria-hidden="true">{dark ? "☀️" : "🌙"}</span>
      </button>
      {user ? (
        <div className="auth-header-group">
          <span className="auth-header-name">{user.displayName}</span>
          <button onClick={() => { onLogout(); setMenuOpen(false); }} className="auth-header-btn auth-logout-btn" title="Déconnexion">
            Déconnexion
          </button>
        </div>
      ) : (
        <button onClick={() => { onShowAuth(); setMenuOpen(false); }} className="auth-header-btn" title="Se connecter">
          Connexion
        </button>
      )}
    </>
  );

  return (
    <header className="hero" role="banner">
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <nav className="header-bar" aria-label="Navigation principale">
          <div className="logo">
            <div className="logo-icon">📈</div>
            <span className="logo-text">Alphaview</span>
          </div>
          {/* Desktop nav */}
          <div className="header-nav-desktop">
            {navActions}
          </div>
          {/* Mobile hamburger */}
          <button className="hamburger-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu" aria-expanded={menuOpen}>
            <span className={`hamburger-line ${menuOpen ? "open" : ""}`} />
            <span className={`hamburger-line ${menuOpen ? "open" : ""}`} />
            <span className={`hamburger-line ${menuOpen ? "open" : ""}`} />
          </button>
        </nav>
        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="mobile-nav">
            {navActions}
          </div>
        )}
        <div ref={wrapRef} style={{ position: "relative", zIndex: 10 }}>
          <form onSubmit={handleSubmit} className="search-wrap">
            <input
              ref={inputRef}
              className="ff-input"
              value={query}
              onChange={e => handleInput(e.target.value)}
              onFocus={handleFocus}
              placeholder="Rechercher une action… ( / )"
              aria-label="Rechercher une action par symbole"
              aria-autocomplete="list"
              aria-expanded={showSugg || showHistory}
              aria-haspopup="listbox"
              role="combobox"
              autoComplete="off"
            />
            <button type="submit" className="ff-btn" aria-label="Lancer l'analyse">Analyser</button>
          </form>
          {showSugg && (
            <div className="autocomplete-dropdown" role="listbox" aria-label="Suggestions de symboles">
              {suggestions.map(s => (
                <button key={s.symbol} role="option" className="autocomplete-item" onClick={() => pickSuggestion(s.symbol)}>
                  <span className="ac-symbol">{s.symbol}</span>
                  <span className="ac-name">{s.shortname || s.longname || ""}</span>
                  <span className="ac-exchange">{s.exchDisp || ""}</span>
                </button>
              ))}
            </div>
          )}
          {showHistory && (
            <div className="autocomplete-dropdown" role="listbox" aria-label="Recherches récentes">
              <div className="history-label">Recherches récentes</div>
              {searchHistory.map(sym => (
                <button key={sym} role="option" className="autocomplete-item" onClick={() => pickSuggestion(sym)}>
                  <span className="ac-symbol">{sym}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
});

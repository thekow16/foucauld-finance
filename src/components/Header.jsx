import { useState, useRef, useEffect } from "react";
import { searchSymbols } from "../utils/api";

export default function Header({ onSearch, dark, toggleDark, onShowWatchlist, watchlistCount, onShowInvestors, user, onShowAuth, onLogout, searchHistory = [] }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

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

  return (
    <div className="hero">
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, position: "relative", zIndex: 1 }}>
          <div className="logo">
            <div className="logo-icon">📈</div>
            <span className="logo-text">Foucauld Finance</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={onShowInvestors} className="watchlist-header-btn" title="Investisseurs" style={{ fontSize: 15, color: "#f59e0b" }}>
              🏆
            </button>
            <button onClick={onShowWatchlist} className="watchlist-header-btn" title="Ma Watchlist">
              ★{watchlistCount > 0 && <span className="wl-count">{watchlistCount}</span>}
            </button>
            <button onClick={toggleDark} className="dark-toggle" title={dark ? "Mode clair" : "Mode sombre"}>
              {dark ? "☀️" : "🌙"}
            </button>
            {user ? (
              <div className="auth-header-group">
                <span className="auth-header-name">{user.displayName}</span>
                <button onClick={onLogout} className="auth-header-btn auth-logout-btn" title="Déconnexion">
                  Déconnexion
                </button>
              </div>
            ) : (
              <button onClick={onShowAuth} className="auth-header-btn" title="Se connecter">
                Connexion
              </button>
            )}
          </div>
        </div>
        <div ref={wrapRef} style={{ position: "relative", zIndex: 10 }}>
          <form onSubmit={handleSubmit} className="search-wrap">
            <input
              className="ff-input"
              value={query}
              onChange={e => handleInput(e.target.value)}
              onFocus={handleFocus}
              placeholder="Rechercher une action…"
            />
            <button type="submit" className="ff-btn">Analyser</button>
          </form>
          {showSugg && (
            <div className="autocomplete-dropdown">
              {suggestions.map(s => (
                <button key={s.symbol} className="autocomplete-item" onClick={() => pickSuggestion(s.symbol)}>
                  <span className="ac-symbol">{s.symbol}</span>
                  <span className="ac-name">{s.shortname || s.longname || ""}</span>
                  <span className="ac-exchange">{s.exchDisp || ""}</span>
                </button>
              ))}
            </div>
          )}
          {showHistory && (
            <div className="autocomplete-dropdown">
              <div className="history-label">Recherches récentes</div>
              {searchHistory.map(sym => (
                <button key={sym} className="autocomplete-item" onClick={() => pickSuggestion(sym)}>
                  <span className="ac-symbol">{sym}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

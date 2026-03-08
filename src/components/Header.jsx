import { useState, useRef, useEffect } from "react";
import { searchSymbols } from "../utils/api";
import { SUGGESTIONS } from "../utils/format";

export default function Header({ onSearch, dark, toggleDark, onShowWatchlist, watchlistCount }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSugg(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (val) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSuggestions([]); setShowSugg(false); return; }
    debounceRef.current = setTimeout(async () => {
      const results = await searchSymbols(val.trim());
      setSuggestions(results);
      setShowSugg(results.length > 0);
    }, 300);
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const sym = query.trim().toUpperCase();
    if (!sym) return;
    setShowSugg(false);
    onSearch(sym);
    setQuery("");
  };

  const pickSuggestion = (sym) => {
    setShowSugg(false);
    setQuery("");
    onSearch(sym);
  };

  return (
    <div className="hero">
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, position: "relative", zIndex: 1 }}>
          <div className="logo">
            <div className="logo-icon">F</div>
            <span className="logo-text">Foucauld Finance</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={onShowWatchlist} className="watchlist-header-btn" title="Ma Watchlist">
              ★{watchlistCount > 0 && <span className="wl-count">{watchlistCount}</span>}
            </button>
            <button onClick={toggleDark} className="dark-toggle" title={dark ? "Mode clair" : "Mode sombre"}>
              {dark ? "Clair" : "Sombre"}
            </button>
          </div>
        </div>
        <div ref={wrapRef} style={{ position: "relative", zIndex: 10 }}>
          <form onSubmit={handleSubmit} className="search-wrap">
            <input
              className="ff-input"
              value={query}
              onChange={e => handleInput(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSugg(true)}
              placeholder="Symbole ou nom : AAPL, Apple, MC.PA, LVMH…"
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
        </div>
        <div style={{ color: "rgba(255,255,255,.6)", fontSize: 12, marginTop: 10, position: "relative", zIndex: 1 }}>
          <b style={{ color: "rgba(255,255,255,.85)" }}>Paris</b> .PA ·{" "}
          <b style={{ color: "rgba(255,255,255,.85)" }}>Londres</b> .L ·{" "}
          <b style={{ color: "rgba(255,255,255,.85)" }}>Tokyo</b> .T ·{" "}
          <b style={{ color: "rgba(255,255,255,.85)" }}>Francfort</b> .DE ·{" "}
          <b style={{ color: "rgba(255,255,255,.85)" }}>Zurich</b> .SW
        </div>
        <div className="chips">
          {SUGGESTIONS.map(s => (
            <button key={s} className="chip" onClick={() => onSearch(s)}>{s}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

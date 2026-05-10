import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { searchSymbols } from "../utils/api";

/* ── Inline style objects ── */

const stickyBar = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  background: "var(--card)",
  borderBottom: "1px solid var(--border)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
};

const innerWrap = {
  maxWidth: 1200,
  margin: "0 auto",
  height: 52,
  display: "flex",
  alignItems: "center",
  padding: "0 20px",
};

const logoBox = {
  width: 30,
  height: 30,
  background: "var(--accent)",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const logoText = {
  fontSize: 15,
  fontWeight: 700,
  color: "var(--text)",
  marginLeft: 8,
  fontFamily: "var(--font)",
  whiteSpace: "nowrap",
};

const navBtn = {
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: "var(--radius-sm)",
  padding: "6px 12px",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "var(--font)",
  transition: "border-color .15s, background .15s",
  whiteSpace: "nowrap",
};

const searchWrap = {
  position: "relative",
  width: 280,
  flexShrink: 0,
};

const searchInput = {
  width: "100%",
  height: 34,
  padding: "0 12px 0 34px",
  fontSize: 13,
  fontFamily: "var(--font)",
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text)",
  outline: "none",
  boxSizing: "border-box",
};

const searchIconWrap = {
  position: "absolute",
  left: 10,
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
};

const dividerStyle = {
  width: 1,
  height: 24,
  background: "var(--border)",
  margin: "0 12px",
  flexShrink: 0,
};

const avatarStyle = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: "var(--accent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "var(--font)",
  flexShrink: 0,
};

const loginBtn = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "6px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "var(--font)",
  whiteSpace: "nowrap",
};

const logoutBtn = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "4px 10px",
  fontSize: 12,
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontFamily: "var(--font)",
  marginLeft: 8,
  whiteSpace: "nowrap",
};

const dropdownStyle = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg, 14px)",
  boxShadow: "0 8px 24px var(--shadow-lg)",
  zIndex: 60,
  maxHeight: 320,
  overflowY: "auto",
};

const dropdownItem = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "8px 12px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  color: "var(--text)",
  fontFamily: "var(--font)",
  textAlign: "left",
};

const historyLabel = {
  padding: "8px 12px 4px",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  fontFamily: "var(--font)",
};

const badgeStyle = {
  background: "var(--accent)",
  color: "#fff",
  fontSize: 10,
  fontWeight: 700,
  borderRadius: 10,
  padding: "1px 6px",
  lineHeight: "16px",
  minWidth: 18,
  textAlign: "center",
};

/* ── SVG Icons ── */

function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 11 L5.5 7 L8.5 9.5 L14 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="3" r="1.2" fill="#fff" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/* ── Component ── */

export default forwardRef(function Header(
  { onSearch, onShowWatchlist, watchlistCount, onShowInvestors, user, onShowAuth, onLogout, searchHistory = [] },
  ref
) {
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

  /* Click-outside handler */
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

  /* Hover style helpers for nav buttons */
  const handleNavEnter = (e) => {
    e.currentTarget.style.borderColor = "var(--border)";
    e.currentTarget.style.background = "var(--highlight-row)";
  };
  const handleNavLeave = (e) => {
    e.currentTarget.style.borderColor = "transparent";
    e.currentTarget.style.background = "transparent";
  };

  /* Hover style helpers for dropdown items */
  const handleItemEnter = (e) => {
    e.currentTarget.style.background = "var(--highlight-row)";
  };
  const handleItemLeave = (e) => {
    e.currentTarget.style.background = "transparent";
  };

  /* Auth section */
  const authSection = user ? (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={avatarStyle}>
        {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", fontFamily: "var(--font)" }}>
        {user.displayName}
      </span>
      <button onClick={() => { onLogout(); setMenuOpen(false); }} style={logoutBtn} title="Déconnexion">
        Déconnexion
      </button>
    </div>
  ) : (
    <button onClick={() => { onShowAuth(); setMenuOpen(false); }} style={loginBtn} title="Se connecter">
      Connexion
    </button>
  );

  /* Nav actions (shared desktop & mobile) */
  const navActions = (
    <>
      <button
        onClick={() => { onShowInvestors(); setMenuOpen(false); }}
        style={navBtn}
        title="Investisseurs"
        aria-label="Voir les top investisseurs"
        onMouseEnter={handleNavEnter}
        onMouseLeave={handleNavLeave}
      >
        Investisseurs
      </button>
      <button
        onClick={() => { onShowWatchlist(); setMenuOpen(false); }}
        style={navBtn}
        title="Ma Watchlist"
        aria-label={`Ma watchlist (${watchlistCount} action${watchlistCount > 1 ? "s" : ""})`}
        onMouseEnter={handleNavEnter}
        onMouseLeave={handleNavLeave}
      >
        Watchlist
        {watchlistCount > 0 && <span style={badgeStyle}>{watchlistCount}</span>}
      </button>
    </>
  );

  return (
    <header className="hero" role="banner" style={stickyBar}>
      <nav className="header-bar" aria-label="Navigation principale" style={innerWrap}>
        {/* Logo */}
        <div className="logo" style={{ display: "flex", alignItems: "center", marginRight: 24, flexShrink: 0 }}>
          <div style={logoBox}>
            <ChartIcon />
          </div>
          <span className="logo-text" style={logoText}>Alphaview</span>
        </div>

        {/* Desktop nav */}
        <div className="header-nav-desktop" style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
          {navActions}

          <div style={{ flex: 1 }} />

          {/* Search bar */}
          <div ref={wrapRef} style={searchWrap}>
            <form onSubmit={handleSubmit} style={{ position: "relative" }}>
              <div style={searchIconWrap}>
                <SearchIcon />
              </div>
              <input
                ref={inputRef}
                value={query}
                onChange={e => handleInput(e.target.value)}
                onFocus={handleFocus}
                placeholder="Rechercher… ( / )"
                aria-label="Rechercher une action par symbole"
                aria-autocomplete="list"
                aria-expanded={showSugg || showHistory}
                aria-haspopup="listbox"
                role="combobox"
                autoComplete="off"
                style={searchInput}
              />
            </form>
            {showSugg && (
              <div style={dropdownStyle} role="listbox" aria-label="Suggestions de symboles">
                {suggestions.map(s => (
                  <button
                    key={s.symbol}
                    role="option"
                    style={dropdownItem}
                    onClick={() => pickSuggestion(s.symbol)}
                    onMouseEnter={handleItemEnter}
                    onMouseLeave={handleItemLeave}
                  >
                    <span style={{ fontWeight: 600, color: "var(--accent)", minWidth: 60 }}>{s.symbol}</span>
                    <span style={{ color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.shortname || s.longname || ""}</span>
                    <span style={{ color: "var(--muted)", fontSize: 11 }}>{s.exchDisp || ""}</span>
                  </button>
                ))}
              </div>
            )}
            {showHistory && (
              <div style={dropdownStyle} role="listbox" aria-label="Recherches récentes">
                <div style={historyLabel}>Recherches récentes</div>
                {searchHistory.map(sym => (
                  <button
                    key={sym}
                    role="option"
                    style={dropdownItem}
                    onClick={() => pickSuggestion(sym)}
                    onMouseEnter={handleItemEnter}
                    onMouseLeave={handleItemLeave}
                  >
                    <span style={{ fontWeight: 600, color: "var(--accent)" }}>{sym}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={dividerStyle} />

          {/* Auth */}
          {authSection}
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
        <div className="mobile-nav" style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
          {navActions}
          {/* Mobile search */}
          <div ref={menuOpen ? undefined : wrapRef} style={{ ...searchWrap, width: "100%", marginTop: 8 }}>
            <form onSubmit={handleSubmit} style={{ position: "relative" }}>
              <div style={searchIconWrap}>
                <SearchIcon />
              </div>
              <input
                value={query}
                onChange={e => handleInput(e.target.value)}
                onFocus={handleFocus}
                placeholder="Rechercher… ( / )"
                aria-label="Rechercher une action par symbole"
                autoComplete="off"
                style={{ ...searchInput, width: "100%" }}
              />
            </form>
          </div>
          <div style={{ width: "100%", marginTop: 8 }}>
            {authSection}
          </div>
        </div>
      )}
    </header>
  );
});

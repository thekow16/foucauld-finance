import { useState, useEffect } from "react";
import { fetchGainers, fetchLosers, fetchSectorPerformance, fetchUpcomingEarnings } from "../utils/marketApi";
import { fetchBatchQuotes } from "../utils/api";
import { fmt } from "../utils/format";

// ── Données investisseurs (résumé pour la landing) ──
const INVESTOR_MOVES = [
  { investor: "Warren Buffett", emoji: "🏛️", symbol: "OXY", name: "Occidental Petroleum", activity: "increased", detail: "+5%", color: "#4f46e5" },
  { investor: "Warren Buffett", emoji: "🏛️", symbol: "CB", name: "Chubb Limited", activity: "new", detail: "Nouveau", color: "#4f46e5" },
  { investor: "Michael Burry", emoji: "🔍", symbol: "BABA", name: "Alibaba", activity: "increased", detail: "+120%", color: "#dc2626" },
  { investor: "Michael Burry", emoji: "🔍", symbol: "JD", name: "JD.com", activity: "new", detail: "Nouveau", color: "#dc2626" },
  { investor: "Cathie Wood", emoji: "🚀", symbol: "COIN", name: "Coinbase", activity: "increased", detail: "+25%", color: "#7c3aed" },
  { investor: "Cathie Wood", emoji: "🚀", symbol: "RKLB", name: "Rocket Lab", activity: "new", detail: "Nouveau", color: "#7c3aed" },
  { investor: "Bill Ackman", emoji: "🎯", symbol: "UBER", name: "Uber Technologies", activity: "new", detail: "Nouveau", color: "#ea580c" },
  { investor: "Bill Ackman", emoji: "🎯", symbol: "NKE", name: "Nike Inc.", activity: "new", detail: "Nouveau", color: "#ea580c" },
  { investor: "Stanley Druckenmiller", emoji: "🦅", symbol: "CPNG", name: "Coupang", activity: "increased", detail: "+35%", color: "#16a34a" },
  { investor: "Stanley Druckenmiller", emoji: "🦅", symbol: "ABNB", name: "Airbnb", activity: "new", detail: "Nouveau", color: "#16a34a" },
  { investor: "David Tepper", emoji: "💎", symbol: "BABA", name: "Alibaba", activity: "increased", detail: "+40%", color: "#0d9488" },
  { investor: "David Tepper", emoji: "💎", symbol: "PDD", name: "PDD Holdings", activity: "new", detail: "Nouveau", color: "#0d9488" },
  { investor: "Ray Dalio", emoji: "🌊", symbol: "NVDA", name: "NVIDIA", activity: "new", detail: "Nouveau", color: "#0891b2" },
  { investor: "Ray Dalio", emoji: "🌊", symbol: "WMT", name: "Walmart", activity: "increased", detail: "+18%", color: "#0891b2" },
];

// ── Heatmap sectors config ──
const SECTOR_LABELS = {
  "Technology": "Technologie",
  "Healthcare": "Santé",
  "Financial Services": "Finance",
  "Consumer Cyclical": "Conso. cyclique",
  "Communication Services": "Communication",
  "Industrials": "Industrie",
  "Consumer Defensive": "Conso. défensive",
  "Energy": "Énergie",
  "Basic Materials": "Matériaux",
  "Real Estate": "Immobilier",
  "Utilities": "Services publics",
};

const SECTOR_ICONS = {
  "Technology": "💻",
  "Healthcare": "🏥",
  "Financial Services": "🏦",
  "Consumer Cyclical": "🛍️",
  "Communication Services": "📡",
  "Industrials": "🏭",
  "Consumer Defensive": "🛒",
  "Energy": "⚡",
  "Basic Materials": "⛏️",
  "Real Estate": "🏠",
  "Utilities": "💡",
};

function sectorColor(pct) {
  if (pct >= 2) return { bg: "#059669", text: "#ffffff" };
  if (pct >= 1) return { bg: "#34d399", text: "#064e3b" };
  if (pct >= 0.3) return { bg: "#a7f3d0", text: "#065f46" };
  if (pct > -0.3) return { bg: "#e2e8f0", text: "#334155" };
  if (pct > -1) return { bg: "#fecaca", text: "#991b1b" };
  if (pct > -2) return { bg: "#f87171", text: "#7f1d1d" };
  return { bg: "#dc2626", text: "#ffffff" };
}

function sectorColorDark(pct) {
  if (pct >= 2) return { bg: "#065f46", text: "#6ee7b7" };
  if (pct >= 1) return { bg: "#064e3b", text: "#6ee7b7" };
  if (pct >= 0.3) return { bg: "#14532d", text: "#86efac" };
  if (pct > -0.3) return { bg: "#1e293b", text: "#94a3b8" };
  if (pct > -1) return { bg: "#450a0a", text: "#fca5a5" };
  if (pct > -2) return { bg: "#7f1d1d", text: "#fca5a5" };
  return { bg: "#991b1b", text: "#fecaca" };
}

// ── Skeleton loader ──
function Skeleton({ width, height = 16, style }) {
  return <div className="lp-skeleton" style={{ width, height, borderRadius: 6, ...style }} />;
}

function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
      <Skeleton width={48} height={14} />
      <Skeleton width="40%" height={14} />
      <Skeleton width={60} height={14} style={{ marginLeft: "auto" }} />
    </div>
  );
}

// ── Mover Row ──
function MoverRow({ item, isGainer, onSelect }) {
  const pct = item.changesPercentage;
  return (
    <button className="lp-mover-row" onClick={() => onSelect(item.symbol)}>
      <div className="lp-mover-symbol">{item.symbol}</div>
      <div className="lp-mover-name">{item.name}</div>
      <div className="lp-mover-price">${item.price?.toFixed(2)}</div>
      <div className={`lp-mover-change ${isGainer ? "up" : "down"}`}>
        {isGainer ? "+" : ""}{pct?.toFixed(2)}%
      </div>
    </button>
  );
}

// ── Watchlist Row (personalized with live quote) ──
function WatchlistQuoteRow({ entry, quote, onSelect }) {
  const price = quote?.regularMarketPrice;
  const pct = quote?.regularMarketChangePercent;
  const isGainer = pct != null ? pct >= 0 : null;
  const currency = quote?.currencySymbol || quote?.currency || "";
  const name = quote?.shortName || quote?.longName || entry.name || "";
  return (
    <button className="lp-mover-row" onClick={() => onSelect(entry.symbol)}>
      <div className="lp-mover-symbol">{entry.symbol}</div>
      <div className="lp-mover-name">{name}</div>
      <div className="lp-mover-price">{price != null ? `${price.toFixed(2)} ${currency}` : "—"}</div>
      <div className={`lp-mover-change ${isGainer == null ? "" : isGainer ? "up" : "down"}`}>
        {pct != null ? `${isGainer ? "+" : ""}${pct.toFixed(2)}%` : ""}
      </div>
    </button>
  );
}

// ── Earnings Row ──
function EarningsRow({ item, onSelect }) {
  const d = new Date(item.date + "T00:00:00");
  const dayStr = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  const hasEst = item.epsEstimated != null;
  return (
    <button className="lp-earnings-row" onClick={() => onSelect(item.symbol)}>
      <div className="lp-earnings-date">{dayStr}</div>
      <div className="lp-earnings-symbol">{item.symbol}</div>
      <div className="lp-earnings-est">
        {hasEst ? `Est. ${item.epsEstimated?.toFixed(2)} $` : "—"}
      </div>
      <div className="lp-earnings-rev">
        {item.revenueEstimated ? fmt(item.revenueEstimated, "currency") : "—"}
      </div>
    </button>
  );
}

// ── Investor Move Chip ──
function InvestorChip({ move, onSelect }) {
  return (
    <button className="lp-investor-chip" onClick={() => onSelect(move.symbol)}>
      <span className="lp-investor-chip-emoji">{move.emoji}</span>
      <div className="lp-investor-chip-body">
        <div className="lp-investor-chip-top">
          <span className="lp-investor-chip-symbol">{move.symbol}</span>
          <span className={`lp-investor-chip-tag ${move.activity}`}>
            {move.activity === "new" ? "Nouveau" : move.detail}
          </span>
        </div>
        <div className="lp-investor-chip-bottom">
          {move.investor.split(" ").pop()} · {move.name}
        </div>
      </div>
    </button>
  );
}

// ── Sector Tile ──
function SectorTile({ sector, dark }) {
  const pctStr = sector.changesPercentage?.replace("%", "").trim();
  const pct = parseFloat(pctStr) || 0;
  const colors = dark ? sectorColorDark(pct) : sectorColor(pct);
  const label = SECTOR_LABELS[sector.sector] || sector.sector;
  const icon = SECTOR_ICONS[sector.sector] || "📊";

  return (
    <div className="lp-heatmap-tile" style={{ background: colors.bg, color: colors.text }}>
      <div className="lp-heatmap-icon">{icon}</div>
      <div className="lp-heatmap-label">{label}</div>
      <div className="lp-heatmap-pct">{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Main Landing Page Component
// ══════════════════════════════════════════════
export default function LandingPage({ onSearch, dark, user, watchlist = [] }) {
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [loadingMovers, setLoadingMovers] = useState(true);
  const [loadingSectors, setLoadingSectors] = useState(true);
  const [loadingEarnings, setLoadingEarnings] = useState(true);
  const [moverTab, setMoverTab] = useState("gainers"); // gainers | losers
  const [watchlistQuotes, setWatchlistQuotes] = useState({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  const showPersonal = !!user && watchlist.length > 0;

  useEffect(() => {
    let cancelled = false;

    // Fetch all data in parallel
    Promise.all([
      fetchGainers().catch(() => []),
      fetchLosers().catch(() => []),
    ]).then(([g, l]) => {
      if (cancelled) return;
      setGainers(g);
      setLosers(l);
      setLoadingMovers(false);
    });

    fetchSectorPerformance()
      .then(d => { if (!cancelled) setSectors(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingSectors(false); });

    fetchUpcomingEarnings()
      .then(d => { if (!cancelled) setEarnings(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingEarnings(false); });

    return () => { cancelled = true; };
  }, []);

  // Personal watchlist quotes
  useEffect(() => {
    if (!showPersonal) return;
    let cancelled = false;
    setLoadingQuotes(true);
    fetchBatchQuotes(watchlist.map(w => w.symbol))
      .then(quotes => {
        if (cancelled) return;
        const map = {};
        for (const q of quotes) { if (q.symbol) map[q.symbol] = q; }
        setWatchlistQuotes(map);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingQuotes(false); });
    return () => { cancelled = true; };
    // Re-fetch when watchlist symbols change
  }, [showPersonal, watchlist.map(w => w.symbol).join(",")]);

  const movers = moverTab === "gainers" ? gainers : losers;
  const firstName = user?.displayName?.split(" ")[0] || "";
  const watchlistSymbols = new Set(watchlist.map(w => w.symbol));
  const watchlistEarnings = earnings.filter(e => watchlistSymbols.has(e.symbol));

  return (
    <div className="lp-container">
      {showPersonal ? (
        <div className="lp-hero" style={{ padding: "28px 20px" }}>
          <h2 className="lp-hero-title" style={{ marginTop: 0 }}>
            Bonjour{firstName ? `, ${firstName}` : ""} 👋
          </h2>
          <p className="lp-hero-subtitle">Voici les dernières nouvelles de votre watchlist</p>
        </div>
      ) : (
        <div className="lp-hero">
          <svg className="lp-hero-icon" width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" opacity=".2" />
            <path d="M20 50 L32 38 L42 46 L60 25" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="60" cy="25" r="4" fill="currentColor" />
          </svg>
          <h2 className="lp-hero-title">Alphaview</h2>
          <p className="lp-hero-subtitle">Analysez n'importe quelle action mondiale — Cours en temps réel, ratios financiers, bilans</p>
        </div>
      )}

      {/* Personal watchlist + upcoming earnings filtered to watchlist */}
      {showPersonal && (
        <div className="lp-grid-2">
          <div className="card lp-section">
            <div className="lp-section-header">
              <h3 className="lp-section-title">Ma watchlist</h3>
              <span className="lp-section-badge">{watchlist.length} titre{watchlist.length > 1 ? "s" : ""}</span>
            </div>
            <div className="lp-mover-list">
              {loadingQuotes && Object.keys(watchlistQuotes).length === 0 ? (
                Array.from({ length: Math.min(watchlist.length, 6) }).map((_, i) => <SkeletonRow key={i} />)
              ) : (
                watchlist.slice(0, 8).map(entry => (
                  <WatchlistQuoteRow
                    key={entry.symbol}
                    entry={entry}
                    quote={watchlistQuotes[entry.symbol]}
                    onSelect={onSearch}
                  />
                ))
              )}
            </div>
          </div>

          <div className="card lp-section">
            <div className="lp-section-header">
              <h3 className="lp-section-title">Earnings de ma watchlist</h3>
              <span className="lp-section-badge">7 jours</span>
            </div>
            <div className="lp-earnings-header-row">
              <span>Date</span>
              <span>Symbole</span>
              <span>EPS est.</span>
              <span>CA est.</span>
            </div>
            <div className="lp-earnings-list">
              {loadingEarnings ? (
                Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
              ) : watchlistEarnings.length === 0 ? (
                <p className="lp-empty">Aucun earnings de votre watchlist cette semaine</p>
              ) : (
                watchlistEarnings.slice(0, 8).map((item, i) => (
                  <EarningsRow key={`${item.symbol}-${i}`} item={item} onSelect={onSearch} />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid: Movers + Earnings */}
      <div className="lp-grid-2">
        {/* Market Movers */}
        <div className="card lp-section">
          <div className="lp-section-header">
            <h3 className="lp-section-title">Movers du jour</h3>
            <div className="lp-toggle">
              <button
                className={`lp-toggle-btn ${moverTab === "gainers" ? "active up" : ""}`}
                onClick={() => setMoverTab("gainers")}
              >
                Hausse
              </button>
              <button
                className={`lp-toggle-btn ${moverTab === "losers" ? "active down" : ""}`}
                onClick={() => setMoverTab("losers")}
              >
                Baisse
              </button>
            </div>
          </div>
          <div className="lp-mover-list">
            {loadingMovers ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : movers.length === 0 ? (
              <p className="lp-empty">Aucune donnée disponible</p>
            ) : (
              movers.slice(0, 8).map(item => (
                <MoverRow
                  key={item.symbol}
                  item={item}
                  isGainer={moverTab === "gainers"}
                  onSelect={onSearch}
                />
              ))
            )}
          </div>
        </div>

        {/* Upcoming Earnings */}
        <div className="card lp-section">
          <div className="lp-section-header">
            <h3 className="lp-section-title">Prochains earnings</h3>
            <span className="lp-section-badge">7 jours</span>
          </div>
          <div className="lp-earnings-header-row">
            <span>Date</span>
            <span>Symbole</span>
            <span>EPS est.</span>
            <span>CA est.</span>
          </div>
          <div className="lp-earnings-list">
            {loadingEarnings ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : earnings.length === 0 ? (
              <p className="lp-empty">Aucun earnings cette semaine</p>
            ) : (
              earnings.slice(0, 10).map((item, i) => (
                <EarningsRow key={`${item.symbol}-${i}`} item={item} onSelect={onSearch} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="card lp-section">
        <div className="lp-section-header">
          <h3 className="lp-section-title">Heatmap marché</h3>
          <span className="lp-section-badge">Performance du jour</span>
        </div>
        {loadingSectors ? (
          <div className="lp-heatmap-grid">
            {Array.from({ length: 11 }).map((_, i) => (
              <Skeleton key={i} width="100%" height={80} style={{ borderRadius: 10 }} />
            ))}
          </div>
        ) : sectors.length === 0 ? (
          <p className="lp-empty">Aucune donnée sectorielle</p>
        ) : (
          <div className="lp-heatmap-grid">
            {sectors.map(s => (
              <SectorTile key={s.sector} sector={s} dark={dark} />
            ))}
          </div>
        )}
      </div>

      {/* Investor Movements */}
      <div className="card lp-section">
        <div className="lp-section-header">
          <h3 className="lp-section-title">Derniers mouvements des investisseurs</h3>
          <span className="lp-section-badge">SEC 13F</span>
        </div>
        <div className="lp-investor-grid">
          {INVESTOR_MOVES.map((m, i) => (
            <InvestorChip key={`${m.symbol}-${m.investor}-${i}`} move={m} onSelect={onSearch} />
          ))}
        </div>
        <p className="lp-investor-footer">
          Données basées sur les filings SEC 13F · Mise à jour trimestrielle · Décalage possible de 45 jours
        </p>
      </div>
    </div>
  );
}

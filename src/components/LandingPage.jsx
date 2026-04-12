import { useState, useEffect } from "react";
import { fetchGainers, fetchLosers, fetchSectorPerformance, fetchUpcomingEarnings } from "../utils/marketApi";
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
export default function LandingPage({ onSearch, dark }) {
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [loadingMovers, setLoadingMovers] = useState(true);
  const [loadingSectors, setLoadingSectors] = useState(true);
  const [loadingEarnings, setLoadingEarnings] = useState(true);
  const [moverTab, setMoverTab] = useState("gainers"); // gainers | losers

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

  const movers = moverTab === "gainers" ? gainers : losers;

  return (
    <div className="lp-container">
      {/* Hero Banner */}
      <div className="lp-hero">
        <svg className="lp-hero-icon" width="80" height="80" viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" opacity=".2" />
          <path d="M20 50 L32 38 L42 46 L60 25" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="60" cy="25" r="4" fill="currentColor" />
        </svg>
        <h2 className="lp-hero-title">Alphaview</h2>
        <p className="lp-hero-subtitle">Analysez n'importe quelle action mondiale — Cours en temps réel, ratios financiers, bilans</p>
      </div>

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
import { useState, useEffect, useMemo } from "react";
import { proxyFetch } from "../utils/api";

const WORKER_URL = "https://foucauld-proxy.foucauld-finance.workers.dev";
const FMP_BASE = "https://financialmodelingprep.com/api/v3";
const CACHE_KEY = "alphaview-landing-cache";
const CACHE_TTL = 10 * 60 * 1000; // 10 min

// ── Heatmap: S&P 500 sector symbols ──
const SECTOR_ETFS = [
  { symbol: "XLK", name: "Technologie", emoji: "💻" },
  { symbol: "XLV", name: "Santé", emoji: "🏥" },
  { symbol: "XLF", name: "Finance", emoji: "🏦" },
  { symbol: "XLY", name: "Conso. Cycl.", emoji: "🛍️" },
  { symbol: "XLC", name: "Communication", emoji: "📡" },
  { symbol: "XLI", name: "Industrie", emoji: "🏭" },
  { symbol: "XLP", name: "Conso. Défens.", emoji: "🛒" },
  { symbol: "XLE", name: "Énergie", emoji: "⚡" },
  { symbol: "XLB", name: "Matériaux", emoji: "🧱" },
  { symbol: "XLRE", name: "Immobilier", emoji: "🏠" },
  { symbol: "XLU", name: "Services pub.", emoji: "💡" },
  ];

// ── Movers: top stocks to track ──
const MOVERS_SYMBOLS = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "BRK-B",
    "JPM", "V", "UNH", "XOM", "MA", "JNJ", "PG", "HD", "AVGO", "COST",
    "ABBV", "MRK", "KO", "PEP", "CRM", "LLY", "AMD", "NFLX", "ORCL",
    "ADBE", "INTC", "DIS", "BA", "NKE", "PYPL", "COIN", "PLTR", "SOFI",
  ];

// ── Investors data (top recent moves from 13F) ──
const INVESTOR_MOVES = [
  { investor: "Buffett", emoji: "🏛️", symbol: "CB", name: "Chubb Limited", action: "new", detail: "Nouveau" },
  { investor: "Buffett", emoji: "🏛️", symbol: "OXY", name: "Occidental Petroleum", action: "increased", detail: "+5%" },
  { investor: "Burry", emoji: "🔍", symbol: "BABA", name: "Alibaba", action: "increased", detail: "+120%" },
  { investor: "Burry", emoji: "🔍", symbol: "JD", name: "JD.com", action: "new", detail: "Nouveau" },
  { investor: "Ackman", emoji: "🎯", symbol: "UBER", name: "Uber Technologies", action: "new", detail: "Nouveau" },
  { investor: "Ackman", emoji: "🎯", symbol: "NKE", name: "Nike Inc.", action: "new", detail: "Nouveau" },
  { investor: "Wood", emoji: "🚀", symbol: "COIN", name: "Coinbase", action: "increased", detail: "+25%" },
  { investor: "Wood", emoji: "🚀", symbol: "RKLB", name: "Rocket Lab", action: "new", detail: "Nouveau" },
  { investor: "Druckenmiller", emoji: "🦅", symbol: "ABNB", name: "Airbnb", action: "new", detail: "Nouveau" },
  { investor: "Druckenmiller", emoji: "🦅", symbol: "LLY", name: "Eli Lilly", action: "increased", detail: "+20%" },
  { investor: "Dalio", emoji: "🌊", symbol: "NVDA", name: "NVIDIA", action: "new", detail: "Nouveau" },
  { investor: "Tepper", emoji: "💎", symbol: "BABA", name: "Alibaba", action: "increased", detail: "+40%" },
  ];

// ── Cache helpers ──
function getCached(key) {
    try {
          const raw = sessionStorage.getItem(key);
          if (!raw) return null;
          const { data, ts } = JSON.parse(raw);
          if (Date.now() - ts > CACHE_TTL) { sessionStorage.removeItem(key); return null; }
          return data;
    } catch { return null; }
}
function setCache(key, data) {
    try { sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

// ── Fetch movers via Yahoo chart API ──
async function fetchMovers() {
    const cached = getCached("lp-movers");
    if (cached) return cached;
    const symbols = MOVERS_SYMBOLS.join(",");
    try {
          const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=symbol,shortName,regularMarketPrice,regularMarketChangePercent,regularMarketVolume,marketCap`;
          const json = await proxyFetch(url);
          const quotes = json.quoteResponse?.result || [];
          const results = quotes.map(q => ({
                  symbol: q.symbol,
                  name: q.shortName || q.symbol,
                  price: q.regularMarketPrice,
                  changePct: q.regularMarketChangePercent,
                  volume: q.regularMarketVolume,
                  marketCap: q.marketCap,
          })).filter(q => q.price != null && q.changePct != null);
          setCache("lp-movers", results);
          return results;
    } catch (e) {
          console.warn("[FF] Landing movers fetch failed:", e.message);
          return [];
    }
}

// ── Fetch sector ETF data for heatmap ──
async function fetchSectorData() {
    const cached = getCached("lp-sectors");
    if (cached) return cached;
    const symbols = SECTOR_ETFS.map(s => s.symbol).join(",");
    try {
          const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=symbol,regularMarketPrice,regularMarketChangePercent`;
          const json = await proxyFetch(url);
          const quotes = json.quoteResponse?.result || [];
          const map = {};
          quotes.forEach(q => { map[q.symbol] = q.regularMarketChangePercent || 0; });
          const results = SECTOR_ETFS.map(s => ({
                  ...s,
                  changePct: map[s.symbol] || 0,
          }));
          setCache("lp-sectors", results);
          return results;
    } catch (e) {
          console.warn("[FF] Landing sector fetch failed:", e.message);
          return SECTOR_ETFS.map(s => ({ ...s, changePct: 0 }));
    }
}

// ── Fetch upcoming earnings ──
async function fetchEarnings() {
    const cached = getCached("lp-earnings");
    if (cached) return cached;
    try {
          const url = `${FMP_BASE}/earning_calendar?from=${getDateStr(0)}&to=${getDateStr(14)}`;
          const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(url)}`;
          const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (!Array.isArray(data)) return [];
          // Filter for known large caps only
      const bigNames = new Set([
              "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "TSLA", "NVDA", "BRK-B",
              "JPM", "V", "MA", "UNH", "JNJ", "PG", "HD", "BAC", "XOM", "ABBV", "MRK",
              "KO", "PEP", "AVGO", "COST", "CRM", "LLY", "AMD", "NFLX", "ORCL", "ADBE",
              "WMT", "DIS", "BA", "NKE", "INTC", "PYPL", "COIN", "PLTR", "SOFI", "SHOP",
              "SQ", "UBER", "ABNB", "SNAP", "ROKU", "ZM", "PANW", "CRWD", "NET", "DDOG",
              "MCD", "SBUX", "LOW", "TGT", "F", "GM", "GS", "MS", "C", "WFC",
              "CAT", "DE", "GE", "HON", "MMM", "RTX", "LMT", "IBM", "QCOM", "TXN",
              "MC.PA", "OR.PA", "AI.PA", "BNP.PA", "SAN.PA", "AIR.PA", "SAF.PA",
            ]);
          const filtered = data
            .filter(d => bigNames.has(d.symbol) && d.date)
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 12);
          setCache("lp-earnings", filtered);
          return filtered;
    } catch (e) {
          console.warn("[FF] Landing earnings fetch failed:", e.message);
          return [];
    }
}

function getDateStr(daysFromNow) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return d.toISOString().slice(0, 10);
}

function fmtPct(v) {
    if (v == null) return "—";
    const sign = v >= 0 ? "+" : "";
    return `${sign}${v.toFixed(2)}%`;
}

function fmtLargeNum(v) {
    if (v == null) return "—";
    if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T$`;
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}Md$`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M$`;
    return v.toLocaleString();
}

function fmtVolume(v) {
    if (v == null) return "—";
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}Md`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
    return v.toLocaleString();
}

// ── Heatmap color ──
function heatColor(pct) {
    if (pct >= 2) return { bg: "#059669", text: "#fff" };
    if (pct >= 1) return { bg: "#10b981", text: "#fff" };
    if (pct >= 0.3) return { bg: "#6ee7b7", text: "#064e3b" };
    if (pct >= -0.3) return { bg: "#94a3b8", text: "#fff" };
    if (pct >= -1) return { bg: "#fca5a5", text: "#7f1d1d" };
    if (pct >= -2) return { bg: "#ef4444", text: "#fff" };
    return { bg: "#dc2626", text: "#fff" };
}

// ══════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════
export default function LandingPage({ onSearch, onShowInvestors }) {
    const [movers, setMovers] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [earnings, setEarnings] = useState([]);
    const [loading, setLoading] = useState(true);

  useEffect(() => {
        let cancelled = false;
        setLoading(true);
        Promise.all([
                fetchMovers(),
                fetchSectorData(),
                fetchEarnings(),
              ]).then(([m, s, e]) => {
                if (cancelled) return;
                setMovers(m);
                setSectors(s);
                setEarnings(e);
        }).finally(() => {
                if (!cancelled) setLoading(false);
        });
        return () => { cancelled = true; };
  }, []);

  // Top gainers & losers
  const { gainers, losers } = useMemo(() => {
        const sorted = [...movers].sort((a, b) => b.changePct - a.changePct);
        return {
                gainers: sorted.filter(s => s.changePct > 0).slice(0, 5),
                losers: sorted.filter(s => s.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 5),
        };
  }, [movers]);

  // Most active by volume
  const mostActive = useMemo(() => {
        return [...movers].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 5);
  }, [movers]);

  if (loading) {
        return (
                <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
                          <div className="spinner" />
                          <p style={{ color: "var(--accent)", fontWeight: 700, fontSize: 15, marginTop: 16 }}>
                                      Chargement du tableau de bord…
                          </p>p>
                </div>div>
              );
  }

  return (
        <div className="landing-page">
        
          {/* ── Section 1: Movers du jour ── */}
              <section className="lp-section">
                      <h2 className="lp-section-title">🔥 Movers du jour</h2>h2>
                      <p className="lp-section-subtitle">Les plus fortes variations sur les grandes capitalisations</p>p>
                      <div className="lp-movers-grid">
                        {/* Gainers */}
                                <div className="lp-movers-col">
                                            <div className="lp-movers-header lp-green">📈 Top hausses</div>div>
                                  {gainers.length === 0 && <div className="lp-empty">Aucune hausse aujourd'hui</div>div>}
                                  {gainers.map(s => (
                        <button key={s.symbol} className="lp-mover-row" onClick={() => onSearch(s.symbol)}>
                                        <div className="lp-mover-left">
                                                          <span className="lp-mover-symbol">{s.symbol}</span>span>
                                                          <span className="lp-mover-name">{s.name}</span>span>
                                        </div>div>
                                        <div className="lp-mover-right">
                                                          <span className="lp-mover-price">{s.price?.toFixed(2)}</span>span>
                                                          <span className="lp-mover-change up">{fmtPct(s.changePct)}</span>span>
                                        </div>div>
                        </button>button>
                      ))}
                                </div>div>
                      
                        {/* Losers */}
                                <div className="lp-movers-col">
                                            <div className="lp-movers-header lp-red">📉 Top baisses</div>div>
                                  {losers.length === 0 && <div className="lp-empty">Aucune baisse aujourd'hui</div>div>}
                                  {losers.map(s => (
                        <button key={s.symbol} className="lp-mover-row" onClick={() => onSearch(s.symbol)}>
                                        <div className="lp-mover-left">
                                                          <span className="lp-mover-symbol">{s.symbol}</span>span>
                                                          <span className="lp-mover-name">{s.name}</span>span>
                                        </div>div>
                                        <div className="lp-mover-right">
                                                          <span className="lp-mover-price">{s.price?.toFixed(2)}</span>span>
                                                          <span className="lp-mover-change down">{fmtPct(s.changePct)}</span>span>
                                        </div>div>
                        </button>button>
                      ))}
                                </div>div>
                      
                        {/* Most active */}
                                <div className="lp-movers-col">
                                            <div className="lp-movers-header lp-blue">⚡ Plus actifs (vol.)</div>div>
                                  {mostActive.map(s => (
                        <button key={s.symbol} className="lp-mover-row" onClick={() => onSearch(s.symbol)}>
                                        <div className="lp-mover-left">
                                                          <span className="lp-mover-symbol">{s.symbol}</span>span>
                                                          <span className="lp-mover-name">{s.name}</span>span>
                                        </div>div>
                                        <div className="lp-mover-right">
                                                          <span className="lp-mover-vol">{fmtVolume(s.volume)}</span>span>
                                                          <span className={`lp-mover-change ${s.changePct >= 0 ? "up" : "down"}`}>{fmtPct(s.changePct)}</span>span>
                                        </div>div>
                        </button>button>
                      ))}
                                </div>div>
                      </div>div>
              </section>section>
        
          {/* ── Section 2: Heatmap marché ── */}
              <section className="lp-section">
                      <h2 className="lp-section-title">🗺️ Heatmap marché</h2>h2>
                      <p className="lp-section-subtitle">Performance des secteurs S&P 500 en temps réel</p>p>
                      <div className="lp-heatmap-grid">
                        {sectors.map(s => {
                      const colors = heatColor(s.changePct);
                      return (
                                      <button
                                                        key={s.symbol}
                                                        className="lp-heat-cell"
                                                        style={{ background: colors.bg, color: colors.text }}
                                                        onClick={() => onSearch(s.symbol)}
                                                        title={`${s.name} (${s.symbol}) — ${fmtPct(s.changePct)}`}
                                                      >
                                                      <div className="lp-heat-emoji">{s.emoji}</div>div>
                                                      <div className="lp-heat-name">{s.name}</div>div>
                                                      <div className="lp-heat-pct">{fmtPct(s.changePct)}</div>div>
                                      </button>button>
                                    );
        })}
                      </div>div>
              </section>section>
        
          {/* ── Section 3: Derniers mouvements investisseurs ── */}
              <section className="lp-section">
                      <div className="lp-section-header-row">
                                <div>
                                            <h2 className="lp-section-title">🏆 Derniers mouvements investisseurs</h2>h2>
                                            <p className="lp-section-subtitle">Positions récentes des légendes de la finance (SEC 13F)</p>p>
                                </div>div>
                        {onShowInvestors && (
                      <button className="ff-btn lp-see-all" onClick={onShowInvestors}>
                                    Voir tous les portefeuilles →
                      </button>button>
                                )}
                      </div>div>
                      <div className="lp-investor-grid">
                        {INVESTOR_MOVES.map((m, i) => (
                      <button
                                      key={`${m.symbol}-${m.investor}-${i}`}
                                      className="lp-investor-chip"
                                      onClick={() => onSearch(m.symbol)}
                                      title={`${m.investor} — ${m.name}`}
                                    >
                                    <div className="lp-inv-top">
                                                    <span className="lp-inv-symbol">{m.symbol}</span>span>
                                                    <span className={`lp-inv-tag ${m.action}`}>
                                                      {m.action === "new" ? "🆕" : "📈"} {m.detail}
                                                    </span>span>
                                    </div>div>
                                    <div className="lp-inv-name">{m.name}</div>div>
                                    <div className="lp-inv-who">{m.emoji} {m.investor}</div>div>
                      </button>button>
                    ))}
                      </div>div>
              </section>section>
        
          {/* ── Section 4: Prochains Earnings ── */}
              <section className="lp-section">
                      <h2 className="lp-section-title">📅 Prochains earnings</h2>h2>
                      <p className="lp-section-subtitle">Résultats trimestriels attendus dans les 14 prochains jours</p>p>
                {earnings.length === 0 ? (
                    <div className="lp-empty-card">
                                <p>Aucun résultat majeur prévu prochainement ou données indisponibles.</p>p>
                    </div>div>
                  ) : (
                    <div className="lp-earnings-grid">
                      {earnings.map((e, i) => (
                                    <button key={`${e.symbol}-${i}`} className="lp-earnings-card" onClick={() => onSearch(e.symbol)}>
                                                    <div className="lp-earn-date">
                                                      {new Date(e.date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                                                    </div>div>
                                                    <div className="lp-earn-symbol">{e.symbol}</div>div>
                                                    <div className="lp-earn-est">
                                                      {e.epsEstimated != null ? (
                                                          <span>EPS est. <strong>{e.epsEstimated.toFixed(2)}</strong>strong></span>span>
                                                        ) : (
                                                          <span style={{ color: "var(--muted)" }}>EPS —</span>span>
                                                                      )}
                                                    </div>div>
                                      {e.revenueEstimated != null && (
                                                        <div className="lp-earn-rev">CA est. {fmtLargeNum(e.revenueEstimated)}</div>div>
                                                    )}
                                    </button>button>
                                  ))}
                    </div>div>
                      )}
              </section>section>
        
          {/* ── CTA ── */}
              <div className="lp-cta">
                      <p style={{ color: "var(--muted)", fontSize: 13 }}>
                                Tapez un symbole ou cliquez sur une action pour lancer l'analyse complète
                      </p>p>
              </div>div>
        </div>div>
      );
}</div>

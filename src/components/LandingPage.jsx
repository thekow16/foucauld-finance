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

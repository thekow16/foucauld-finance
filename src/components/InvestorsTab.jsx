import { useState } from "react";

// Données basées sur les derniers 13F SEC filings (Q4 2024 / Q1 2025)
const INVESTORS = [
  {
    id: "buffett",
    name: "Warren Buffett",
    fund: "Berkshire Hathaway",
    emoji: "🏛️",
    aum: "$298B",
    style: "Value Investing",
    description: "L'Oracle d'Omaha — achète des entreprises de qualité à prix raisonnable",
    color: "#4f46e5",
    holdings: [
      { symbol: "AAPL", name: "Apple Inc.", pct: 28.1, value: "$84.2B", activity: "reduced", activityDetail: "-25%" },
      { symbol: "AXP", name: "American Express", pct: 16.4, value: "$41.1B", activity: "held" },
      { symbol: "BAC", name: "Bank of America", pct: 11.2, value: "$33.5B", activity: "reduced", activityDetail: "-15%" },
      { symbol: "KO", name: "Coca-Cola", pct: 9.5, value: "$24.5B", activity: "held" },
      { symbol: "CVX", name: "Chevron", pct: 6.4, value: "$17.5B", activity: "held" },
      { symbol: "OXY", name: "Occidental Petroleum", pct: 5.1, value: "$13.2B", activity: "increased", activityDetail: "+5%" },
      { symbol: "KHC", name: "Kraft Heinz", pct: 4.2, value: "$10.6B", activity: "held" },
      { symbol: "MCO", name: "Moody's Corp", pct: 3.8, value: "$9.5B", activity: "held" },
      { symbol: "CB", name: "Chubb Limited", pct: 2.7, value: "$6.9B", activity: "new", activityDetail: "Nouveau" },
      { symbol: "DVA", name: "DaVita Inc.", pct: 1.8, value: "$4.7B", activity: "held" },
    ],
  },
  {
    id: "soros",
    name: "George Soros",
    fund: "Soros Fund Management",
    emoji: "🌍",
    aum: "$6.7B",
    style: "Global Macro",
    description: "Légende du trading macro — célèbre pour avoir 'cassé' la Banque d'Angleterre",
    color: "#7c3aed",
    holdings: [
      { symbol: "SPLK", name: "Splunk Inc.", pct: 5.2, value: "$348M", activity: "new", activityDetail: "Nouveau" },
      { symbol: "LIBERTY", name: "Liberty Broadband", pct: 4.8, value: "$322M", activity: "increased", activityDetail: "+30%" },
      { symbol: "AMZN", name: "Amazon", pct: 3.9, value: "$261M", activity: "increased", activityDetail: "+20%" },
      { symbol: "GOOG", name: "Alphabet", pct: 3.5, value: "$235M", activity: "held" },
      { symbol: "BABA", name: "Alibaba", pct: 2.8, value: "$188M", activity: "reduced", activityDetail: "-40%" },
      { symbol: "RIVN", name: "Rivian Automotive", pct: 2.4, value: "$161M", activity: "new", activityDetail: "Nouveau" },
      { symbol: "UBER", name: "Uber Technologies", pct: 2.1, value: "$141M", activity: "held" },
      { symbol: "CRM", name: "Salesforce", pct: 1.9, value: "$127M", activity: "increased", activityDetail: "+15%" },
    ],
  },
  {
    id: "dalio",
    name: "Ray Dalio",
    fund: "Bridgewater Associates",
    emoji: "🌊",
    aum: "$97B",
    style: "All Weather / Risk Parity",
    description: "Fondateur du plus grand hedge fund — pionnier de la parité de risque",
    color: "#0891b2",
    holdings: [
      { symbol: "SPY", name: "SPDR S&P 500 ETF", pct: 8.2, value: "$7.96B", activity: "increased", activityDetail: "+10%" },
      { symbol: "IVV", name: "iShares Core S&P 500", pct: 6.5, value: "$6.31B", activity: "held" },
      { symbol: "IEMG", name: "iShares EM ETF", pct: 5.1, value: "$4.95B", activity: "reduced", activityDetail: "-8%" },
      { symbol: "PG", name: "Procter & Gamble", pct: 3.8, value: "$3.69B", activity: "held" },
      { symbol: "JNJ", name: "Johnson & Johnson", pct: 3.2, value: "$3.1B", activity: "held" },
      { symbol: "COST", name: "Costco", pct: 2.9, value: "$2.81B", activity: "increased", activityDetail: "+12%" },
      { symbol: "WMT", name: "Walmart", pct: 2.7, value: "$2.62B", activity: "increased", activityDetail: "+18%" },
      { symbol: "NVDA", name: "NVIDIA", pct: 2.5, value: "$2.43B", activity: "new", activityDetail: "Nouveau" },
    ],
  },
  {
    id: "burry",
    name: "Michael Burry",
    fund: "Scion Asset Management",
    emoji: "🔍",
    aum: "$240M",
    style: "Deep Value / Contrarian",
    description: "A prédit la crise de 2008 — investisseur contrariant par excellence",
    color: "#dc2626",
    holdings: [
      { symbol: "BABA", name: "Alibaba", pct: 21.3, value: "$51M", activity: "increased", activityDetail: "+120%" },
      { symbol: "JD", name: "JD.com", pct: 14.8, value: "$35.5M", activity: "new", activityDetail: "Nouveau" },
      { symbol: "BIDU", name: "Baidu", pct: 11.2, value: "$26.9M", activity: "new", activityDetail: "Nouveau" },
      { symbol: "GOOG", name: "Alphabet", pct: 8.5, value: "$20.4M", activity: "reduced", activityDetail: "-30%" },
      { symbol: "HCA", name: "HCA Healthcare", pct: 7.1, value: "$17M", activity: "held" },
      { symbol: "OSCR", name: "Oscar Health", pct: 5.8, value: "$13.9M", activity: "new", activityDetail: "Nouveau" },
    ],
  },
  {
    id: "ackman",
    name: "Bill Ackman",
    fund: "Pershing Square Capital",
    emoji: "🎯",
    aum: "$12.8B",
    style: "Activist Investing",
    description: "Investisseur activiste — prises de positions concentrées dans quelques entreprises",
    color: "#ea580c",
    holdings: [
      { symbol: "HLT", name: "Hilton Worldwide", pct: 22.1, value: "$2.83B", activity: "held" },
      { symbol: "QSR", name: "Restaurant Brands", pct: 18.5, value: "$2.37B", activity: "held" },
      { symbol: "GOOG", name: "Alphabet", pct: 17.8, value: "$2.28B", activity: "increased", activityDetail: "+8%" },
      { symbol: "CMG", name: "Chipotle", pct: 14.2, value: "$1.82B", activity: "held" },
      { symbol: "CP", name: "Canadian Pacific", pct: 11.4, value: "$1.46B", activity: "reduced", activityDetail: "-5%" },
      { symbol: "UBER", name: "Uber Technologies", pct: 9.8, value: "$1.25B", activity: "new", activityDetail: "Nouveau" },
      { symbol: "NKE", name: "Nike Inc.", pct: 6.2, value: "$794M", activity: "new", activityDetail: "Nouveau" },
    ],
  },
  {
    id: "wood",
    name: "Cathie Wood",
    fund: "ARK Invest",
    emoji: "🚀",
    aum: "$11.4B",
    style: "Disruptive Innovation",
    description: "Focus sur l'innovation disruptive — IA, robotique, génomique, fintech",
    color: "#7c3aed",
    holdings: [
      { symbol: "TSLA", name: "Tesla Inc.", pct: 13.5, value: "$1.54B", activity: "increased", activityDetail: "+15%" },
      { symbol: "COIN", name: "Coinbase", pct: 8.2, value: "$935M", activity: "increased", activityDetail: "+25%" },
      { symbol: "ROKU", name: "Roku Inc.", pct: 7.8, value: "$889M", activity: "held" },
      { symbol: "SQ", name: "Block Inc.", pct: 6.1, value: "$696M", activity: "increased", activityDetail: "+10%" },
      { symbol: "PATH", name: "UiPath", pct: 5.5, value: "$627M", activity: "reduced", activityDetail: "-12%" },
      { symbol: "RKLB", name: "Rocket Lab", pct: 4.9, value: "$559M", activity: "new", activityDetail: "Nouveau" },
      { symbol: "CRSP", name: "CRISPR Therapeutics", pct: 4.2, value: "$479M", activity: "held" },
      { symbol: "PLTR", name: "Palantir", pct: 3.8, value: "$433M", activity: "increased", activityDetail: "+30%" },
    ],
  },
  {
    id: "druckenmiller",
    name: "Stanley Druckenmiller",
    fund: "Duquesne Family Office",
    emoji: "🦅",
    aum: "$3.5B",
    style: "Growth / Macro",
    description: "Ex-bras droit de Soros — l'un des meilleurs track records de l'histoire",
    color: "#16a34a",
    holdings: [
      { symbol: "NVDA", name: "NVIDIA", pct: 11.2, value: "$392M", activity: "reduced", activityDetail: "-20%" },
      { symbol: "MSFT", name: "Microsoft", pct: 8.5, value: "$298M", activity: "held" },
      { symbol: "CPNG", name: "Coupang", pct: 7.8, value: "$273M", activity: "increased", activityDetail: "+35%" },
      { symbol: "LLY", name: "Eli Lilly", pct: 6.4, value: "$224M", activity: "increased", activityDetail: "+20%" },
      { symbol: "ABNB", name: "Airbnb", pct: 5.1, value: "$179M", activity: "new", activityDetail: "Nouveau" },
      { symbol: "TECK", name: "Teck Resources", pct: 4.3, value: "$151M", activity: "held" },
      { symbol: "IWM", name: "Russell 2000 ETF", pct: 3.9, value: "$137M", activity: "new", activityDetail: "Nouveau" },
      { symbol: "META", name: "Meta Platforms", pct: 3.5, value: "$123M", activity: "reduced", activityDetail: "-15%" },
    ],
  },
  {
    id: "tepper",
    name: "David Tepper",
    fund: "Appaloosa Management",
    emoji: "💎",
    aum: "$7.2B",
    style: "Distressed / Opportunistic",
    description: "Spécialiste de la dette en difficulté — rendement annuel moyen de +25%",
    color: "#0d9488",
    holdings: [
      { symbol: "BABA", name: "Alibaba", pct: 12.8, value: "$922M", activity: "increased", activityDetail: "+40%" },
      { symbol: "AMZN", name: "Amazon", pct: 10.5, value: "$756M", activity: "held" },
      { symbol: "META", name: "Meta Platforms", pct: 9.2, value: "$662M", activity: "increased", activityDetail: "+15%" },
      { symbol: "MSFT", name: "Microsoft", pct: 8.1, value: "$583M", activity: "held" },
      { symbol: "GOOG", name: "Alphabet", pct: 7.3, value: "$526M", activity: "reduced", activityDetail: "-10%" },
      { symbol: "PDD", name: "PDD Holdings", pct: 5.8, value: "$418M", activity: "new", activityDetail: "Nouveau" },
      { symbol: "NVDA", name: "NVIDIA", pct: 5.5, value: "$396M", activity: "increased", activityDetail: "+22%" },
      { symbol: "EEM", name: "iShares EM ETF", pct: 4.2, value: "$302M", activity: "increased", activityDetail: "+30%" },
    ],
  },
];

const ACTIVITY_CONFIG = {
  new: { label: "🆕 Nouveau", color: "#4f46e5", bg: "#eef2ff", darkBg: "#312e81" },
  increased: { label: "📈 Renforcé", color: "#16a34a", bg: "#f0fdf4", darkBg: "#14532d" },
  reduced: { label: "📉 Allégé", color: "#ea580c", bg: "#fff7ed", darkBg: "#7c2d12" },
  sold: { label: "🚫 Vendu", color: "#dc2626", bg: "#fef2f2", darkBg: "#7f1d1d" },
  held: { label: "➡️ Maintenu", color: "#64748b", bg: "#f8fafc", darkBg: "#334155" },
};

function HoldingRow({ h, onSymbolClick }) {
  const act = ACTIVITY_CONFIG[h.activity] || ACTIVITY_CONFIG.held;
  return (
    <tr>
      <td>
        <button
          onClick={() => onSymbolClick(h.symbol)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontWeight: 900, color: "#4f46e5", fontSize: 14, padding: 0,
          }}
          title={`Analyser ${h.symbol}`}
        >
          {h.symbol}
        </button>
        <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>{h.name}</div>
      </td>
      <td style={{ fontWeight: 800, color: "var(--text)" }}>{h.pct}%</td>
      <td style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{h.value}</td>
      <td>
        <span className={`investor-activity ${h.activity}`}>
          {act.label}
        </span>
        {h.activityDetail && h.activity !== "new" && (
          <span style={{ fontSize: 11, marginLeft: 4, fontWeight: 700, color: act.color }}>
            {h.activityDetail}
          </span>
        )}
      </td>
    </tr>
  );
}

function InvestorCard({ investor, isExpanded, onToggle, onSymbolClick }) {
  const newPositions = investor.holdings.filter(h => h.activity === "new").length;
  const increasedPositions = investor.holdings.filter(h => h.activity === "increased").length;
  const reducedPositions = investor.holdings.filter(h => h.activity === "reduced" || h.activity === "sold").length;

  return (
    <div className="investor-card" style={{ borderLeftColor: investor.color }}>
      <button className="investor-header" onClick={onToggle}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
          <div className="investor-emoji">{investor.emoji}</div>
          <div style={{ textAlign: "left" }}>
            <div className="investor-name">{investor.name}</div>
            <div className="investor-fund">{investor.fund}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div style={{ textAlign: "right" }}>
            <div className="investor-aum">{investor.aum}</div>
            <div className="investor-style">{investor.style}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {newPositions > 0 && <span className="activity-badge new">+{newPositions} 🆕</span>}
            {increasedPositions > 0 && <span className="activity-badge increased">+{increasedPositions} 📈</span>}
            {reducedPositions > 0 && <span className="activity-badge reduced">{reducedPositions} 📉</span>}
          </div>
          <span className="investor-chevron">{isExpanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {isExpanded && (
        <div className="investor-detail">
          <p className="investor-desc">{investor.description}</p>
          <table className="ff-table investor-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>% Portfolio</th>
                <th>Valeur</th>
                <th>Activité</th>
              </tr>
            </thead>
            <tbody>
              {investor.holdings.map(h => (
                <HoldingRow key={h.symbol} h={h} onSymbolClick={onSymbolClick} />
              ))}
            </tbody>
          </table>
          <div className="investor-footer">
            📋 Données basées sur les filings SEC 13F · Mise à jour trimestrielle
          </div>
        </div>
      )}
    </div>
  );
}

export default function InvestorsTab({ onSymbolClick }) {
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState("all"); // all, new, increased, reduced

  const toggle = (id) => setExpandedId(prev => prev === id ? null : id);

  const filteredInvestors = filter === "all"
    ? INVESTORS
    : INVESTORS.filter(inv => inv.holdings.some(h => {
        if (filter === "new") return h.activity === "new";
        if (filter === "increased") return h.activity === "increased";
        if (filter === "reduced") return h.activity === "reduced" || h.activity === "sold";
        return true;
      }));

  // Aggregate recent moves across all investors
  const recentMoves = INVESTORS.flatMap(inv =>
    inv.holdings
      .filter(h => h.activity === "new" || h.activity === "increased")
      .map(h => ({ ...h, investor: inv.name, investorEmoji: inv.emoji }))
  ).slice(0, 8);

  return (
    <div>
        <div className="tab-header">
          <div>
            <h3 className="tab-title">
              🏆 Grands Investisseurs
            </h3>
            <p className="tab-subtitle">
              Portefeuilles des légendes de la finance — Données SEC 13F
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { id: "all", label: "Tous" },
              { id: "new", label: "🆕 Nouveaux" },
              { id: "increased", label: "📈 Renforcés" },
              { id: "reduced", label: "📉 Allégés" },
            ].map(f => (
              <button
                key={f.id}
                className={`investor-filter${filter === f.id ? " active" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mouvements récents highlights */}
        <div className="investor-moves-banner">
          <div className="investor-moves-title">🔥 Derniers mouvements notables</div>
          <div className="investor-moves-grid">
            {recentMoves.map((m, i) => (
              <button
                key={`${m.investor}-${m.symbol}-${i}`}
                className="investor-move-chip"
                onClick={() => onSymbolClick(m.symbol)}
                title={`${m.investor} — ${m.name}`}
              >
                <span style={{ fontWeight: 900, color: "#4f46e5" }}>{m.symbol}</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{m.investorEmoji} {m.investor.split(" ")[1]}</span>
                <span className={`move-tag ${m.activity}`}>
                  {m.activity === "new" ? "🆕" : "📈"} {m.activityDetail}
                </span>
              </button>
            ))}
          </div>
        </div>

      {filteredInvestors.map(inv => (
        <InvestorCard
          key={inv.id}
          investor={inv}
          isExpanded={expandedId === inv.id}
          onToggle={() => toggle(inv.id)}
          onSymbolClick={onSymbolClick}
        />
      ))}

      <div style={{ textAlign: "center", marginTop: 18, color: "var(--muted)", fontSize: 11, lineHeight: 1.8 }}>
        📋 Les données proviennent des filings SEC 13F (déclarations trimestrielles obligatoires)<br />
        ⏱️ Décalage possible de 45 jours entre les transactions et leur publication<br />
        ⚠️ Ne constitue pas un conseil en investissement
      </div>
    </div>
  );
}

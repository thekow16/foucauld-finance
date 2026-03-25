import { useState, useEffect, useRef } from "react";
import { fetchChartData } from "../utils/api";

// Universe of major stocks grouped by sector
const UNIVERSE = {
  "Technologie": ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "TSM", "AVGO", "ASML", "ADBE", "CRM", "SAP", "ORCL"],
  "Finance": ["JPM", "V", "MA", "BAC", "BNP.PA", "GS", "MS", "AXA.PA", "BLK", "HSBA.L"],
  "Santé": ["UNH", "JNJ", "LLY", "NVO", "PFE", "MRK", "ABT", "SAN.PA", "AMGN", "AZN"],
  "Consommation": ["AMZN", "TSLA", "NKE", "MCD", "SBUX", "MC.PA", "OR.PA", "RMS.PA", "HD", "TM"],
  "Industrie": ["CAT", "BA", "HON", "UPS", "AIR.PA", "SIE.DE", "GE", "RTX", "DE", "ABB"],
  "Énergie": ["XOM", "CVX", "SHEL", "TTE.PA", "COP", "SLB", "ENI.MI", "BP.L", "EOG", "PXD"],
  "Télécom": ["T", "VZ", "TMUS", "DTE.DE", "TEF", "ORAN", "VOD.L"],
  "Immobilier": ["PLD", "AMT", "EQIX", "SPG", "O", "PSA", "URW.AS"],
  "Utilities": ["NEE", "DUK", "SO", "D", "AEP", "EXC", "ENGI.PA"],
};

const SECTOR_COLORS = {
  "Technologie": "#6366f1",
  "Finance": "#f59e0b",
  "Santé": "#10b981",
  "Consommation": "#ec4899",
  "Industrie": "#8b5cf6",
  "Énergie": "#ef4444",
  "Télécom": "#06b6d4",
  "Immobilier": "#84cc16",
  "Utilities": "#78716c",
};

function getChangeColor(change) {
  if (change == null) return "#64748b";
  if (change > 3) return "#059669";
  if (change > 1.5) return "#10b981";
  if (change > 0.5) return "#34d399";
  if (change > 0) return "#6ee7b7";
  if (change > -0.5) return "#fca5a5";
  if (change > -1.5) return "#f87171";
  if (change > -3) return "#ef4444";
  return "#dc2626";
}

function Treemap({ data, width, height }) {
  // Simple treemap layout (squarified)
  const totalValue = data.reduce((s, d) => s + d.value, 0);
  if (totalValue === 0 || width <= 0 || height <= 0) return null;

  const rects = [];
  let remaining = [...data].sort((a, b) => b.value - a.value);
  let x = 0, y = 0, w = width, h = height;

  function layoutRow(row, rowTotal, x, y, w, h, vertical) {
    let offset = 0;
    return row.map(item => {
      const ratio = item.value / rowTotal;
      const rect = vertical
        ? { x, y: y + offset, w: w * (rowTotal / totalValue), h: h * ratio, item }
        : { x: x + offset, y, w: w * ratio, h: h * (rowTotal / totalValue), item };
      offset += vertical ? h * ratio : w * ratio;
      return rect;
    });
  }

  // Simplified: split into rows based on aspect ratio
  let currentRow = [];
  let currentTotal = 0;
  const vertical = h > w;

  remaining.forEach((item, i) => {
    currentRow.push(item);
    currentTotal += item.value;

    if (i === remaining.length - 1 || currentRow.length >= Math.ceil(Math.sqrt(remaining.length))) {
      const rowRects = layoutRow(currentRow, currentTotal, x, y, w, h, vertical);
      rects.push(...rowRects);

      if (vertical) {
        const usedW = w * (currentTotal / totalValue);
        x += usedW;
        w -= usedW;
      } else {
        const usedH = h * (currentTotal / totalValue);
        y += usedH;
        h -= usedH;
      }
      totalValue > currentTotal && (remaining = remaining.slice(currentRow.length));
      currentRow = [];
      currentTotal = 0;
    }
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {rects.map((r, i) => (
        <g key={i}>
          <rect
            x={r.x + 1} y={r.y + 1}
            width={Math.max(0, r.w - 2)} height={Math.max(0, r.h - 2)}
            rx="4"
            fill={getChangeColor(r.item.change)}
            opacity="0.85"
            style={{ transition: "fill .3s" }}
          />
          {r.w > 50 && r.h > 30 && (
            <>
              <text x={r.x + r.w / 2} y={r.y + r.h / 2 - 4} textAnchor="middle" fontSize={r.w > 80 ? 11 : 9} fontWeight="800" fill="#fff">
                {r.item.symbol}
              </text>
              <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 10} textAnchor="middle" fontSize={r.w > 80 ? 10 : 8} fontWeight="600" fill="rgba(255,255,255,0.85)">
                {r.item.change != null ? `${r.item.change >= 0 ? "+" : ""}${r.item.change.toFixed(2)}%` : "—"}
              </text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function HeatmapView({ onSelect, onBack }) {
  const [stockData, setStockData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedSector, setSelectedSector] = useState("");
  const [viewMode, setViewMode] = useState("treemap"); // treemap | table
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fetch daily data for all symbols
  useEffect(() => {
    const allSymbols = Object.values(UNIVERSE).flat();
    setLoading(true);

    // Check sessionStorage cache
    const cacheKey = "alphaview-heatmap-cache";
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey));
      if (cached && Date.now() - cached.ts < 10 * 60 * 1000) {
        setStockData(cached.data);
        setLoading(false);
        return;
      }
    } catch {}

    const batchSize = 6;
    let idx = 0;
    const results = {};

    async function fetchBatch() {
      const batch = allSymbols.slice(idx, idx + batchSize);
      if (batch.length === 0) {
        setStockData(results);
        setLoading(false);
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ data: results, ts: Date.now() })); } catch {}
        return;
      }

      await Promise.allSettled(batch.map(async (sym) => {
        try {
          const chartData = await fetchChartData(sym, "1d", "5d");
          if (chartData.length >= 2) {
            const last = chartData[chartData.length - 1].price;
            const prev = chartData[chartData.length - 2].price;
            results[sym] = { price: last, change: ((last - prev) / prev) * 100 };
          }
        } catch {}
      }));

      idx += batchSize;
      // Update progress
      setStockData({ ...results });
      await fetchBatch();
    }

    fetchBatch();
  }, []);

  const sectors = selectedSector ? [selectedSector] : Object.keys(UNIVERSE);

  // Build treemap data
  const treemapData = [];
  sectors.forEach(sector => {
    UNIVERSE[sector]?.forEach(sym => {
      const d = stockData[sym];
      treemapData.push({
        symbol: sym,
        sector,
        change: d?.change ?? null,
        price: d?.price ?? null,
        value: d?.price ? Math.abs(d.price) : 1, // Size by price as proxy (ideally market cap)
      });
    });
  });

  // Sector summary
  const sectorSummary = Object.keys(UNIVERSE).map(sector => {
    const stocks = UNIVERSE[sector];
    const changes = stocks.map(s => stockData[s]?.change).filter(c => c != null);
    const avg = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : null;
    return { sector, avg, count: stocks.length, loaded: changes.length };
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--text)", letterSpacing: -0.5 }}>
            Carte des marchés
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Performance journalière · {Object.keys(stockData).length}/{Object.values(UNIVERSE).flat().length} actions chargées
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="ff-btn"
            style={{ background: viewMode === "treemap" ? "var(--accent)" : "var(--bg)", color: viewMode === "treemap" ? "#fff" : "var(--text)", padding: "8px 14px", fontSize: 12, border: "1px solid var(--border)" }}
            onClick={() => setViewMode("treemap")}
          >
            Carte
          </button>
          <button
            className="ff-btn"
            style={{ background: viewMode === "table" ? "var(--accent)" : "var(--bg)", color: viewMode === "table" ? "#fff" : "var(--text)", padding: "8px 14px", fontSize: 12, border: "1px solid var(--border)" }}
            onClick={() => setViewMode("table")}
          >
            Tableau
          </button>
          <button className="ff-btn" style={{ background: "var(--bg)", color: "var(--text)", padding: "8px 14px", fontSize: 12, border: "1px solid var(--border)" }} onClick={onBack}>
            Retour
          </button>
        </div>
      </div>

      {/* Sector pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          className="ff-btn"
          style={{ padding: "6px 14px", fontSize: 12, borderRadius: 20, background: !selectedSector ? "var(--accent)" : "var(--bg)", color: !selectedSector ? "#fff" : "var(--text)", border: "1px solid var(--border)" }}
          onClick={() => setSelectedSector("")}
        >
          Tous
        </button>
        {sectorSummary.map(s => (
          <button
            key={s.sector}
            className="ff-btn"
            style={{
              padding: "6px 14px", fontSize: 12, borderRadius: 20,
              background: selectedSector === s.sector ? SECTOR_COLORS[s.sector] : "var(--bg)",
              color: selectedSector === s.sector ? "#fff" : "var(--text)",
              border: `1px solid ${selectedSector === s.sector ? SECTOR_COLORS[s.sector] : "var(--border)"}`,
            }}
            onClick={() => setSelectedSector(selectedSector === s.sector ? "" : s.sector)}
          >
            {s.sector}
            {s.avg != null && (
              <span style={{ marginLeft: 6, fontWeight: 700, color: selectedSector === s.sector ? "#fff" : (s.avg >= 0 ? "var(--green)" : "var(--red)") }}>
                {s.avg >= 0 ? "+" : ""}{s.avg.toFixed(1)}%
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && Object.keys(stockData).length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
          <div className="spinner" />
          <p style={{ color: "var(--accent)", fontWeight: 700, marginTop: 16 }}>Chargement des données de marché…</p>
        </div>
      ) : viewMode === "treemap" ? (
        <div className="card" ref={containerRef} style={{ padding: 12 }}>
          <Treemap data={treemapData} width={containerWidth - 24} height={Math.max(400, containerWidth * 0.5)} />
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            {[
              { label: "> +3%", color: "#059669" },
              { label: "+1-3%", color: "#10b981" },
              { label: "0-1%", color: "#6ee7b7" },
              { label: "0 à -1%", color: "#fca5a5" },
              { label: "-1 à -3%", color: "#ef4444" },
              { label: "< -3%", color: "#dc2626" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Table view */
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="ff-table">
              <thead>
                <tr>
                  <th>Symbole</th>
                  <th>Secteur</th>
                  <th style={{ textAlign: "right" }}>Prix</th>
                  <th style={{ textAlign: "right" }}>Variation</th>
                </tr>
              </thead>
              <tbody>
                {treemapData
                  .filter(d => d.change != null)
                  .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
                  .map(d => (
                    <tr key={d.symbol} style={{ cursor: "pointer" }} onClick={() => onSelect(d.symbol)}>
                      <td style={{ fontWeight: 700, color: "var(--accent)" }}>{d.symbol}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>{d.sector}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{d.price?.toFixed(2) ?? "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: (d.change ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>
                        {d.change != null ? `${d.change >= 0 ? "+" : ""}${d.change.toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

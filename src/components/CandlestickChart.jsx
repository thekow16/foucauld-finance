import { useState, useEffect, useRef, useMemo } from "react";
import { createChart, ColorType, LineStyle, CandlestickSeries, LineSeries } from "lightweight-charts";
import { fetchCandleData } from "../utils/api";
import { computeSMA, computeBollingerBands } from "../utils/indicators";

const TIMEFRAMES = [
  { id: "monthly", label: "Mensuel", interval: "1mo", range: "max" },
  { id: "quarterly", label: "Trimestriel", interval: "3mo", range: "max" },
];

export default function CandlestickChart({ symbol, dark, currency }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [candleData, setCandleData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[0]);
  const [showMA50, setShowMA50] = useState(true);
  const [showMA200, setShowMA200] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);

  // Fetch data when symbol or timeframe changes
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    fetchCandleData(symbol, timeframe.interval, timeframe.range)
      .then(d => { if (!cancelled) setCandleData(d); })
      .catch(() => { if (!cancelled) setCandleData([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, timeframe]);

  // Compute indicators
  const ma50Data = useMemo(() => showMA50 ? computeSMA(candleData, 50) : [], [candleData, showMA50]);
  const ma200Data = useMemo(() => showMA200 ? computeSMA(candleData, 200) : [], [candleData, showMA200]);
  const bollinger = useMemo(() => showBollinger ? computeBollingerBands(candleData) : { upper: [], middle: [], lower: [] }, [candleData, showBollinger]);

  // Create/recreate chart
  useEffect(() => {
    if (!chartContainerRef.current || candleData.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: dark ? "#1e293b" : "#ffffff" },
        textColor: dark ? "#94a3b8" : "#64748b",
        fontFamily: "'Outfit', sans-serif",
      },
      grid: {
        vertLines: { color: dark ? "#334155" : "#e8ecff" },
        horzLines: { color: dark ? "#334155" : "#e8ecff" },
      },
      timeScale: { borderColor: dark ? "#334155" : "#e8ecff" },
      rightPriceScale: { borderColor: dark ? "#334155" : "#e8ecff" },
    });
    chartRef.current = chart;

    // Candlestick series (v5 API)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#10b981",
      wickDownColor: "#ef4444",
      wickUpColor: "#10b981",
    });
    candleSeries.setData(candleData);

    // MA50
    if (ma50Data.length > 0) {
      const s = chart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 2, title: "MA50" });
      s.setData(ma50Data);
    }

    // MA200
    if (ma200Data.length > 0) {
      const s = chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 2, title: "MA200" });
      s.setData(ma200Data);
    }

    // Bollinger Bands
    if (bollinger.upper.length > 0) {
      const sU = chart.addSeries(LineSeries, { color: "#8b5cf6", lineWidth: 1, lineStyle: LineStyle.Dashed, title: "BB Sup" });
      sU.setData(bollinger.upper);
      const sM = chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 1, title: "BB Moy" });
      sM.setData(bollinger.middle);
      const sL = chart.addSeries(LineSeries, { color: "#8b5cf6", lineWidth: 1, lineStyle: LineStyle.Dashed, title: "BB Inf" });
      sL.setData(bollinger.lower);
    }

    chart.timeScale().fitContent();

    // Resize handling
    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    });
    ro.observe(chartContainerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [candleData, dark, ma50Data, ma200Data, bollinger]);

  if (!symbol) return null;

  const toggleStyle = {
    display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer",
    color: "var(--text-secondary)", fontWeight: 600, userSelect: "none",
  };

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <span className="section-title">Chandeliers Japonais</span>
        <div style={{ display: "flex", gap: 4 }}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.id}
              className={`period-btn${timeframe.id === tf.id ? " active" : ""}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
        <label style={toggleStyle}>
          <input type="checkbox" checked={showMA50} onChange={() => setShowMA50(v => !v)} />
          <span style={{ color: "#3b82f6", fontWeight: 700 }}>MA 50</span>
        </label>
        <label style={toggleStyle}>
          <input type="checkbox" checked={showMA200} onChange={() => setShowMA200(v => !v)} />
          <span style={{ color: "#f97316", fontWeight: 700 }}>MA 200</span>
          {showMA200 && candleData.length > 0 && candleData.length < 200 && (
            <span style={{ color: "var(--muted)", fontSize: 11, fontStyle: "italic" }}>(données insuffisantes)</span>
          )}
        </label>
        <label style={toggleStyle}>
          <input type="checkbox" checked={showBollinger} onChange={() => setShowBollinger(v => !v)} />
          <span style={{ color: "#8b5cf6", fontWeight: 700 }}>Bollinger</span>
        </label>
      </div>

      {loading ? (
        <div style={{ height: 420, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="spinner" />
        </div>
      ) : candleData.length > 0 ? (
        <div ref={chartContainerRef} />
      ) : (
        <div style={{ height: 420, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14 }}>
          Données chandeliers indisponibles
        </div>
      )}
    </div>
  );
}

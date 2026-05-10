import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createChart, ColorType, LineStyle, CandlestickSeries, LineSeries } from "lightweight-charts";
import { fetchCandleData } from "../utils/api";
import { computeSMA, computeBollingerBands } from "../utils/indicators";

const TIMEFRAMES = [
  { id: "monthly", label: "Mensuel", interval: "1mo", range: "max" },
  { id: "quarterly", label: "Trimestriel", interval: "1mo", range: "max", aggregate: "quarter" },
];

function aggregateToQuarters(data) {
  if (!data.length) return [];
  const quarters = {};
  for (const c of data) {
    const d = new Date(c.time);
    const q = Math.floor(d.getMonth() / 3);
    const key = `${d.getFullYear()}-Q${q}`;
    const qStart = `${d.getFullYear()}-${String(q * 3 + 1).padStart(2, "0")}-01`;
    if (!quarters[key]) {
      quarters[key] = { time: qStart, open: c.open, high: c.high, low: c.low, close: c.close };
    } else {
      const qr = quarters[key];
      qr.high = Math.max(qr.high, c.high);
      qr.low = Math.min(qr.low, c.low);
      qr.close = c.close;
    }
  }
  return Object.values(quarters).sort((a, b) => a.time.localeCompare(b.time));
}

export default function CandlestickChart({ symbol, dark, currency }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const [candleData, setCandleData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[0]);
  const [showMA50, setShowMA50] = useState(true);
  const [showMA200, setShowMA200] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);

  // Measure tool state
  const [measureMode, setMeasureMode] = useState(false);
  const [measureStart, setMeasureStart] = useState(null); // { time, price }
  const [measureEnd, setMeasureEnd] = useState(null);
  const [measureHover, setMeasureHover] = useState(null); // live preview while hovering

  // Fetch data when symbol or timeframe changes
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    setMeasureStart(null);
    setMeasureEnd(null);
    setMeasureHover(null);
    fetchCandleData(symbol, timeframe.interval, timeframe.range)
      .then(d => { if (!cancelled) setCandleData(timeframe.aggregate === "quarter" ? aggregateToQuarters(d) : d); })
      .catch((err) => { if (!cancelled) { setCandleData([]); setFetchError(err.message || "Erreur de chargement"); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, timeframe]);

  // Compute indicators
  const ma50Data = useMemo(() => showMA50 ? computeSMA(candleData, 50) : [], [candleData, showMA50]);
  const ma200Data = useMemo(() => showMA200 ? computeSMA(candleData, 200) : [], [candleData, showMA200]);
  const bollinger = useMemo(() => showBollinger ? computeBollingerBands(candleData) : { upper: [], middle: [], lower: [] }, [candleData, showBollinger]);

  // Handle chart click for measure tool
  const handleChartClick = useCallback((param) => {
    if (!measureMode || !param.point || !param.time) return;
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series) return;

    const price = series.coordinateToPrice(param.point.y);
    if (price == null) return;

    const point = { time: param.time, price, x: param.point.x, y: param.point.y };

    if (!measureStart || measureEnd) {
      // First click or reset
      setMeasureStart(point);
      setMeasureEnd(null);
      setMeasureHover(null);
    } else {
      // Second click
      setMeasureEnd(point);
      setMeasureHover(null);
    }
  }, [measureMode, measureStart, measureEnd]);

  // Handle crosshair move for live preview
  const handleCrosshairMove = useCallback((param) => {
    if (!measureMode || !measureStart || measureEnd) return;
    if (!param.point || !param.time) { setMeasureHover(null); return; }
    const series = candleSeriesRef.current;
    if (!series) return;
    const price = series.coordinateToPrice(param.point.y);
    if (price == null) return;
    setMeasureHover({ time: param.time, price, x: param.point.x, y: param.point.y });
  }, [measureMode, measureStart, measureEnd]);

  // Create/recreate chart
  useEffect(() => {
    if (!chartContainerRef.current || candleData.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: dark ? "#1e293b" : "#ffffff" },
        textColor: dark ? "#94a3b8" : "#64748b",
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: dark ? "#334155" : "#e8ecff" },
        horzLines: { color: dark ? "#334155" : "#e8ecff" },
      },
      crosshair: {
        mode: 0, // Normal mode
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
    candleSeriesRef.current = candleSeries;

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

    // Subscribe to events for measure tool
    chart.subscribeClick(handleChartClick);
    chart.subscribeCrosshairMove(handleCrosshairMove);

    // Resize handling
    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    });
    ro.observe(chartContainerRef.current);

    return () => {
      chart.unsubscribeClick(handleChartClick);
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      ro.disconnect();
      chart.remove();
    };
  }, [candleData, dark, ma50Data, ma200Data, bollinger, handleChartClick, handleCrosshairMove]);

  // Compute measure display
  const measureInfo = useMemo(() => {
    const endPoint = measureEnd || measureHover;
    if (!measureStart || !endPoint) return null;
    const diff = endPoint.price - measureStart.price;
    const pct = (diff / measureStart.price) * 100;
    const isUp = diff >= 0;
    return { diff, pct, isUp, startPrice: measureStart.price, endPrice: endPoint.price };
  }, [measureStart, measureEnd, measureHover]);

  if (!symbol) return null;

  const toggleStyle = {
    display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer",
    color: "var(--text-secondary)", fontWeight: 600, userSelect: "none",
  };

  const clearMeasure = () => {
    setMeasureStart(null);
    setMeasureEnd(null);
    setMeasureHover(null);
  };

  const toggleMeasure = () => {
    if (measureMode) {
      setMeasureMode(false);
      clearMeasure();
    } else {
      setMeasureMode(true);
    }
  };

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <span className="section-title">Chandeliers Japonais</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className={`measure-btn${measureMode ? " active" : ""}`}
            onClick={toggleMeasure}
            title="Outil de mesure"
          >
            📏 Mesurer
          </button>
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

      {measureMode && (
        <div className="measure-banner">
          {!measureStart
            ? "Cliquez sur le graphique pour placer le point de départ"
            : !measureEnd
              ? "Cliquez pour placer le point d'arrivée"
              : "Mesure terminée — cliquez sur Mesurer pour recommencer"
          }
        </div>
      )}

      {measureInfo && (
        <div className={`measure-result ${measureInfo.isUp ? "up" : "down"}`}>
          <span className="measure-label">
            {measureInfo.startPrice.toFixed(2)} → {measureInfo.endPrice.toFixed(2)} {currency}
          </span>
          <span className="measure-diff">
            {measureInfo.isUp ? "▲" : "▼"} {Math.abs(measureInfo.diff).toFixed(2)} {currency}
          </span>
          <span className="measure-pct">
            ({measureInfo.isUp ? "+" : ""}{measureInfo.pct.toFixed(2)} %)
          </span>
          {measureEnd && (
            <button className="measure-clear" onClick={clearMeasure} title="Effacer">×</button>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ height: 420, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="spinner" />
        </div>
      ) : candleData.length > 0 ? (
        <div ref={chartContainerRef} style={{ cursor: measureMode ? "crosshair" : "default" }} />
      ) : (
        <div style={{ height: 420, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14, gap: 8 }}>
          <span>{fetchError ? "Erreur de chargement des chandeliers" : "Données chandeliers indisponibles"}</span>
          {fetchError && <span style={{ fontSize: 12 }}>{fetchError}</span>}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchCandleData } from "../utils/api";
import { computeSMA } from "../utils/indicators";

const STORAGE_KEY = "ff_ma_alerts";
const PRICE_ALERTS_KEY = "ff_price_alerts";
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 min

function loadAlerts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch { return {}; }
}

function saveAlerts(alerts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

function loadPriceAlerts() {
  try {
    return JSON.parse(localStorage.getItem(PRICE_ALERTS_KEY) || "[]");
  } catch { return []; }
}

function savePriceAlerts(alerts) {
  localStorage.setItem(PRICE_ALERTS_KEY, JSON.stringify(alerts));
}

/**
 * Vérifie si le prix croise une moyenne mobile
 * Retourne "above" si prix vient de passer au-dessus, "below" si en dessous, null sinon
 */
function detectCross(candles, period) {
  const sma = computeSMA(candles, period);
  if (sma.length < 2 || candles.length < 2) return null;
  const lastSMA = sma[sma.length - 1].value;
  const prevSMA = sma[sma.length - 2].value;
  const lastClose = candles[candles.length - 1].close;
  const prevClose = candles[candles.length - 2].close;

  if (prevClose <= prevSMA && lastClose > lastSMA) return "above";
  if (prevClose >= prevSMA && lastClose < lastSMA) return "below";
  return null;
}

/**
 * Calcule la distance en % entre le prix et la MA
 */
function distanceToMA(candles, period) {
  const sma = computeSMA(candles, period);
  if (sma.length === 0) return null;
  const lastSMA = sma[sma.length - 1].value;
  const lastClose = candles[candles.length - 1].close;
  return ((lastClose - lastSMA) / lastSMA) * 100;
}

export function useAlerts(watchlist) {
  // alerts: { [symbol]: { ma50: bool, ma200: bool } }
  const [alerts, setAlerts] = useState(loadAlerts);
  // triggered: [{ symbol, ma, direction, price, maValue, time }]
  const [triggered, setTriggered] = useState([]);
  // maData: { [symbol]: { price, ma50, ma200, dist50, dist200 } }
  const [maData, setMaData] = useState({});
  const [checking, setChecking] = useState(false);
  const intervalRef = useRef(null);
  // Price threshold alerts: [{ id, symbol, type: "above"|"below", target, triggered: bool }]
  const [priceAlerts, setPriceAlertsState] = useState(loadPriceAlerts);

  // Persister les alertes
  useEffect(() => { saveAlerts(alerts); }, [alerts]);
  useEffect(() => { savePriceAlerts(priceAlerts); }, [priceAlerts]);

  const toggleAlert = useCallback((symbol, ma) => {
    setAlerts(prev => {
      const current = prev[symbol] || { ma50: false, ma200: false };
      return { ...prev, [symbol]: { ...current, [ma]: !current[ma] } };
    });
  }, []);

  const getAlerts = useCallback((symbol) => {
    return alerts[symbol] || { ma50: false, ma200: false };
  }, [alerts]);

  const dismissTriggered = useCallback((index) => {
    setTriggered(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Price alert CRUD
  const setPriceAlert = useCallback((symbol, type, target) => {
    setPriceAlertsState(prev => [...prev, {
      id: Date.now() + Math.random(),
      symbol: symbol.toUpperCase(),
      type, // "above" | "below"
      target: Number(target),
      triggered: false,
    }]);
  }, []);

  const removePriceAlert = useCallback((id) => {
    setPriceAlertsState(prev => prev.filter(a => a.id !== id));
  }, []);

  const checkAlerts = useCallback(async () => {
    // MA alerts: check symbols with active MA alerts
    const symbolsToCheck = watchlist
      .map(w => w.symbol)
      .filter(sym => {
        const a = alerts[sym];
        return a && (a.ma50 || a.ma200);
      });

    // Price alerts: also check symbols with active price alerts
    const priceAlertSymbols = priceAlerts.filter(a => !a.triggered).map(a => a.symbol);
    const allSymbols = [...new Set([...symbolsToCheck, ...priceAlertSymbols])];

    if (allSymbols.length === 0) return;
    setChecking(true);

    const newTriggered = [];
    const newMaData = {};
    const priceAlertUpdates = [];

    await Promise.allSettled(allSymbols.map(async (sym) => {
      try {
        const candles = await fetchCandleData(sym, "1d", "1y");
        if (candles.length < 10) return;

        const lastClose = candles[candles.length - 1].close;
        const sma50 = computeSMA(candles, 50);
        const sma200 = computeSMA(candles, 200);
        const ma50Val = sma50.length > 0 ? sma50[sma50.length - 1].value : null;
        const ma200Val = sma200.length > 0 ? sma200[sma200.length - 1].value : null;

        newMaData[sym] = {
          price: lastClose,
          ma50: ma50Val,
          ma200: ma200Val,
          dist50: distanceToMA(candles, 50),
          dist200: distanceToMA(candles, 200),
        };

        // MA alerts
        const a = alerts[sym];
        if (a?.ma50) {
          const cross = detectCross(candles, 50);
          if (cross) {
            newTriggered.push({
              symbol: sym, ma: "MA50", direction: cross,
              price: lastClose, maValue: ma50Val, time: Date.now(),
            });
          }
        }
        if (a?.ma200) {
          const cross = detectCross(candles, 200);
          if (cross) {
            newTriggered.push({
              symbol: sym, ma: "MA200", direction: cross,
              price: lastClose, maValue: ma200Val, time: Date.now(),
            });
          }
        }

        // Price threshold alerts
        priceAlerts.filter(pa => pa.symbol === sym && !pa.triggered).forEach(pa => {
          const hit = (pa.type === "above" && lastClose >= pa.target) ||
                      (pa.type === "below" && lastClose <= pa.target);
          if (hit) {
            priceAlertUpdates.push(pa.id);
            newTriggered.push({
              symbol: sym,
              ma: `Prix ${pa.type === "above" ? "≥" : "≤"} ${pa.target.toFixed(2)}`,
              direction: pa.type,
              price: lastClose,
              maValue: pa.target,
              time: Date.now(),
            });
          }
        });
      } catch (e) {
        console.warn(`[FF] Alert check failed for ${sym}:`, e.message);
      }
    }));

    setMaData(prev => ({ ...prev, ...newMaData }));
    if (newTriggered.length > 0) {
      setTriggered(prev => [...newTriggered, ...prev]);
    }
    // Mark triggered price alerts
    if (priceAlertUpdates.length > 0) {
      setPriceAlertsState(prev => prev.map(a =>
        priceAlertUpdates.includes(a.id) ? { ...a, triggered: true } : a
      ));
    }
    setChecking(false);
  }, [watchlist, alerts, priceAlerts]);

  // Vérification périodique
  useEffect(() => {
    checkAlerts();
    intervalRef.current = setInterval(checkAlerts, CHECK_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [checkAlerts]);

  // Nettoyer les alertes des symboles retirés de la watchlist
  useEffect(() => {
    const syms = new Set(watchlist.map(w => w.symbol));
    setAlerts(prev => {
      const cleaned = {};
      for (const [k, v] of Object.entries(prev)) {
        if (syms.has(k)) cleaned[k] = v;
      }
      return cleaned;
    });
  }, [watchlist]);

  return {
    alerts, toggleAlert, getAlerts,
    triggered, dismissTriggered,
    maData, checking, checkAlerts,
    priceAlerts, setPriceAlert, removePriceAlert,
  };
}

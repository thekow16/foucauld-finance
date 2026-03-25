import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "alphaview-portfolio";

function loadPortfolio() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

function savePortfolio(positions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

export function usePortfolio() {
  const [positions, setPositions] = useState(loadPortfolio);

  useEffect(() => { savePortfolio(positions); }, [positions]);

  const addPosition = useCallback((symbol, name, quantity, buyPrice, date) => {
    setPositions(prev => [...prev, {
      id: Date.now() + Math.random(),
      symbol: symbol.toUpperCase(),
      name,
      quantity: Number(quantity),
      buyPrice: Number(buyPrice),
      date: date || new Date().toISOString().slice(0, 10),
    }]);
  }, []);

  const removePosition = useCallback((id) => {
    setPositions(prev => prev.filter(p => p.id !== id));
  }, []);

  const updatePosition = useCallback((id, updates) => {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const getSymbols = useCallback(() => {
    return [...new Set(positions.map(p => p.symbol))];
  }, [positions]);

  return { positions, addPosition, removePosition, updatePosition, getSymbols };
}

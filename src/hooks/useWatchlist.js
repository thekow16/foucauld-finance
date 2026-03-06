import { useState, useEffect } from "react";

const STORAGE_KEY = "foucauld-watchlist";

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  const addToWatchlist = (symbol, name) => {
    setWatchlist(prev => {
      if (prev.some(w => w.symbol === symbol)) return prev;
      return [...prev, { symbol, name, addedAt: Date.now() }];
    });
  };

  const removeFromWatchlist = (symbol) => {
    setWatchlist(prev => prev.filter(w => w.symbol !== symbol));
  };

  const isInWatchlist = (symbol) => watchlist.some(w => w.symbol === symbol);

  return { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist };
}

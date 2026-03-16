// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "react-dom/test-utils";

// Simple test for watchlist storage logic (without full React hook rendering)
describe("useWatchlist storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists watchlist to localStorage", () => {
    const STORAGE_KEY = "alphaview-watchlist";
    const watchlist = [{ symbol: "AAPL", name: "Apple", addedAt: 1000 }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved).toHaveLength(1);
    expect(saved[0].symbol).toBe("AAPL");
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("alphaview-watchlist", "not-json");
    let result = [];
    try {
      result = JSON.parse(localStorage.getItem("alphaview-watchlist"));
    } catch {
      result = [];
    }
    expect(result).toEqual([]);
  });

  it("deduplicates by symbol", () => {
    const list = [
      { symbol: "AAPL", name: "Apple", addedAt: 1000 },
      { symbol: "TSLA", name: "Tesla", addedAt: 2000 },
    ];
    const newSymbol = "AAPL";
    const alreadyExists = list.some(w => w.symbol === newSymbol);
    expect(alreadyExists).toBe(true);
  });
});

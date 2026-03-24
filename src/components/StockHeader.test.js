// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import StockHeader from "./StockHeader";

const mockData = {
  price: {
    shortName: "Apple Inc.",
    regularMarketPrice: { raw: 175.50 },
    regularMarketChange: { raw: 2.30 },
    regularMarketChangePercent: { raw: 0.0133 },
    regularMarketVolume: { raw: 55000000 },
    regularMarketTime: Math.floor(Date.now() / 1000),
    currency: "USD",
    exchangeName: "NASDAQ",
  },
  assetProfile: {
    sector: "Technology",
    industry: "Consumer Electronics",
    country: "United States",
    website: "https://apple.com",
  },
};

describe("StockHeader", () => {
  it("renders stock name and price", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(createElement(StockHeader, {
        data: mockData,
        symbol: "AAPL",
        fetchedAt: Date.now(),
        isInWatchlist: () => false,
        onToggleWatchlist: vi.fn(),
      }));
    });
    expect(container.textContent).toContain("Apple Inc.");
    expect(container.textContent).toContain("175.50");
    expect(container.textContent).toContain("AAPL");
    root.unmount();
  });

  it("shows up arrow for positive change", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(createElement(StockHeader, {
        data: mockData,
        symbol: "AAPL",
        fetchedAt: Date.now(),
        isInWatchlist: () => false,
        onToggleWatchlist: vi.fn(),
      }));
    });
    expect(container.textContent).toContain("▲");
    root.unmount();
  });

  it("watchlist button has accessible aria attributes", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(createElement(StockHeader, {
        data: mockData,
        symbol: "AAPL",
        fetchedAt: Date.now(),
        isInWatchlist: () => true,
        onToggleWatchlist: vi.fn(),
      }));
    });
    const btn = container.querySelector(".watchlist-btn");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.getAttribute("aria-label")).toContain("Retirer AAPL des favoris");
    root.unmount();
  });

  it("calls onToggleWatchlist when star is clicked", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onToggle = vi.fn();
    act(() => {
      root.render(createElement(StockHeader, {
        data: mockData,
        symbol: "AAPL",
        fetchedAt: Date.now(),
        isInWatchlist: () => false,
        onToggleWatchlist: onToggle,
      }));
    });
    const btn = container.querySelector(".watchlist-btn");
    act(() => { btn.click(); });
    expect(onToggle).toHaveBeenCalledWith("AAPL", "Apple Inc.");
    root.unmount();
  });
});

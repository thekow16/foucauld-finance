// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import RatiosTab from "./RatiosTab";

const mockData = {
  price: {
    regularMarketPrice: { raw: 150 },
    marketCap: { raw: 2.5e12 },
    currency: "USD",
  },
  defaultKeyStatistics: {
    trailingPE: { raw: 28.5 },
    forwardPE: { raw: 24.0 },
    pegRatio: { raw: 1.2 },
    priceToBook: { raw: 45.0 },
    enterpriseValue: { raw: 2.6e12 },
    enterpriseToEbitda: { raw: 20.5 },
    enterpriseToRevenue: { raw: 6.8 },
    trailingEps: { raw: 5.26 },
    forwardEps: { raw: 6.25 },
    sharesOutstanding: { raw: 15.7e9 },
    beta: { raw: 1.2 },
  },
  financialData: {
    grossMargins: { raw: 0.45 },
    operatingMargins: { raw: 0.30 },
    profitMargins: { raw: 0.25 },
    returnOnEquity: { raw: 0.15 },
    returnOnAssets: { raw: 0.08 },
    currentRatio: { raw: 1.8 },
    debtToEquity: { raw: 95.5 },
    totalRevenue: { raw: 380e9 },
    freeCashflow: { raw: 95e9 },
    operatingCashflow: { raw: 120e9 },
    totalCash: { raw: 50e9 },
    totalDebt: { raw: 110e9 },
    ebitda: { raw: 130e9 },
    revenueGrowth: { raw: 0.08 },
    earningsGrowth: { raw: 0.12 },
  },
  summaryDetail: {
    dividendYield: { raw: 0.005 },
    dividendRate: { raw: 0.96 },
    payoutRatio: { raw: 0.15 },
  },
};

describe("RatiosTab", () => {
  it("renders all 6 ratio sections", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => { root.render(createElement(RatiosTab, { data: mockData })); });
    const cats = container.querySelectorAll(".ratio-cat");
    expect(cats.length).toBe(6);
    const catNames = Array.from(cats).map(c => c.textContent);
    expect(catNames).toContain("Valorisation");
    expect(catNames).toContain("Rentabilité");
    expect(catNames).toContain("Solidité financière");
    expect(catNames).toContain("Croissance & Dividende");
    expect(catNames).toContain("Données de marché");
    expect(catNames).toContain("Structure du capital");
    root.unmount();
  });

  it("displays formatted P/E value", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => { root.render(createElement(RatiosTab, { data: mockData })); });
    expect(container.textContent).toContain("28.50");
    root.unmount();
  });

  it("shows dash for missing values", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => { root.render(createElement(RatiosTab, { data: { price: {}, defaultKeyStatistics: {}, financialData: {}, summaryDetail: {} } })); });
    const muted = container.querySelectorAll(".muted");
    expect(muted.length).toBeGreaterThan(0);
    root.unmount();
  });
});

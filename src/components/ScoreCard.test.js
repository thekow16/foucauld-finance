// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import ScoreCard from "./ScoreCard";

const makeData = (overrides = {}) => ({
  financialData: {
    revenueGrowth: { raw: 0.20 },
    freeCashflow: { raw: 5e9 },
    totalRevenue: { raw: 20e9 },
    totalDebt: { raw: 2e9 },
    returnOnEquity: { raw: 0.25 },
    ...overrides.financialData,
  },
  cashflowStatementHistory: {
    cashflowStatements: [
      { freeCashFlow: { raw: 5e9 } },
      { freeCashFlow: { raw: 4e9 } },
    ],
  },
  balanceSheetHistory: {
    balanceSheetStatements: [
      { totalStockholderEquity: { raw: 10e9 }, cash: { raw: 3e9 }, longTermDebt: { raw: 2e9 } },
    ],
  },
  incomeStatementHistory: {
    incomeStatementHistory: [
      { operatingIncome: { raw: 6e9 }, dilutedShares: { raw: 1e9 } },
      { dilutedShares: { raw: 1.05e9 } },
    ],
  },
  ...overrides,
});

describe("ScoreCard", () => {
  it("renders null when no data", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => { root.render(createElement(ScoreCard, { data: {} })); });
    expect(container.innerHTML).toBe("");
    root.unmount();
  });

  it("renders score and label when given valid data", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => { root.render(createElement(ScoreCard, { data: makeData() })); });
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.textContent).toMatch(/Score santé financière/);
    root.unmount();
  });

  it("has accessible SVG with aria-label", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => { root.render(createElement(ScoreCard, { data: makeData() })); });
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toContain("Score santé financière");
    root.unmount();
  });
});

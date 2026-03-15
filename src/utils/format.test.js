import { describe, it, expect } from "vitest";
import { fmt, getScoreDetails, getScore, getScoreColor, getScoreLabel } from "./format";

describe("fmt", () => {
  it("returns — for null/undefined/NaN", () => {
    expect(fmt(null)).toBe("—");
    expect(fmt(undefined)).toBe("—");
    expect(fmt(NaN)).toBe("—");
  });

  it("formats numbers with 2 decimals by default", () => {
    expect(fmt(3.14159)).toBe("3.14");
    expect(fmt(0)).toBe("0.00");
  });

  it("formats currency with T/Md/M suffixes", () => {
    expect(fmt(2.5e12, "currency")).toBe("2.50 T");
    expect(fmt(1.2e9, "currency")).toBe("1.20 Md");
    expect(fmt(45e6, "currency")).toBe("45.00 M");
    expect(fmt(12345, "currency")).toMatch(/12/);
  });

  it("formats negative currency correctly", () => {
    expect(fmt(-3e9, "currency")).toBe("-3.00 Md");
    expect(fmt(-50e6, "currency")).toBe("-50.00 M");
  });

  it("formats percent", () => {
    expect(fmt(0.1523, "percent")).toBe("15.23 %");
    expect(fmt(-0.05, "percent")).toBe("-5.00 %");
  });

  it("formats ratio", () => {
    expect(fmt(1.5678, "ratio")).toBe("1.57");
  });
});

describe("getScoreDetails", () => {
  it("returns null when no financialData", () => {
    expect(getScoreDetails({})).toBeNull();
    expect(getScoreDetails(null)).toBeNull();
  });

  it("returns a score between 0 and 100", () => {
    const data = {
      financialData: {
        revenueGrowth: { raw: 0.20 },
        freeCashflow: { raw: 5e9 },
        totalRevenue: { raw: 20e9 },
        totalDebt: { raw: 2e9 },
        returnOnEquity: { raw: 0.25 },
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
    };
    const result = getScoreDetails(data);
    expect(result).not.toBeNull();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.details).toHaveProperty("revenueGrowth");
    expect(result.details).toHaveProperty("fcfGrowth");
    expect(result.details).toHaveProperty("roic");
    expect(result.details).toHaveProperty("netDebtFcf");
    expect(result.details).toHaveProperty("sharesChange");
    expect(result.details).toHaveProperty("fcfMargin");
  });
});

describe("getScore", () => {
  it("returns null when no data", () => {
    expect(getScore(null, null, {})).toBeNull();
  });
});

describe("getScoreColor", () => {
  it("returns green for >= 70", () => {
    expect(getScoreColor(85)).toBe("#10b981");
  });
  it("returns amber for 50-69", () => {
    expect(getScoreColor(60)).toBe("#f59e0b");
  });
  it("returns red for < 50", () => {
    expect(getScoreColor(30)).toBe("#ef4444");
  });
});

describe("getScoreLabel", () => {
  it("returns correct labels", () => {
    expect(getScoreLabel(80)).toBe("Excellente");
    expect(getScoreLabel(60)).toBe("Bonne");
    expect(getScoreLabel(45)).toBe("Correcte");
    expect(getScoreLabel(20)).toBe("Fragile");
  });
});

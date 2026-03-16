import { describe, it, expect } from "vitest";
import { compact, cagr, buildSeries, getCurrencySymbol } from "./KeyMetricsCharts";

describe("compact", () => {
  it("returns — for null/NaN", () => {
    expect(compact(null)).toBe("—");
    expect(compact(NaN)).toBe("—");
    expect(compact(undefined)).toBe("—");
  });

  it("formats trillions", () => {
    expect(compact(2.5e12)).toBe("2.5 T");
  });

  it("formats billions (milliards)", () => {
    expect(compact(1.2e9)).toBe("1.2 Md");
  });

  it("formats millions", () => {
    expect(compact(45e6)).toBe("45.0 M");
  });

  it("formats thousands", () => {
    expect(compact(12500)).toBe("12.5 k");
  });

  it("handles negatives", () => {
    expect(compact(-3e9)).toBe("-3.0 Md");
    expect(compact(-500)).toBe("-500.0");
  });

  it("handles small numbers", () => {
    expect(compact(42)).toBe("42.0");
  });
});

describe("cagr", () => {
  it("returns null for less than 2 valid data points", () => {
    expect(cagr([], "revenue")).toBeNull();
    expect(cagr([{ year: "2020", revenue: 100 }], "revenue")).toBeNull();
  });

  it("returns null when first value is <= 0", () => {
    expect(cagr([
      { year: "2020", revenue: -10 },
      { year: "2023", revenue: 100 },
    ], "revenue")).toBeNull();
  });

  it("calculates CAGR correctly for growing revenue", () => {
    const rows = [
      { year: "2020", revenue: 100 },
      { year: "2023", revenue: 133.1 },
    ];
    const result = cagr(rows, "revenue");
    expect(result).toContain("CAGR 3 ans");
    expect(result).toContain("+10.0%");
  });

  it("calculates CAGR for 10% growth over 5 years", () => {
    const rows = [
      { year: "2018", revenue: 100 },
      { year: "2023", revenue: 100 * Math.pow(1.1, 5) },
    ];
    const result = cagr(rows, "revenue");
    expect(result).toContain("5 ans");
    expect(result).toContain("+10.0%");
  });

  it("skips null values in the middle", () => {
    const rows = [
      { year: "2020", revenue: 100 },
      { year: "2021", revenue: null },
      { year: "2022", revenue: 121 },
    ];
    const result = cagr(rows, "revenue");
    expect(result).toContain("CAGR 2 ans");
  });
});

describe("buildSeries", () => {
  it("returns empty array for null data", () => {
    expect(buildSeries(null)).toEqual([]);
    expect(buildSeries({})).toEqual([]);
  });

  it("builds series from Yahoo income + cashflow + balance", () => {
    const data = {
      incomeStatementHistory: {
        incomeStatementHistory: [
          {
            endDate: { raw: 1672531200 }, // 2023-01-01
            totalRevenue: { raw: 1e9 },
            operatingIncome: { raw: 2e8 },
            dilutedAverageShares: { raw: 1e7 },
          },
          {
            endDate: { raw: 1640995200 }, // 2022-01-01
            totalRevenue: { raw: 8e8 },
            operatingIncome: { raw: 1.5e8 },
            dilutedAverageShares: { raw: 1e7 },
          },
        ],
      },
      cashflowStatementHistory: {
        cashflowStatements: [
          {
            endDate: { raw: 1672531200 },
            freeCashFlow: { raw: 1.5e8 },
            stockBasedCompensation: { raw: 2e7 },
            dividendsPaid: { raw: -5e7 },
          },
          {
            endDate: { raw: 1640995200 },
            freeCashFlow: { raw: 1e8 },
          },
        ],
      },
      balanceSheetHistory: {
        balanceSheetStatements: [
          {
            endDate: { raw: 1672531200 },
            totalAssets: { raw: 5e9 },
            cash: { raw: 1e9 },
            totalDebt: { raw: 2e9 },
            totalCurrentLiabilities: { raw: 8e8 },
          },
          {
            endDate: { raw: 1640995200 },
            totalAssets: { raw: 4e9 },
            cash: { raw: 8e8 },
            totalDebt: { raw: 1.8e9 },
            totalCurrentLiabilities: { raw: 7e8 },
          },
        ],
      },
    };

    const rows = buildSeries(data);
    expect(rows.length).toBe(2);
    expect(rows[0].year).toBe("2022");
    expect(rows[1].year).toBe("2023");

    // Check enriched fields
    expect(rows[1].revenue).toBe(1e9);
    expect(rows[1].fcf).toBe(1.5e8);
    expect(rows[1].cash).toBe(1e9);
    expect(rows[1].roce).toBeCloseTo(2e8 / (5e9 - 8e8), 5);
    expect(rows[1].fcfMargin).toBeCloseTo(1.5e8 / 1e9, 5);
    expect(rows[1].fcfPerShare).toBeCloseTo(1.5e8 / 1e7, 5);
    expect(rows[1].dividendPerShare).toBeCloseTo(5e7 / 1e7, 5);
  });

  it("prefers FMP data when available", () => {
    const data = {
      _fmpData: {
        income: [
          { calendarYear: "2023", revenue: 2e9, operatingIncome: 4e8, weightedAverageShsOutDil: 1e7 },
        ],
        cashflow: [
          { calendarYear: "2023", freeCashFlow: 3e8, stockBasedCompensation: 1e7 },
        ],
        balance: [
          { calendarYear: "2023", totalAssets: 8e9, cashAndCashEquivalents: 2e9, totalDebt: 3e9, totalCurrentLiabilities: 1e9 },
        ],
      },
      incomeStatementHistory: { incomeStatementHistory: [] },
      cashflowStatementHistory: { cashflowStatements: [] },
      balanceSheetHistory: { balanceSheetStatements: [] },
    };

    const rows = buildSeries(data);
    expect(rows.length).toBe(1);
    expect(rows[0].revenue).toBe(2e9);
    expect(rows[0].cash).toBe(2e9);
  });
});

describe("getCurrencySymbol", () => {
  it("returns $ for USD", () => {
    expect(getCurrencySymbol("USD")).toBe("$");
  });

  it("returns euro for EUR", () => {
    expect(getCurrencySymbol("EUR")).toBe("€");
  });

  it("returns pound for GBP", () => {
    expect(getCurrencySymbol("GBP")).toBe("£");
  });

  it("returns code + space for unknown currencies", () => {
    expect(getCurrencySymbol("PLN")).toBe("PLN ");
  });

  it("returns $ for falsy input", () => {
    expect(getCurrencySymbol(null)).toBe("$");
    expect(getCurrencySymbol("")).toBe("$");
    expect(getCurrencySymbol(undefined)).toBe("$");
  });
});

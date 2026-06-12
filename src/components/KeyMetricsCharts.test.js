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

  it("rejects non-split-adjusted shares from FMP when Yahoo has split-adjusted data", () => {
    const data = {
      incomeStatementHistory: {
        incomeStatementHistory: [
          { endDate: { raw: 1672531200 }, totalRevenue: { raw: 300e9 }, dilutedAverageShares: { raw: 13.2e9 } },
          { endDate: { raw: 1640995200 }, totalRevenue: { raw: 257e9 }, dilutedAverageShares: { raw: 13.2e9 } },
          { endDate: { raw: 1609459200 }, totalRevenue: { raw: 182e9 }, dilutedAverageShares: { raw: 13.2e9 } },
          { endDate: { raw: 1577836800 }, totalRevenue: { raw: 161e9 }, dilutedAverageShares: { raw: 13.2e9 } },
        ],
      },
      _fmpData: {
        income: [
          { calendarYear: "2021", revenue: 257e9, weightedAverageShsOutDil: 660e6, operatingIncome: 78e9 },
        ],
        cashflow: [],
        balance: [],
      },
      cashflowStatementHistory: { cashflowStatements: [] },
      balanceSheetHistory: { balanceSheetStatements: [] },
    };

    const rows = buildSeries(data);
    const row2021 = rows.find(r => r.year === "2021");
    expect(row2021.shares).toBe(13.2e9);
  });

  it("normalizes non-split-adjusted shares for years only covered by SEC/FMP", () => {
    const data = {
      incomeStatementHistory: {
        incomeStatementHistory: [
          { endDate: { raw: 1672531200 }, totalRevenue: { raw: 300e9 }, dilutedAverageShares: { raw: 13.2e9 } },
          { endDate: { raw: 1640995200 }, totalRevenue: { raw: 257e9 }, dilutedAverageShares: { raw: 13.2e9 } },
          { endDate: { raw: 1577836800 }, totalRevenue: { raw: 161e9 }, dilutedAverageShares: { raw: 13.2e9 } },
        ],
      },
      _fmpData: {
        income: [
          { calendarYear: "2018", revenue: 136e9, weightedAverageShsOutDil: 660e6 },
        ],
        cashflow: [],
        balance: [],
      },
      cashflowStatementHistory: { cashflowStatements: [] },
      balanceSheetHistory: { balanceSheetStatements: [] },
    };

    const rows = buildSeries(data);
    const row2018 = rows.find(r => r.year === "2018");
    expect(row2018.shares).toBeGreaterThan(10e9);
    expect(row2018.shares).toBeLessThan(16e9);
  });

  it("correctly normalizes 25:1 split even with buyback-driven share decline (BKNG)", () => {
    const data = {
      incomeStatementHistory: {
        incomeStatementHistory: [
          { endDate: { raw: 1735689600 }, totalRevenue: { raw: 23e9 }, dilutedAverageShares: { raw: 850e6 } },
          { endDate: { raw: 1704067200 }, totalRevenue: { raw: 21e9 }, dilutedAverageShares: { raw: 913e6 } },
          { endDate: { raw: 1672531200 }, totalRevenue: { raw: 17e9 }, dilutedAverageShares: { raw: 1.0e9 } },
        ],
      },
      _fmpData: {
        income: [
          { calendarYear: "2019", revenue: 15e9, weightedAverageShsOutDil: 43.5e6 },
          { calendarYear: "2018", revenue: 14.5e9, weightedAverageShsOutDil: 48e6 },
          { calendarYear: "2015", revenue: 9.2e9, weightedAverageShsOutDil: 52e6 },
        ],
        cashflow: [],
        balance: [],
      },
      cashflowStatementHistory: { cashflowStatements: [] },
      balanceSheetHistory: { balanceSheetStatements: [] },
    };

    const rows = buildSeries(data);
    const row2015 = rows.find(r => r.year === "2015");
    const row2019 = rows.find(r => r.year === "2019");
    expect(row2015.shares).toBeGreaterThan(1e9);
    expect(row2015.shares).toBeLessThan(1.6e9);
    expect(row2019.shares).toBeGreaterThan(900e6);
    expect(row2019.shares).toBeLessThan(1.3e9);
  });

  it("does not over-correct legitimate share count differences from buybacks", () => {
    const data = {
      incomeStatementHistory: {
        incomeStatementHistory: [
          { endDate: { raw: 1672531200 }, totalRevenue: { raw: 1e9 }, dilutedAverageShares: { raw: 8e9 } },
          { endDate: { raw: 1640995200 }, totalRevenue: { raw: 9e8 }, dilutedAverageShares: { raw: 9e9 } },
          { endDate: { raw: 1609459200 }, totalRevenue: { raw: 8e8 }, dilutedAverageShares: { raw: 10e9 } },
          { endDate: { raw: 1577836800 }, totalRevenue: { raw: 7e8 }, dilutedAverageShares: { raw: 11e9 } },
        ],
      },
      cashflowStatementHistory: { cashflowStatements: [] },
      balanceSheetHistory: { balanceSheetStatements: [] },
    };

    const rows = buildSeries(data);
    expect(rows.find(r => r.year === "2020").shares).toBe(11e9);
    expect(rows.find(r => r.year === "2021").shares).toBe(10e9);
    expect(rows.find(r => r.year === "2022").shares).toBe(9e9);
    expect(rows.find(r => r.year === "2023").shares).toBe(8e9);
  });

  it("detects 2:1 split when FMP has pre-split data", () => {
    const data = {
      incomeStatementHistory: {
        incomeStatementHistory: [
          { endDate: { raw: 1672531200 }, totalRevenue: { raw: 10e9 }, dilutedAverageShares: { raw: 2e9 } },
          { endDate: { raw: 1640995200 }, totalRevenue: { raw: 9e9 }, dilutedAverageShares: { raw: 2e9 } },
        ],
      },
      _fmpData: {
        income: [
          { calendarYear: "2020", revenue: 8e9, weightedAverageShsOutDil: 950e6 },
        ],
        cashflow: [],
        balance: [],
      },
      cashflowStatementHistory: { cashflowStatements: [] },
      balanceSheetHistory: { balanceSheetStatements: [] },
    };

    const rows = buildSeries(data);
    const row2020 = rows.find(r => r.year === "2020");
    expect(row2020.shares).toBeGreaterThan(1.5e9);
    expect(row2020.shares).toBeLessThan(2.5e9);
  });

  it("handles multiple splits in the same dataset", () => {
    const data = {
      incomeStatementHistory: {
        incomeStatementHistory: [
          { endDate: { raw: 1672531200 }, totalRevenue: { raw: 50e9 }, dilutedAverageShares: { raw: 12e9 } },
          { endDate: { raw: 1640995200 }, totalRevenue: { raw: 45e9 }, dilutedAverageShares: { raw: 12e9 } },
        ],
      },
      _fmpData: {
        income: [
          { calendarYear: "2019", revenue: 30e9, weightedAverageShsOutDil: 3e9 },
          { calendarYear: "2015", revenue: 15e9, weightedAverageShsOutDil: 500e6 },
        ],
        cashflow: [],
        balance: [],
      },
      cashflowStatementHistory: { cashflowStatements: [] },
      balanceSheetHistory: { balanceSheetStatements: [] },
    };

    const rows = buildSeries(data);
    const all = rows.map(r => r.shares);
    const min = Math.min(...all);
    const max = Math.max(...all);
    expect(max / min).toBeLessThan(1.5);
  });

  it("uses real split events to pick the exact ratio when heuristic would guess wrong", () => {
    // Jump observé 18.4x : l'heuristique choisirait 20:1 (|18.4/20-1|=0.08),
    // mais le split réel est 25:1 — les événements réels doivent gagner.
    const data = {
      _splitEvents: [{ date: 1775000000, ratio: 25 }],
      incomeStatementHistory: {
        incomeStatementHistory: [
          { endDate: { raw: 1735689600 }, totalRevenue: { raw: 25e9 }, dilutedAverageShares: { raw: 760e6 } },
          { endDate: { raw: 1704067200 }, totalRevenue: { raw: 23e9 }, dilutedAverageShares: { raw: 780e6 } },
          { endDate: { raw: 1672531200 }, totalRevenue: { raw: 21e9 }, dilutedAverageShares: { raw: 800e6 } },
        ],
      },
      _fmpData: {
        income: [
          { calendarYear: "2019", revenue: 15e9, weightedAverageShsOutDil: 43.5e6 },
          { calendarYear: "2018", revenue: 14.5e9, weightedAverageShsOutDil: 48e6 },
        ],
        cashflow: [],
        balance: [],
      },
      cashflowStatementHistory: { cashflowStatements: [] },
      balanceSheetHistory: { balanceSheetStatements: [] },
    };

    const rows = buildSeries(data);
    const row2019 = rows.find(r => r.year === "2019");
    expect(row2019.shares).toBeGreaterThan(1.05e9);
    expect(row2019.shares).toBeLessThan(1.12e9);
    expect(rows.find(r => r.year === "2018").shares).toBe(48e6 * 25);
  });

  it("never corrects shares when real split history shows no splits", () => {
    // Dilution massive réelle (2.2x) : sans info de splits l'heuristique
    // aurait "corrigé" par 2:1 — avec _splitEvents: [] on ne touche à rien.
    const data = {
      _splitEvents: [],
      incomeStatementHistory: {
        incomeStatementHistory: [
          { endDate: { raw: 1672531200 }, totalRevenue: { raw: 3e9 }, dilutedAverageShares: { raw: 235e6 } },
          { endDate: { raw: 1640995200 }, totalRevenue: { raw: 2.5e9 }, dilutedAverageShares: { raw: 230e6 } },
          { endDate: { raw: 1609459200 }, totalRevenue: { raw: 2e9 }, dilutedAverageShares: { raw: 220e6 } },
          { endDate: { raw: 1577836800 }, totalRevenue: { raw: 1e9 }, dilutedAverageShares: { raw: 100e6 } },
        ],
      },
      cashflowStatementHistory: { cashflowStatements: [] },
      balanceSheetHistory: { balanceSheetStatements: [] },
    };

    const rows = buildSeries(data);
    expect(rows.find(r => r.year === "2020").shares).toBe(100e6);
    expect(rows.find(r => r.year === "2021").shares).toBe(220e6);
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

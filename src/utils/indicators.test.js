import { describe, it, expect } from "vitest";
import { computeSMA, computeBollingerBands } from "./indicators";

function makeCandles(closes) {
  return closes.map((c, i) => ({ time: `2024-01-${String(i + 1).padStart(2, "0")}`, close: c }));
}

describe("computeSMA", () => {
  it("returns empty array when data shorter than period", () => {
    expect(computeSMA(makeCandles([1, 2]), 5)).toEqual([]);
  });

  it("computes correct SMA for period 3", () => {
    const data = makeCandles([2, 4, 6, 8, 10]);
    const sma = computeSMA(data, 3);
    expect(sma).toHaveLength(3);
    expect(sma[0].value).toBe(4); // (2+4+6)/3
    expect(sma[1].value).toBe(6); // (4+6+8)/3
    expect(sma[2].value).toBe(8); // (6+8+10)/3
  });

  it("computes correct SMA for period 1 (identity)", () => {
    const data = makeCandles([10, 20, 30]);
    const sma = computeSMA(data, 1);
    expect(sma).toHaveLength(3);
    expect(sma[0].value).toBe(10);
    expect(sma[2].value).toBe(30);
  });

  it("preserves time from input data", () => {
    const data = makeCandles([5, 10, 15]);
    const sma = computeSMA(data, 2);
    expect(sma[0].time).toBe("2024-01-02");
    expect(sma[1].time).toBe("2024-01-03");
  });

  it("handles single element with period 1", () => {
    const sma = computeSMA(makeCandles([42]), 1);
    expect(sma).toHaveLength(1);
    expect(sma[0].value).toBe(42);
  });
});

describe("computeBollingerBands", () => {
  it("returns empty bands when data shorter than period", () => {
    const result = computeBollingerBands(makeCandles([1, 2, 3]), 5);
    expect(result.upper).toEqual([]);
    expect(result.middle).toEqual([]);
    expect(result.lower).toEqual([]);
  });

  it("computes bands with correct length", () => {
    const data = makeCandles(Array.from({ length: 25 }, (_, i) => 100 + i));
    const result = computeBollingerBands(data, 20, 2);
    expect(result.upper).toHaveLength(6); // 25 - 20 + 1
    expect(result.middle).toHaveLength(6);
    expect(result.lower).toHaveLength(6);
  });

  it("middle band equals SMA", () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i);
    const data = makeCandles(closes);
    const bands = computeBollingerBands(data, 20, 2);
    const sma = computeSMA(data, 20);
    expect(bands.middle.length).toBe(sma.length);
    bands.middle.forEach((m, i) => {
      expect(m.value).toBe(sma[i].value);
    });
  });

  it("upper > middle > lower", () => {
    const data = makeCandles([10, 12, 9, 11, 13, 8, 14, 10, 12, 11]);
    const result = computeBollingerBands(data, 5, 2);
    result.upper.forEach((u, i) => {
      expect(u.value).toBeGreaterThan(result.middle[i].value);
      expect(result.middle[i].value).toBeGreaterThan(result.lower[i].value);
    });
  });

  it("constant prices produce upper === lower === middle", () => {
    const data = makeCandles(Array(10).fill(50));
    const result = computeBollingerBands(data, 5, 2);
    result.upper.forEach((u, i) => {
      expect(u.value).toBe(result.middle[i].value);
      expect(result.lower[i].value).toBe(result.middle[i].value);
    });
  });
});

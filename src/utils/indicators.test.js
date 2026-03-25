import { describe, it, expect } from "vitest";
import { computeSMA, computeBollingerBands, computeRSI, computeMACD } from "./indicators";

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

describe("computeRSI", () => {
  it("returns empty array when data too short", () => {
    expect(computeRSI(makeCandles([1, 2, 3]), 14)).toEqual([]);
  });

  it("returns correct number of results", () => {
    // Need period + 1 data points for first RSI value, then one per additional point
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const rsi = computeRSI(makeCandles(closes), 14);
    expect(rsi).toHaveLength(30 - 14); // 16 values
  });

  it("RSI is 100 when prices only go up", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    const rsi = computeRSI(makeCandles(closes), 5);
    rsi.forEach((r) => {
      expect(r.value).toBe(100);
    });
  });

  it("RSI is 0 when prices only go down", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 200 - i);
    const rsi = computeRSI(makeCandles(closes), 5);
    rsi.forEach((r) => {
      expect(r.value).toBe(0);
    });
  });

  it("RSI is between 0 and 100 for mixed data", () => {
    const closes = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84,
      46.08, 45.89, 46.03, 44.72, 44.78, 44.34, 44.87];
    const rsi = computeRSI(makeCandles(closes), 14);
    rsi.forEach((r) => {
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThanOrEqual(100);
    });
  });

  it("preserves time from input data", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i) * 10);
    const rsi = computeRSI(makeCandles(closes), 5);
    // First RSI should be at index 5 (period=5, so data[5])
    expect(rsi[0].time).toBe("2024-01-06");
  });

  it("RSI around 50 for alternating equal gains and losses", () => {
    // Alternating +1 / -1 should give RSI near 50
    const closes = [100];
    for (let i = 1; i < 30; i++) {
      closes.push(closes[i - 1] + (i % 2 === 0 ? -1 : 1));
    }
    const rsi = computeRSI(makeCandles(closes), 14);
    rsi.forEach((r) => {
      expect(r.value).toBeGreaterThan(40);
      expect(r.value).toBeLessThan(60);
    });
  });
});

describe("computeMACD", () => {
  it("returns empty arrays when data too short", () => {
    const result = computeMACD(makeCandles([1, 2, 3]));
    expect(result.macd).toEqual([]);
    expect(result.signal).toEqual([]);
    expect(result.histogram).toEqual([]);
  });

  it("returns correct structure with macd, signal, histogram", () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 3) * 10);
    const result = computeMACD(makeCandles(closes));
    expect(result).toHaveProperty("macd");
    expect(result).toHaveProperty("signal");
    expect(result).toHaveProperty("histogram");
  });

  it("macd line length equals data.length - slowPeriod + 1", () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i);
    const result = computeMACD(makeCandles(closes), 12, 26, 9);
    expect(result.macd).toHaveLength(50 - 26 + 1); // 25
  });

  it("signal and histogram length equals macd.length - signalPeriod + 1", () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i);
    const result = computeMACD(makeCandles(closes), 12, 26, 9);
    const expectedSignalLen = result.macd.length - 9 + 1;
    expect(result.signal).toHaveLength(expectedSignalLen);
    expect(result.histogram).toHaveLength(expectedSignalLen);
  });

  it("histogram equals macd minus signal at each point", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 20);
    const result = computeMACD(makeCandles(closes));
    const signalStart = result.macd.length - result.signal.length;
    result.histogram.forEach((h, i) => {
      const macdVal = result.macd[signalStart + i].value;
      const sigVal = result.signal[i].value;
      expect(h.value).toBeCloseTo(macdVal - sigVal, 3);
    });
  });

  it("MACD is 0 for constant prices", () => {
    const closes = Array(50).fill(100);
    const result = computeMACD(makeCandles(closes));
    result.macd.forEach((m) => {
      expect(m.value).toBeCloseTo(0, 4);
    });
    result.signal.forEach((s) => {
      expect(s.value).toBeCloseTo(0, 4);
    });
    result.histogram.forEach((h) => {
      expect(h.value).toBeCloseTo(0, 4);
    });
  });

  it("preserves time from input data", () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i);
    const result = computeMACD(makeCandles(closes), 12, 26, 9);
    // First MACD value at index slowPeriod - 1 = 25
    expect(result.macd[0].time).toBe("2024-01-26");
  });

  it("supports custom periods", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 50 + i);
    const result = computeMACD(makeCandles(closes), 5, 10, 3);
    expect(result.macd).toHaveLength(30 - 10 + 1); // 21
    const expectedSignalLen = result.macd.length - 3 + 1;
    expect(result.signal).toHaveLength(expectedSignalLen);
  });
});

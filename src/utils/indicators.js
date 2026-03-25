export function computeSMA(data, period) {
  if (data.length < period) return [];
  const result = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;
    if (i >= period) sum -= data[i - period].close;
    if (i >= period - 1) {
      result.push({ time: data[i].time, value: +(sum / period).toFixed(2) });
    }
  }
  return result;
}

export function computeBollingerBands(data, period = 20, multiplier = 2) {
  if (data.length < period) return { upper: [], middle: [], lower: [] };
  const upper = [], middle = [], lower = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
    const mean = sum / period;
    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j++) sqSum += (data[j].close - mean) ** 2;
    const stdDev = Math.sqrt(sqSum / period);
    const t = data[i].time;
    middle.push({ time: t, value: +mean.toFixed(2) });
    upper.push({ time: t, value: +(mean + multiplier * stdDev).toFixed(2) });
    lower.push({ time: t, value: +(mean - multiplier * stdDev).toFixed(2) });
  }
  return { upper, middle, lower };
}

export function computeRSI(data, period = 14) {
  if (data.length < period + 1) return [];

  const result = [];

  // Calculate initial average gain and average loss over the first `period` changes
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  // First RSI value
  const rs0 = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  const rsi0 = avgLoss === 0 ? 100 : +(100 - 100 / (1 + rs0)).toFixed(2);
  result.push({ time: data[period].time, value: rsi0 });

  // Subsequent values using Wilder's smoothing
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    const rsi = avgLoss === 0 ? 100 : +(100 - 100 / (1 + rs)).toFixed(2);
    result.push({ time: data[i].time, value: rsi });
  }

  return result;
}

export function computeMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (data.length < slowPeriod) return { macd: [], signal: [], histogram: [] };

  // Helper: compute EMA multiplier
  const emaMultiplier = (p) => 2 / (p + 1);

  // Compute EMA series from close prices
  function computeEMA(closes, period) {
    const k = emaMultiplier(period);
    const ema = [];
    // Seed with SMA of the first `period` values
    let sum = 0;
    for (let i = 0; i < period; i++) sum += closes[i];
    ema[period - 1] = sum / period;
    for (let i = period; i < closes.length; i++) {
      ema[i] = closes[i] * k + ema[i - 1] * (1 - k);
    }
    return ema;
  }

  const closes = data.map((d) => d.close);
  const emaFast = computeEMA(closes, fastPeriod);
  const emaSlow = computeEMA(closes, slowPeriod);

  // MACD line starts at slowPeriod - 1 (first index where both EMAs exist)
  const macdLine = [];
  const macdValues = [];
  for (let i = slowPeriod - 1; i < data.length; i++) {
    const val = +(emaFast[i] - emaSlow[i]).toFixed(4);
    macdLine.push({ time: data[i].time, value: val });
    macdValues.push(val);
  }

  // Signal line = EMA of MACD values
  if (macdValues.length < signalPeriod) {
    return { macd: macdLine, signal: [], histogram: [] };
  }

  const k = emaMultiplier(signalPeriod);
  let sum = 0;
  for (let i = 0; i < signalPeriod; i++) sum += macdValues[i];
  const signalEma = [];
  signalEma[signalPeriod - 1] = sum / signalPeriod;
  for (let i = signalPeriod; i < macdValues.length; i++) {
    signalEma[i] = macdValues[i] * k + signalEma[i - 1] * (1 - k);
  }

  const signal = [];
  const histogram = [];
  for (let i = signalPeriod - 1; i < macdValues.length; i++) {
    const sigVal = +signalEma[i].toFixed(4);
    const histVal = +(macdValues[i] - signalEma[i]).toFixed(4);
    signal.push({ time: macdLine[i].time, value: sigVal });
    histogram.push({ time: macdLine[i].time, value: histVal });
  }

  return { macd: macdLine, signal, histogram };
}

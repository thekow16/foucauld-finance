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

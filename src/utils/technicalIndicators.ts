export const calculateSMA = (data: number[], period: number): number[] => {
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma as (number | null)[];
};

export const calculateEMA = (data: number[], period: number): number[] => {
  const ema = [];
  const multiplier = 2 / (period + 1);
  let prevEma = data[0];
  ema.push(prevEma);

  for (let i = 1; i < data.length; i++) {
    const currentEma = (data[i] - prevEma) * multiplier + prevEma;
    ema.push(currentEma);
    prevEma = currentEma;
  }
  return ema;
};

export const calculateRSI = (data: number[], period: number = 14): number[] => {
  const rsi = [null]; // 1st day has no RSI
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    if (i < period) {
      avgGain += gain;
      avgLoss += loss;
      rsi.push(null);
    } else if (i === period) {
      avgGain /= period;
      avgLoss /= period;
      const rs = avgGain / (avgLoss === 0 ? 1 : avgLoss);
      rsi.push(100 - 100 / (1 + rs));
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgGain / (avgLoss === 0 ? 1 : avgLoss);
      rsi.push(100 - 100 / (1 + rs));
    }
  }
  return rsi as (number | null)[];
};

export const calculateMACD = (data: number[], shortPeriod = 12, longPeriod = 26, signalPeriod = 9) => {
  const shortEMA = calculateEMA(data, shortPeriod);
  const longEMA = calculateEMA(data, longPeriod);
  
  const macdLine = [];
  for (let i = 0; i < data.length; i++) {
    macdLine.push(shortEMA[i] - longEMA[i]);
  }
  
  const signalLine = calculateEMA(macdLine, signalPeriod);
  const histogram = macdLine.map((val, i) => val - signalLine[i]);
  
  return { macdLine, signalLine, histogram };
};

export const calculateBollingerBands = (data: number[], period = 20, multiplier = 2) => {
  const sma = calculateSMA(data, period);
  const upper = [];
  const lower = [];
  
  for (let i = 0; i < data.length; i++) {
    if (sma[i] === null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    const slice = data.slice(i - period + 1, i + 1);
    const mean = sma[i] as number;
    const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    upper.push(mean + multiplier * stdDev);
    lower.push(mean - multiplier * stdDev);
  }
  return { upper, middle: sma, lower };
};

export const calculateVolatility = (data: number[], period = 30): number[] => {
  const volatility = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      volatility.push(null);
      continue;
    }
    const slice = data.slice(i - period + 1, i + 1);
    const returns = [];
    for(let j=1; j<slice.length; j++) {
      returns.push((slice[j] - slice[j-1]) / slice[j-1]);
    }
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((acc, val) => acc + Math.pow(val - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    volatility.push(stdDev * Math.sqrt(252)); // Annualized
  }
  return volatility as (number | null)[];
};

export const calculateMomentum = (data: number[], period = 14): number[] => {
  const momentum = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
       momentum.push(null);
    } else {
       momentum.push((data[i] / data[i - period]) * 100);
    }
  }
  return momentum as (number | null)[];
};

export const calculateMonthlyAveragePrice = (closes: number[]): number => {
  const slice = closes.slice(-21);
  if (slice.length === 0) return 0;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
};

export const calculateAverageVolume = (volumes: number[]): number => {
  const slice = volumes.slice(-21);
  if (slice.length === 0) return 0;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
};

export const calculateTrendStrength = (closes: number[]): number => {
  const slice = closes.slice(-14);
  if (slice.length < 2) return 0;
  const first = slice[0];
  const last = slice[slice.length - 1];
  return ((last - first) / first) * 100;
};

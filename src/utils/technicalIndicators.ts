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

export const calculateCorrelation = (arr1: number[], arr2: number[]): number => {
  if (arr1.length === 0 || arr2.length === 0 || arr1.length !== arr2.length) return 0;
  const n = arr1.length;
  const mean1 = arr1.reduce((a, b) => a + b, 0) / n;
  const mean2 = arr2.reduce((a, b) => a + b, 0) / n;
  
  let num = 0;
  let den1 = 0;
  let den2 = 0;
  
  for (let i = 0; i < n; i++) {
    const diff1 = arr1[i] - mean1;
    const diff2 = arr2[i] - mean2;
    num += diff1 * diff2;
    den1 += diff1 * diff1;
    den2 += diff2 * diff2;
  }
  
  if (den1 === 0 || den2 === 0) return 0;
  return num / Math.sqrt(den1 * den2);
};

export const calculateTrendStrength = (closes: number[]): number => {
  const slice = closes.slice(-14);
  if (slice.length < 2) return 0;
  const first = slice[0];
  const last = slice[slice.length - 1];
  return ((last - first) / first) * 100;
};

// Institutional Flow & Advanced Technicals

export const calculateTrueRange = (highs: number[], lows: number[], closes: number[]): number[] => {
  const tr = [0];
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(hl, hc, lc));
  }
  return tr;
};

export const calculateATR = (highs: number[], lows: number[], closes: number[], period: number = 14): number[] => {
  const tr = calculateTrueRange(highs, lows, closes);
  const atr = [];
  let sum = 0;
  for (let i = 0; i < tr.length; i++) {
    if (i < period) {
      sum += tr[i];
      if (i === period - 1) {
        atr.push(sum / period);
      } else {
        atr.push(null);
      }
    } else {
      const prevAtr = atr[i - 1] as number;
      atr.push((prevAtr * (period - 1) + tr[i]) / period);
    }
  }
  return atr as (number | null)[];
};

export const calculateOBV = (closes: number[], volumes: number[]): number[] => {
  const obv = [0];
  for (let i = 1; i < closes.length; i++) {
    const prevObv = obv[i - 1];
    if (closes[i] > closes[i - 1]) {
      obv.push(prevObv + volumes[i]);
    } else if (closes[i] < closes[i - 1]) {
      obv.push(prevObv - volumes[i]);
    } else {
      obv.push(prevObv);
    }
  }
  return obv;
};

export const calculateAccumulationDistribution = (highs: number[], lows: number[], closes: number[], volumes: number[]): number[] => {
  const adl = [];
  let currentADL = 0;
  for (let i = 0; i < closes.length; i++) {
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    const v = volumes[i] || 0;
    
    let mfv = 0; // Money Flow Multiplier
    if (h !== l) {
      mfv = ((c - l) - (h - c)) / (h - l);
    }
    
    const mfvVol = mfv * v;
    currentADL += mfvVol;
    adl.push(currentADL);
  }
  return adl;
};

export const detectVolatilitySpike = (atr: (number | null)[], currentIdx: number): boolean => {
  const currentAtr = atr[currentIdx];
  const slice = atr.slice(Math.max(0, currentIdx - 20), currentIdx).filter((a): a is number => a !== null);
  if (slice.length === 0 || currentAtr === null) return false;
  
  const avgAtr = slice.reduce((a, b) => a + b, 0) / slice.length;
  // If current ATR is significantly higher than 20-day average
  return currentAtr > avgAtr * 1.5; 
};

export const calculateInstitutionalFlow = (
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[]
) => {
  const obv = calculateOBV(closes, volumes);
  const adl = calculateAccumulationDistribution(highs, lows, closes, volumes);
  const atr = calculateATR(highs, lows, closes, 14);

  const latestIdx = closes.length - 1;
  const volSpike = detectVolatilitySpike(atr, latestIdx);

  // Simple Trend logic for OBV and ADL (over last 10 periods)
  const pastIdx = Math.max(0, latestIdx - 10);
  
  const obvCurrent = obv[latestIdx];
  const obvPast = obv[pastIdx];
  const obvTrend: 'Up' | 'Down' | 'Flat' = obvCurrent > obvPast * 1.05 ? 'Up' : obvCurrent < obvPast * 0.95 ? 'Down' : 'Flat';

  const adlCurrent = adl[latestIdx];
  const adlPast = adl[pastIdx];
  const adlTrend: 'Up' | 'Down' | 'Flat' = adlCurrent > adlPast ? 'Up' : adlCurrent < adlPast ? 'Down' : 'Flat';

  let score = 50; // Neutral start
  if (obvTrend === 'Up') score += 15;
  if (obvTrend === 'Down') score -= 15;
  if (adlTrend === 'Up') score += 15;
  if (adlTrend === 'Down') score -= 15;
  if (volSpike) {
    if (closes[latestIdx] > closes[pastIdx]) score += 20; // Breakout
    else score -= 20; // Breakdown
  }

  score = Math.max(0, Math.min(100, score));

  let signal: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  if (score >= 65) signal = 'Bullish';
  else if (score <= 35) signal = 'Bearish';

  return {
    score,
    signal,
    obvTrend,
    adLineTrend: adlTrend,
    volatilityExpansion: volSpike,
  };
};

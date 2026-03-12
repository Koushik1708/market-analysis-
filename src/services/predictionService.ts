import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisDataPoint, AIAnalysisResult, PredictionPoint, MarketRegime, BacktestPoint } from "../types";
import { parseISO, addDays, format, isWeekend } from "date-fns";
import {
  calculateSMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateVolatility,
  calculateMomentum,
  calculateMonthlyAveragePrice,
  calculateAverageVolume,
  calculateTrendStrength,
  calculateInstitutionalFlow,
  calculateOBV,
  calculateAccumulationDistribution,
  calculateATR
} from "../utils/technicalIndicators.js";
import { RandomForestRegressor, GradientBoostingRegressor } from "../utils/mlModels.js";

// --- Mathematical Helpers ---
const pearsonCorrelation = (x: number[], y: number[]): number => {
  if (x.length !== y.length || x.length === 0) return 0;
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denominator === 0) return 0;
  return numerator / denominator;
};
// Simple hash function for dataset to create a deterministic seed and cache key
const hashDataset = (data: AnalysisDataPoint[]): number => {
  let hash = 0;
  for (let i = Math.max(0, data.length - 30); i < data.length; i++) {
    const str = `${data[i].date}-${data[i].close.toFixed(2)}-${data[i].volume}`;
    for (let j = 0; j < str.length; j++) {
      const char = str.charCodeAt(j);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
  }
  return hash;
};

// Seeded PRNG (Mulberry32)
const createSeededRandom = (seed: number) => {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
};

const detectRegime = (ma50: number, ma200: number, rsi: number, momentum: number, volatility: number): MarketRegime => {
  if (ma50 > ma200 && momentum > 100) return 'Bull Market';
  if (ma50 < ma200 && rsi < 40) return 'Bear Market';
  if (volatility < 0.15 && Math.abs(momentum - 100) < 5) return 'Sideways Market';
  if (ma50 > ma200 && rsi < 45 && momentum < 100) return 'Bearish Correction';
  if (ma50 < ma200 && rsi > 55 && momentum > 100) return 'Recovery Phase';

  return 'Sideways Market'; // default fallback
};

export const generateEnsemblePredictions = (
  data: AnalysisDataPoint[],
  days: number = 14,
  prng: () => number,
  regime: MarketRegime,
  latestVol: number,
  factorScore: number,
  sectorCorrelation: number,
  trainedRF?: RandomForestRegressor,
  trainedGBM?: GradientBoostingRegressor
): PredictionPoint[] => {
  if (data.length < 50) return [];

  const closes = data.map(d => d.close);
  let currentPrice = closes[closes.length - 1];

  // Statistical Baselines
  let hwLevel = closes[0];
  let hwTrend = closes[1] - closes[0];
  for (let i = 1; i < closes.length; i++) {
    const lastLevel = hwLevel;
    hwLevel = 0.2 * closes[i] + (1 - 0.2) * (lastLevel + hwTrend);
    hwTrend = 0.1 * (hwLevel - lastLevel) + (1 - 0.1) * hwTrend;
  }

  const recentReturns = closes.slice(-14).map((c, i, arr) => i > 0 ? (c - arr[i - 1]) / arr[i - 1] : 0).slice(1);
  const avgDailyReturn = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
  const ma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, closes.length);

  let wHW = 0.4, wMom = 0.3, wMR = 0.3;
  if (regime === 'Bull Market' || regime === 'Bear Market') {
    wMom = 0.5; wMR = 0.1; wHW = 0.4;
  } else if (regime === 'Sideways Market') {
    wMom = 0.1; wMR = 0.6; wHW = 0.3;
  }

  // Sector Correlation Adjustment: If stock tightly follows its sector, allow momentum to carry more weight
  if (sectorCorrelation > 0.6) {
    wHW += 0.1;
    wMR -= 0.1;
  } else if (sectorCorrelation < 0.3) {
    wMR += 0.1; // More idiosyncratic, leans on mean reversion
    wMom -= 0.1;
  }

  if (latestVol > 0.3) {
    wMom *= 0.5;
    wMR += (wMom);
  }

  const predictions: PredictionPoint[] = [];
  const lastDate = typeof data[data.length - 1].date === 'string'
    ? parseISO(data[data.length - 1].date as string)
    : data[data.length - 1].date as Date;

  let currentDate = lastDate;
  let addedDays = 0;

  let hwPrice = hwLevel;
  let momPrice = currentPrice;

  const dailyVol = latestVol / Math.sqrt(252);

  // We need the latest features to feed into ML models autoregressively
  let features = extractLatestFeaturesForML(data);

  for (let i = 1; addedDays < days; i++) {
    currentDate = addDays(currentDate, 1);
    if (isWeekend(currentDate)) continue;

    hwPrice += hwTrend;
    momPrice = momPrice * (1 + avgDailyReturn);
    const pullFactor = 0.1;
    const mrPrice = currentPrice + (ma50 - currentPrice) * pullFactor * i;
    const factorAdjustment = ((factorScore - 50) / 50) * 0.005 * i;
    const statBasePred = ((hwPrice * wHW) + (momPrice * wMom) + (mrPrice * wMR)) * (1 + factorAdjustment);

    let finalPred = statBasePred;

    // ML Blending Strategy:
    // If we have trained ML models, we query them and blend them with stats
    // 0.4 * XGB/GBM + 0.3 * RF + 0.3 * Stat
    if (trainedRF && trainedGBM) {
      const rfPred = trainedRF.predict([features])[0];
      const gbmPred = trainedGBM.predict([features])[0];
      finalPred = (0.4 * gbmPred) + (0.3 * rfPred) + (0.3 * statBasePred);
      
      // Update features autogressively for the next loop
      features = updateFeaturesAutoregressively(features, finalPred);
      currentPrice = finalPred; // shift close
    }

    const noise = finalPred * dailyVol * (prng() - 0.5);
    finalPred = Math.max(0.01, finalPred + noise);

    const upperBound = finalPred * (1 + dailyVol * Math.sqrt(addedDays + 1));
    const lowerBound = Math.max(0.01, finalPred * (1 - dailyVol * Math.sqrt(addedDays + 1)));

    predictions.push({
      date: format(currentDate, 'yyyy-MM-dd'),
      modelPrediction: finalPred,
      aiAdjustedPrediction: finalPred,
      upperBound: upperBound,
      lowerBound: lowerBound,
    });

    addedDays++;
  }

  return predictions;
};

// --- Auto-regression helpers for ML ---
const extractLatestFeaturesForML = (data: AnalysisDataPoint[]): number[] => {
  // Optimization: we only need the last ~210 items to calculate the current latest stats accurately
  // This drastically drops CPU loops during backtesting walks!
  const slice = data.slice(-210);
  const closes = slice.map(d => d.close);
  const vols = slice.map(d => d.volume || 0);
  const smas50 = calculateSMA(closes, 50);
  const smas200 = calculateSMA(closes, 200);
  const rsis = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const volatilities = calculateVolatility(closes, 30);
  const momentums = calculateMomentum(closes, 14);
  
  const last = closes.length - 1;
  return [
    smas50[last] || closes[last],
    smas200[last] || closes[last],
    rsis[last] || 50,
    macd.macdLine[last] || 0,
    macd.signalLine[last] || 0,
    volatilities[last] || 0.15,
    momentums[last] || 100,
    vols[last] || 0,
    closes[last]
  ];
};

const updateFeaturesAutoregressively = (oldFeatures: number[], predictedClose: number): number[] => {
  // Rough approximation of feature evolution to save compute cycles during loop
  const [ma50, ma200, rsi, mLine, mSig, vol, mom, v, close] = oldFeatures;
  return [
    (ma50 * 49 + predictedClose) / 50, // slowly drag MA50
    (ma200 * 199 + predictedClose) / 200, // slowly drag MA200
    rsi, // keep RSI constant approximation
    mLine,
    mSig,
    vol,
    (predictedClose / close) * 100, // update momentum
    v,
    predictedClose // new close
  ];
};

// Helper for training ML Model datasets
const prepareMLDataset = (data: AnalysisDataPoint[]) => {
  const closes = data.map(d => d.close);
  const vols = data.map(d => d.volume || 0);
  const smas50 = calculateSMA(closes, 50);
  const smas200 = calculateSMA(closes, 200);
  const rsis = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const volatilities = calculateVolatility(closes, 30);
  const momentums = calculateMomentum(closes, 14);

  const X: number[][] = [];
  const y: number[] = [];

  // offset by 1 to predict tomorrow's close
  for (let i = 50; i < closes.length - 1; i++) {
    const f = [
      smas50[i] || closes[i],
      smas200[i] || closes[i],
      rsis[i] || 50,
      macd.macdLine[i] || 0,
      macd.signalLine[i] || 0,
      volatilities[i] || 0.15,
      momentums[i] || 100,
      vols[i] || 0,
      closes[i] // current close
    ];
    X.push(f);
    y.push(closes[i + 1]); // target is tomorrow's close
  }

  return { X, y };
};

// Local factor score calculation
const computeFactorScore = (
  momentums: (number | null)[],
  closes: number[],
  volumes: number[],
  ma50s: (number | null)[],
  vols: (number | null)[]
) => {
  const latestClose = closes[closes.length - 1];

  // 1. Momentum factor (-1 to 1) 
  const momRaw = momentums[momentums.length - 1] || 100;
  const momFactor = Math.max(-1, Math.min(1, (momRaw - 100) / 10));

  // 2. Trend factor
  const ma50Now = ma50s[ma50s.length - 1] || latestClose;
  const ma50Prev = ma50s[Math.max(0, ma50s.length - 10)] || latestClose;
  const trendFactor = Math.max(-1, Math.min(1, ((ma50Now - ma50Prev) / ma50Prev) * 20));

  // 3. Volume factor
  const volSlice = volumes.slice(-21);
  const avgVol = volSlice.length ? volSlice.reduce((a, b) => a + b, 0) / volSlice.length : 1;
  const latestVolume = volumes[volumes.length - 1] || avgVol;
  const volumeFactor = Math.max(-1, Math.min(1, (latestVolume - avgVol) / avgVol));

  // 4. Volatility factor (prefer lower vol)
  const volRaw = vols[vols.length - 1] || 0.15;
  const volFactor = Math.max(-1, Math.min(1, (0.15 - volRaw) / 0.15));

  // 5. Mean Reversion factor
  const mrFactor = Math.max(-1, Math.min(1, (ma50Now - latestClose) / latestClose * 10));

  const score =
    0.30 * momFactor +
    0.25 * trendFactor +
    0.20 * volumeFactor +
    0.15 * volFactor +
    0.10 * mrFactor;

  return Math.round(((score + 1) / 2) * 100);
};

export const callGeminiPrediction = async (
  data: AnalysisDataPoint[],
  symbolName: string,
  newsHeadlines: string[] = [],
  marketData: any[] | null = null,
  sectorData: any[] | null = null,
  marketSymbol: string = "^NSEI",
  sectorSymbol: string = ""
): Promise<AIAnalysisResult> => {
  if (data.length < 100) {
    throw new Error("Backtesting requires at least 100 data points.");
  }

  // Feature Engineering using local computations
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high || d.close);
  const lows = data.map(d => d.low || d.close);
  const volumes = data.map(d => d.volume || 0);

  const smas50 = calculateSMA(closes, 50);
  const smas200 = calculateSMA(closes, 200);
  const rsis = calculateRSI(closes, 14);
  const macdData = calculateMACD(closes);
  const vols = calculateVolatility(closes, 30);
  const momentums = calculateMomentum(closes, 14);
  const factorScore = computeFactorScore(momentums, closes, volumes, smas50, vols);

  const latestIndex = closes.length - 1;
  const latestPrice = closes[latestIndex];
  const latestMA50 = smas50[latestIndex] || latestPrice;
  const latestMA200 = smas200[latestIndex] || latestPrice;
  const latestRSI = rsis[latestIndex] || 50;
  const latestVol = vols[latestIndex] || 0.15;
  const latestMomentum = momentums[latestIndex] || 100;

  // Institutional Flow
  const instFlow = calculateInstitutionalFlow(closes, highs, lows, volumes);

  // Market Context
  let marketCtx = undefined;
  if (marketData && marketData.length > 50) {
    const mCloses = marketData.map(d => d.close || 0);
    const mMA50Now = calculateSMA(mCloses, 50)[mCloses.length - 1];
    marketCtx = {
      indexName: marketSymbol,
      trend: mCloses[mCloses.length - 1] > (mMA50Now || 0) ? 'Bullish' : 'Bearish',
      dailyReturn: ((mCloses[mCloses.length - 1] - mCloses[mCloses.length - 2]) / mCloses[mCloses.length - 2]) * 100,
      volatility: calculateVolatility(mCloses, 30)[mCloses.length - 1] || 0.15
    };
  }

  // Sector Context & Correlation Modeling
  let sectorCtx = undefined;
  let correlation = 0.8; // Default fallback
  if (sectorData && sectorData.length > 50) {
    const sCloses = sectorData.map(d => d.close || 0);
    const sMA50Now = calculateSMA(sCloses, 50)[sCloses.length - 1];
    
    // Calculate Pearson correlation of daily returns over the last 50 days
    const lookback = Math.min(50, closes.length, sCloses.length);
    const stockSlice = closes.slice(-lookback);
    const sectorSlice = sCloses.slice(-lookback);
    
    const stockReturns = [];
    const sectorReturns = [];
    for(let i = 1; i < lookback; i++) {
        stockReturns.push((stockSlice[i] - stockSlice[i-1]) / stockSlice[i-1]);
        sectorReturns.push((sectorSlice[i] - sectorSlice[i-1]) / sectorSlice[i-1]);
    }
    
    correlation = pearsonCorrelation(stockReturns, sectorReturns);

    sectorCtx = {
      sectorName: sectorSymbol, // Semantically passed from analyze-stock
      momentum: calculateMomentum(sCloses, 14)[sCloses.length - 1] || 100,
      volatility: calculateVolatility(sCloses, 30)[sCloses.length - 1] || 0.15,
      correlation: Number(correlation.toFixed(2)),
      trend: sCloses[sCloses.length - 1] > (sMA50Now || 0) ? 'Bullish' : 'Bearish'
    };
  }

  const datasetHash = hashDataset(data);
  const prng = createSeededRandom(datasetHash);
  const regime = detectRegime(latestMA50, latestMA200, latestRSI, latestMomentum, latestVol);

  // === DYNAMIC ML TRAINING ===
  // We use the 80% train slice to construct the RF and GBM models
  const trainSliceSize = Math.floor(data.length * 0.8);
  const trainData = data.slice(0, trainSliceSize);
  const { X: trainX, y: trainY } = prepareMLDataset(trainData);

  // Optimized tree structures for fast CPU bound Node Vercel execution
  const rfModel = new RandomForestRegressor(5, 4); // 5 trees, depth 4
  rfModel.fit(trainX, trainY);

  const gbmModel = new GradientBoostingRegressor(10, 0.1, 3); // 10 trees, depth 3
  gbmModel.fit(trainX, trainY);

  // Generate real predictions spanning into the future using the Trained ML
  const predictions = generateEnsemblePredictions(data, 14, prng, regime, latestVol, factorScore, correlation, rfModel, gbmModel);

  let newsSentimentData = { score: 0, label: 'Neutral', headlines: newsHeadlines.slice(0, 5) };

  // Confidence calculation locally based on volatility and trend strength
  let confidence = 85;
  if (latestVol > 0.3) confidence -= 20;
  if (latestVol < 0.15) confidence += 10;
  if (regime === 'Sideways Market') confidence -= 10;
  if (instFlow.signal === 'Bullish') confidence += 5;
  // Ensure bounds 0-100
  confidence = Math.min(100, Math.max(0, Math.floor(confidence)));

  let aiResultParams: any = null;

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key missing. Please set GEMINI_API_KEY in the environment.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-3-flash-preview";

    const systemInstruction = `You are an AI financial reasoning agent.
Produce a brief explanation (UNDER 150 WORDS) based on the inputs.
You MUST respond strictly with a valid JSON document matching the requested schema.`;

    const prompt = `Stock: ${symbolName || 'Unknown Stock'}
Market Regime: ${regime}
Factor Score: ${factorScore}/100
Predictions: ${predictions[0].modelPrediction.toFixed(2)} to ${predictions[predictions.length - 1].modelPrediction.toFixed(2)}

News Headlines (Extract Sentiment!):
${newsSentimentData.headlines.join('\n')}

Generate:
1. Overall Sentiment (Bullish/Bearish/Neutral)
2. A short reasoning report (under 150 words)
3. 3-5 key driving factors (brief bullet points)
4. Overall News Sentiment Score (0=negative, 1=positive) and Label based on headlines.`;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        sentiment: {
          type: Type.STRING,
          enum: ["Bullish", "Bearish", "Neutral"],
        },
        reasoning: {
          type: Type.STRING,
          description: "Professional market analysis report (2-3 paragraphs), explicitly referencing provided technicals, regime, and volatility."
        },
        keyFactors: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        newsSentiment: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "Sentiment score from -1.0 to 1.0" },
            label: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative"] },
            headlines: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Return the provided 5 actual headlines." }
          },
          required: ["score", "label", "headlines"]
        }
      },
      required: ["sentiment", "reasoning", "keyFactors", "newsSentiment"]
    };

    // Wrap the Gemini call with a 4500ms timeout Promise.race to prevent Vercel 10s timeout
    const geminiPromise = ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema
      }
    });

    const timeoutPromise = new Promise<{ text: string }>((_, reject) => 
      setTimeout(() => reject(new Error("Gemini AI request timed out after 4.5 seconds to prevent serverless crash.")), 4500)
    );

    const response = await Promise.race([geminiPromise, timeoutPromise]);

    if (!response.text) {
      throw new Error("No response received from GenAI.");
    }

    aiResultParams = JSON.parse(response.text);
  } catch (geminiError: any) {
    console.warn("⚠️ Gemini AI analysis failed. Falling back to mathematical ensemble model.", geminiError.message);

    // Construct a safe, valid fallback block using purely the mathematical predictions.
    const averagePred = predictions.reduce((acc, p) => acc + p.modelPrediction, 0) / predictions.length;
    let fallbackSentiment = "Neutral";
    if (averagePred > latestPrice * 1.02) fallbackSentiment = "Bullish";
    if (averagePred < latestPrice * 0.98) fallbackSentiment = "Bearish";

    aiResultParams = {
      sentiment: fallbackSentiment,
      reasoning: "The mathematical forecasting models (Holt-Winters, Momentum, and Mean Reversion) have successfully generated prediction bounds. However, abstract AI reasoning (Gemini) is currently unavailable to contextualize this data. Generating insights purely from quantitative technical factors.",
      keyFactors: [
        `Market is currently in a ${regime}`,
        `Mathematical Factor Score: ${factorScore}/100`,
        `Recent Volatility computes to ${(latestVol * 100).toFixed(2)}%`,
        `AI Language Model unavailable, returning statistical ensemble.`
      ],
      newsSentiment: {
        score: 0.5,
        label: "Neutral",
        headlines: newsHeadlines.slice(0, 5)
      }
    };
  }

  // Calculate min and max from the predictions
  const predMax = Math.max(...predictions.map(p => p.upperBound || p.modelPrediction || 0));
  const predMin = Math.min(...predictions.map(p => p.lowerBound || p.modelPrediction || 0));

  // Backtesting System: Walk-forward validation over the last 20% of the dataset
  const testStartIndex = Math.floor(data.length * 0.8);
  const testData = data.slice(testStartIndex);

  let maeSum = 0;
  let rmseSum = 0;
  let correctDirection = 0;
  let totalTested = 0;

  // Simulate 1-day ahead forecasts over the test period
  const testPredictions: BacktestPoint[] = [];

  for (let i = 0; i < testData.length - 1; i++) {
    const walkData = data.slice(0, testStartIndex + i + 1);
    const localVol = vols[testStartIndex + i] || latestVol;

    // Use ML Models to validate the historic steps too
    const pred1Day = generateEnsemblePredictions(walkData, 1, prng, regime, localVol, factorScore, correlation, rfModel, gbmModel);
    if (pred1Day.length > 0) {
      const predicted = pred1Day[0].modelPrediction || 0;
      const actualTarget = testData[i + 1].close;
      const currentClose = testData[i].close;

      const errorVal = Math.abs(predicted - actualTarget);
      maeSum += errorVal;
      rmseSum += errorVal * errorVal;

      const predictedUp = predicted > currentClose;
      const actualUp = actualTarget > currentClose;
      if (predictedUp === actualUp) {
        correctDirection++;
      }
      totalTested++;

      testPredictions.push({
        date: typeof testData[i + 1].date === 'string' ? testData[i + 1].date as string : format(testData[i + 1].date as Date, 'yyyy-MM-dd'),
        predictedPrice: predicted,
        actualPrice: actualTarget,
        error: errorVal
      });
    }
  }

  const mae = totalTested > 0 ? maeSum / totalTested : 0;
  const rmse = totalTested > 0 ? Math.sqrt(rmseSum / totalTested) : 0;
  const directionalAccuracy = totalTested > 0 ? (correctDirection / totalTested) * 100 : 0;

  const testStartDateObj = testData[0]?.date;
  const testEndDateObj = testData[testData.length - 1]?.date;

  const testStartDate = testStartDateObj ? (typeof testStartDateObj === 'string' ? testStartDateObj : format(testStartDateObj as Date, 'yyyy-MM-dd')) : '';
  const testEndDate = testEndDateObj ? (typeof testEndDateObj === 'string' ? testEndDateObj : format(testEndDateObj as Date, 'yyyy-MM-dd')) : '';

  const backtestMetrics = {
    mae,
    rmse,
    directionalAccuracy: Number(directionalAccuracy.toFixed(1)),
    totalPredictions: totalTested,
    testStartDate,
    testEndDate,
    predictions: testPredictions
  };

  return {
    predictions,
    sentiment: aiResultParams.sentiment,
    reasoning: aiResultParams.reasoning,
    keyFactors: aiResultParams.keyFactors,
    newsSentiment: aiResultParams.newsSentiment,
    projectedRange: { min: predMin, max: predMax },
    confidenceScore: confidence,
    marketRegime: regime,
    marketContext: marketCtx as any,
    sectorContext: sectorCtx as any,
    institutionalFlow: instFlow,
    backtestMetrics
  };
};

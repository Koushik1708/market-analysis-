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
  calculateTrendStrength
} from "../utils/technicalIndicators.js";

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
  factorScore: number // 0 to 100
): PredictionPoint[] => {
  if (data.length < 50) return []; // Need enough data

  const closes = data.map(d => d.close);
  const currentPrice = closes[closes.length - 1];

  // 1. Holt-Winters (simplified)
  let level = closes[0];
  let trend = closes[1] - closes[0];
  for (let i = 1; i < closes.length; i++) {
    const lastLevel = level;
    level = 0.2 * closes[i] + (1 - 0.2) * (lastLevel + trend);
    trend = 0.1 * (level - lastLevel) + (1 - 0.1) * trend;
  }

  // 2. Momentum Model
  const recentReturns = closes.slice(-14).map((c, i, arr) => i > 0 ? (c - arr[i - 1]) / arr[i - 1] : 0).slice(1);
  const avgDailyReturn = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;

  // 3. Mean Reversion Model
  const ma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;

  // Weights setup based on regime
  let wHW = 0.4, wMom = 0.3, wMR = 0.3;
  if (regime === 'Bull Market' || regime === 'Bear Market') {
    wMom = 0.5; wMR = 0.1; wHW = 0.4; // Trend following
  } else if (regime === 'Sideways Market') {
    wMom = 0.1; wMR = 0.6; wHW = 0.3; // Mean reverting
  }

  // Volatility dampening
  if (latestVol > 0.3) {
    wMom *= 0.5; // Reduce momentum impact in high vol
    wMR += (wMom); // Shift to mean reversion
  }

  const predictions: PredictionPoint[] = [];
  const lastDate = typeof data[data.length - 1].date === 'string'
    ? parseISO(data[data.length - 1].date as string)
    : data[data.length - 1].date as Date;

  let currentDate = lastDate;
  let addedDays = 0;

  let hwPrice = level;
  let momPrice = currentPrice;

  // Base volatility factor
  const dailyVol = latestVol / Math.sqrt(252);

  for (let i = 1; addedDays < days; i++) {
    currentDate = addDays(currentDate, 1);
    if (isWeekend(currentDate)) continue;

    // Holt-Winters step
    hwPrice += trend;

    // Momentum step
    momPrice = momPrice * (1 + avgDailyReturn);

    // Mean reversion step (gradual pull to MA50)
    const pullFactor = 0.1;
    const mrPrice = currentPrice + (ma50 - currentPrice) * pullFactor * i;

    // Factor Score Adjustment (-0.5% to +0.5% drift based on factor score)
    const factorAdjustment = ((factorScore - 50) / 50) * 0.005 * i;
    const basePred = ((hwPrice * wHW) + (momPrice * wMom) + (mrPrice * wMR)) * (1 + factorAdjustment);

    // Add deterministic noise
    const noise = basePred * dailyVol * (prng() - 0.5);
    const finalPred = Math.max(0.01, basePred + noise);

    // Dynamic uncertainty bounds using daily volatility
    const upperBound = finalPred * (1 + dailyVol * Math.sqrt(addedDays + 1));
    const lowerBound = Math.max(0.01, finalPred * (1 - dailyVol * Math.sqrt(addedDays + 1)));

    predictions.push({
      date: format(currentDate, 'yyyy-MM-dd'),
      modelPrediction: finalPred,
      aiAdjustedPrediction: finalPred, // Will be returned as-is, AI just explains
      upperBound: upperBound,
      lowerBound: lowerBound,
    });

    addedDays++;
  }

  return predictions;
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
  newsHeadlines: string[] = []
): Promise<AIAnalysisResult> => {
  if (data.length < 100) {
    throw new Error("Backtesting requires at least 100 data points.");
  }

  // Feature Engineering using local computations
  const closes = data.map(d => d.close);
  const volumes = data.map(d => d.volume || 0);
  const smas50 = calculateSMA(closes, 50);
  const smas200 = calculateSMA(closes, 200);
  const rsis = calculateRSI(closes, 14);
  const macdData = calculateMACD(closes);
  const bbData = calculateBollingerBands(closes);
  const vols = calculateVolatility(closes, 30);
  const momentums = calculateMomentum(closes, 14);
  const factorScore = computeFactorScore(momentums, closes, volumes, smas50, vols);

  const latestIndex = closes.length - 1;
  const latestPrice = closes[latestIndex];
  const latestMA50 = smas50[latestIndex] || latestPrice;
  const latestMA200 = smas200[latestIndex] || latestPrice;
  const latestRSI = rsis[latestIndex] || 50;
  const latestMACD = macdData.macdLine[latestIndex] || 0;
  const latestSignal = macdData.signalLine[latestIndex] || 0;
  const latestVol = vols[latestIndex] || 0.15;
  const latestMomentum = momentums[latestIndex] || 100;

  const datasetHash = hashDataset(data);
  const prng = createSeededRandom(datasetHash);

  const regime = detectRegime(latestMA50, latestMA200, latestRSI, latestMomentum, latestVol);
  const predictions = generateEnsemblePredictions(data, 14, prng, regime, latestVol, factorScore);

  let newsSentimentData = { score: 0, label: 'Neutral', headlines: newsHeadlines.slice(0, 5) };

  // Confidence calculation locally based on volatility and trend strength
  let confidence = 85;
  if (latestVol > 0.3) confidence -= 20;
  if (latestVol < 0.15) confidence += 10;
  if (regime === 'Sideways Market') confidence -= 10;
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

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema
      }
    });

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

    // Generate exactly 1 day ahead prediction
    const pred1Day = generateEnsemblePredictions(walkData, 1, prng, regime, localVol, factorScore);
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
    backtestMetrics
  };
};

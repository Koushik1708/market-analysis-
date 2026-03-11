import type { VercelRequest, VercelResponse } from '@vercel/node';
import yahooFinance from 'yahoo-finance2';
import { processStockData } from '../src/services/stockService.js';
import { callGeminiPrediction } from '../src/services/predictionService.js';

// Basic mapper
const dict: Record<string, string> = {
  "TATA STEEL": "TATASTEEL.NS",
  "TATASTEEL": "TATASTEEL.NS",
  "BHARAT AIRTEL": "BHARTIARTL.NS",
  "BHARTIAIRTEL": "BHARTIARTL.NS",
  "RELIANCE": "RELIANCE.NS",
  "INFOSYS": "INFY.NS",
  "HDFCBANK": "HDFCBANK.NS",
  "TCS": "TCS.NS"
};

const sectorMap: Record<string, string> = {
  "TATASTEEL.NS": "^CNXMETAL",
  "BHARTIARTL.NS": "^NSEI", // Telecom uses broad market fallback if specific index unseen via yahoo
  "INFY.NS": "^CNXIT",
  "TCS.NS": "^CNXIT",
  "HDFCBANK.NS": "^NSEBANK",
  "RELIANCE.NS": "^CNXENERGY"
};

// Global Memory Cache for Vercel Serverless (Persists during warm boots)
const globalModelCache = new Map<string, { timestamp: number; payload: any }>();
const CACHE_TTL = 1000 * 60 * 60 * 2; // 2 hours

async function fetchYahooSeries(symbol: string, years: number) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${years}y&interval=1d`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) return null;
  const rawData = await response.json();
  
  if (rawData.chart && rawData.chart.result && rawData.chart.result.length > 0) {
    const result = rawData.chart.result[0];
    const timestamps = result.timestamp || [];
    const quote = result.indicators.quote[0] || {};
    
    let mapped = timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000),
      open: quote.open?.[i] || 0,
      high: quote.high?.[i] || 0,
      low: quote.low?.[i] || 0,
      close: quote.close?.[i] || 0,
      volume: quote.volume?.[i] || 0,
      symbol: symbol
    }));
    
    return mapped.filter((d: any) => !isNaN(d.close) && d.close !== null && !isNaN(d.date.getTime()));
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { company, years = 5 } = req.body;
  if (!company) {
    return res.status(400).json({ error: "Company name is required." });
  }

  let ticker = company.toUpperCase().trim();
  const normalized = ticker.replace(/[\s\W]+/g, '');
  if (dict[ticker]) ticker = dict[ticker];
  else if (dict[normalized]) ticker = dict[normalized];
  else if (!ticker.includes('.')) ticker = ticker + '.NS'; 

  const cacheKey = `${ticker}_${years}`;
  const cached = globalModelCache.get(cacheKey);
  
  // 1. In-Memory ML Cache Retrieval
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`⚡ CACHE HIT: Reusing trained ML ensemble & data for ${cacheKey}`);
    return res.status(200).json(cached.payload);
  }

  console.log(`User input: ${company} | Resolved ticker: ${ticker} | Cache Miss`);

  try {
    // 2. Fetch Stock, Market, and Sector Data in parallel
    const marketSymbol = "^NSEI"; // NIFTY 50
    const sectorSymbol = sectorMap[ticker] || "^NSEI";
    
    console.log(`Fetching core stock ${ticker}, market ${marketSymbol}, and sector ${sectorSymbol}`);
    
    const [stockData, marketData, sectorData] = await Promise.all([
      fetchYahooSeries(ticker, years),
      fetchYahooSeries(marketSymbol, years).catch(() => null),
      fetchYahooSeries(sectorSymbol, years).catch(() => null)
    ]);

    if (!stockData || stockData.length === 0) {
      throw new Error(`Data parse error or no data returned for ${ticker}.`);
    }

    console.log(`Fetched ${stockData.length} valid historical data points for stock.`);

    stockData.sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
    if (marketData) marketData.sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
    if (sectorData) sectorData.sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

    // 1. Calculate technicals locally in Node
    console.log(`Starting technical indicator computation...`);
    const analysisData = processStockData(stockData);
    
    // 2. Fetch News context
    let newsHeadlines: string[] = [];
    try {
      const newsResult = await yahooFinance.search(ticker, { newsCount: 5 }) as any;
      if (newsResult.news && Array.isArray(newsResult.news)) {
        newsHeadlines = newsResult.news.map((n: any) => n.title);
      }
    } catch (e) {
      console.warn("Failed to fetch news serverside", e);
    }

    // 3. Compute Ensembles & Factor Scoring, call Gemini for abstract reasoning
    console.log(`Calling prediction engine (Ensemble ML + Market Context)...`);
    let predictionResult = null;
    let predictionError = null;
    try {
      predictionResult = await callGeminiPrediction(
        analysisData, 
        ticker, 
        newsHeadlines, 
        marketData, 
        sectorData, 
        marketSymbol, 
        sectorSymbol
      );
    } catch (e: any) {
      console.error("Prediction engine block failed unexpectedly:", e);
      predictionError = e.message || String(e);
    }

    // 4. Return unified JSON block strictly to Vercel specs
    const responsePayload = {
      historicalData: analysisData,
      predictionResult: predictionResult,
      predictionError: predictionError
    };

    // Store the successfully trained ensemble payload in memory cache
    globalModelCache.set(cacheKey, { timestamp: Date.now(), payload: responsePayload });
    console.log(`🧠 CACHE SAVED: Stored ML weights and predictions for ${cacheKey}`);

    return res.status(200).json(responsePayload);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch stock data" });
  }
}

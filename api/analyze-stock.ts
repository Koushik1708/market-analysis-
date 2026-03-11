import type { VercelRequest, VercelResponse } from '@vercel/node';
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
  "TCS": "TCS.NS",
  "NIFTY": "^NSEI",
  "NIFTY 50": "^NSEI",
  "NIFTY50": "^NSEI",
  "BANKNIFTY": "^NSEBANK",
  "BANK NIFTY": "^NSEBANK",
  "SENSEX": "^BSESN"
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

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Ticker symbol '${symbol}' not found on Yahoo Finance.`);
    }
    throw new Error(`Yahoo API returned ${response.status} for ${symbol}.`);
  }
  
  const rawData = await response.json();
  
  if (rawData.chart && rawData.chart.result && rawData.chart.result.length > 0) {
    const result = rawData.chart.result[0];
    const timestamps = result.timestamp || [];
    const quote = result.indicators.quote[0] || {};
    
    if (timestamps.length === 0) {
      throw new Error(`No historical data found for ${symbol}.`);
    }

    let mapped = timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString(),
      open: quote.open?.[i] ?? null,
      high: quote.high?.[i] ?? null,
      low: quote.low?.[i] ?? null,
      close: quote.close?.[i] ?? null,
      volume: quote.volume?.[i] ?? 0,
      symbol: symbol
    }));
    
    // Filter out rows with bad or null data explicitly
    const validData = mapped.filter((d: any) => typeof d.close === 'number' && !isNaN(d.close) && d.close > 0);
    
    if (validData.length === 0) {
      throw new Error(`Failed to parse valid OHLCV data for ${symbol}.`);
    }
    
    return validData;
  }
  
  throw new Error(`Data format unparseable or empty for ${symbol}.`);
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
  else if (!ticker.includes('.') && !ticker.startsWith('^')) ticker = ticker + '.NS';

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

    stockData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (marketData) marketData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (sectorData) sectorData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 1. Calculate technicals locally in Node
    console.log(`Starting technical indicator computation...`);
    const analysisData = processStockData(stockData);
    
    // 2. Fetch News context
    let newsHeadlines: string[] = [];
    try {
      const newsResponse = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${ticker}&newsCount=5`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (newsResponse.ok) {
        const newsData = await newsResponse.json();
        if (newsData.news && Array.isArray(newsData.news)) {
          newsHeadlines = newsData.news.map((n: any) => n.title);
        }
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

  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message || "Failed to fetch stock data." });
  }
}

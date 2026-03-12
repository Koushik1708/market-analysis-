import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processStockData } from '../src/services/stockService.js';
import { callGeminiPrediction } from '../src/services/predictionService.js';

// Basic mapper for standard tickers and indices
const parseDict: Record<string, string> = {
  "TATA STEEL": "TATASTEEL.NS",
  "TATASTEEL": "TATASTEEL.NS",
  "BHARAT AIRTEL": "BHARTIARTL.NS",
  "BHARTIAIRTEL": "BHARTIARTL.NS",
  "RELIANCE": "RELIANCE.NS",
  "INFOSYS": "INFY.NS",
  "HDFCBANK": "HDFCBANK.NS",
  "TCS": "TCS.NS",
  // Indices
  "NIFTY": "^NSEI",
  "NIFTY 50": "^NSEI",
  "NIFTY50": "^NSEI",
  "BANKNIFTY": "^NSEBANK",
  "BANK NIFTY": "^NSEBANK",
  "SENSEX": "^BSESN",
  // Commodities
  "GOLD": "GC=F",
  "SILVER": "SI=F",
  "CRUDE OIL": "CL=F",
  "CRUDEOIL": "CL=F"
};

const sectorMap: Record<string, string> = {
  "TATASTEEL.NS": "METAL",
  "JSWSTEEL.NS": "METAL",
  "HINDALCO.NS": "METAL",
  
  "INFY.NS": "IT",
  "TCS.NS": "IT",
  "WIPRO.NS": "IT",
  "HCLTECH.NS": "IT",
  
  "RELIANCE.NS": "ENERGY",
  "ONGC.NS": "ENERGY",
  "NTPC.NS": "ENERGY",
  "POWERGRID.NS": "ENERGY",
  
  "HDFCBANK.NS": "BANKING",
  "ICICIBANK.NS": "BANKING",
  "SBIN.NS": "BANKING",
  "AXISBANK.NS": "BANKING",
  "KOTAKBANK.NS": "BANKING",
  
  "MARUTI.NS": "AUTO",
  "TATAMOTORS.NS": "AUTO",
  "M&M.NS": "AUTO",
  "BAJAJ-AUTO.NS": "AUTO",
  
  "HUL.NS": "FMCG",
  "ITC.NS": "FMCG",
  "NESTLEIND.NS": "FMCG",
  "BRITANNIA.NS": "FMCG",
  
  "SUNPHARMA.NS": "PHARMA",
  "CIPLA.NS": "PHARMA",
  "DRREDDY.NS": "PHARMA",
  "DIVISLAB.NS": "PHARMA"
};

const sectorIndices: Record<string, string> = {
  "IT": "^CNXIT",
  "BANKING": "^NSEBANK",
  "METAL": "^CNXMETAL",
  "ENERGY": "^CNXENERGY",
  "AUTO": "^CNXAUTO",
  "FMCG": "^CNXFMCG",
  "PHARMA": "^CNXPHARMA"
};

// Global in-memory cache — persists across warm Vercel invocations on the same instance
declare const globalThis: any;
const globalCache: Map<string, { timestamp: number; payload: any }> =
  globalThis.__stockAnalysisCache ?? (globalThis.__stockAnalysisCache = new Map());
const CACHE_TTL = 1000 * 60 * 60 * 2; // 2 hours

async function fetchYahooSeries(symbol: string, years: number) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${years}y&interval=1d`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);

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
} catch (fetchErr: any) {
  clearTimeout(timeoutId);
  if (fetchErr.name === 'AbortError') {
    throw new Error(`Yahoo Finance API timed out for ${symbol}.`);
  }
  throw fetchErr;
}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { company, years = 5 } = req.body;
  if (!company) {
    return res.status(400).json({ error: "Company name is required." });
  }

  let ticker = company.trim().toUpperCase().replace(/\s+/g, '');

  if (parseDict[ticker]) ticker = parseDict[ticker];
  else if (!ticker.includes('.') && !ticker.startsWith('^') && !ticker.includes('=')) {
    // If it's a standard string without standard market syntax (like .NS, .BO, =F, or ^)
    // Assume NSE stock format
    ticker = ticker + '.NS';
  }

  const cacheKey = `analysis_${ticker}_${years}`;
  const cached = globalCache.get(cacheKey);

  // ── In-Memory Cache Hit ──────────────────────────────────────────────────
  if (cached) {
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`⚡ CACHE HIT: ${cacheKey}`);
      res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate=3600');
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached.payload);
    }
    // TTL expired — evict and fall through to a fresh fetch
    globalCache.delete(cacheKey);
    console.log(`🕐 CACHE EXPIRED: ${cacheKey} — fetching fresh data.`);
  }

  console.log(`User input: ${company} | Resolved ticker: ${ticker} | Cache Miss`);

  try {
    // 2. Fetch Stock, Market, and Sector Data in parallel
    const marketSymbol = "^NSEI"; // NIFTY 50
    const sectorName = sectorMap[ticker] || "BROAD_MARKET";
    const sectorSymbol = sectorIndices[sectorName] || "^NSEI";
    
    console.log(`Fetching core stock ${ticker}, market ${marketSymbol}, sector ${sectorName} (${sectorSymbol})`);
    
    const [stockData, marketData, sectorData] = await Promise.all([
      fetchYahooSeries(ticker, years).catch((err) => {
        // If the core asset fetch fails, we MUST throw so we can format the error block below.
        throw err;
      }),
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
        sectorSymbol,
        sectorName
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

    // ── Cache the result ONLY when historicalData is valid ──────────────────
    if (
      responsePayload.historicalData &&
      Array.isArray(responsePayload.historicalData) &&
      responsePayload.historicalData.length > 0
    ) {
      globalCache.set(cacheKey, { timestamp: Date.now(), payload: responsePayload });
      console.log(`🧠 CACHE SAVED: ${cacheKey} (${responsePayload.historicalData.length} rows)`);
    } else {
      console.warn(`⚠️  CACHE SKIP: historicalData missing or empty — result not cached.`);
    }

    res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate=3600');
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(responsePayload);

  } catch (error: any) {
    console.error(error);
    const errString = String(error.message || error).toLowerCase();
    
    // Check if the error implies a bad ticker mapping
    if (errString.includes('not found') || errString.includes('404') || errString.includes('no data found')) {
      return res.status(404).json({ 
        error: `Ticker symbol '${company}' not found. Try symbols like RELIANCE.NS, AAPL, or ^NSEI.` 
      });
    }

    return res.status(500).json({ error: error.message || "Failed to fetch stock data." });
  }
}

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
  if (dict[ticker]) {
    ticker = dict[ticker];
  } else if (dict[normalized]) {
    ticker = dict[normalized];
  } else if (!ticker.includes('.')) {
    ticker = ticker + '.NS'; // simple fallback
  }

  console.log(`User input company name: ${company}`);
  console.log(`Resolved ticker symbol: ${ticker}`);

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${years}y&interval=1d`;
    console.log(`Fetching from Yahoo Finance: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    console.log(`Yahoo Finance API response status: ${response.status}`);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Yahoo Finance Error: ${response.status} - ${errText}`);
      return res.status(500).json({ error: "Failed to fetch stock data", details: errText, status: response.status });
    }

    const rawData = await response.json();

    let mappedData: any[] = [];
    if (rawData.chart && rawData.chart.result && rawData.chart.result.length > 0) {
      const result = rawData.chart.result[0];
      const timestamps = result.timestamp || [];
      const quote = result.indicators.quote[0] || {};

      mappedData = timestamps.map((ts: number, i: number) => ({
        date: new Date(ts * 1000).toISOString(),
        open: quote.open?.[i] || 0,
        high: quote.high?.[i] || 0,
        low: quote.low?.[i] || 0,
        close: quote.close?.[i] || 0,
        volume: quote.volume?.[i] || 0,
        symbol: ticker
      }));
    } else {
      throw new Error("Invalid data format received from API.");
    }

    mappedData = mappedData.filter((d: any) => !isNaN(d.close) && d.close !== null && !isNaN(new Date(d.date).getTime()));
    if (mappedData.length === 0) {
      throw new Error("Data parse error.");
    }

    const processedFormat = mappedData.map(d => ({ ...d, date: new Date(d.date) }));
    processedFormat.sort((a, b) => a.date.getTime() - b.date.getTime());

    // 1. Calculate technicals locally in Node
    const analysisData = processStockData(processedFormat);

    // 2. Fetch News context via yahooFinance2 wrapper locally in Node
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
    let predictionResult = null;
    try {
      predictionResult = await callGeminiPrediction(analysisData, ticker, newsHeadlines);
    } catch (e) {
      console.error("Gemini inference failed", e);
    }

    // 4. Return unified JSON block strictly to Vercel specs
    return res.status(200).json({
      historicalData: analysisData,
      predictionResult: predictionResult
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch stock data" });
  }
}

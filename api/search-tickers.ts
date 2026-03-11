import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length < 1) {
    return res.status(400).json({ error: "Search query 'q' is required." });
  }

  try {
    const query = encodeURIComponent(q.trim());
    // Yahoo Finance v1 search endpoint
    // quotesCount ensures we get a decent number of suggestion objects back
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${query}&quotesCount=8`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Yahoo Search API returned ${response.status}`);
    }

    const data = await response.json();
    
    // We only need the quotes array
    const quotes = data.quotes || [];
    
    // Map to a cleaner format and filter out quotes that don't have symbols
    const cleanResults = quotes
      .filter((item: any) => item.symbol)
      .map((item: any) => ({
        symbol: item.symbol,
        shortname: item.shortname || item.longname || item.symbol,
        exchDisp: item.exchDisp || item.exchange || ''
      }));

    return res.status(200).json(cleanResults);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn("Search API Error: Timeout");
      return res.status(504).json({ error: "Yahoo Finance API timeout." });
    }
    console.error("Search API Error:", error);
    return res.status(500).json({ error: "Failed to fetch search suggestions." });
  }
}

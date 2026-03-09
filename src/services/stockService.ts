import { StockDataPoint, AnalysisDataPoint, QuoteData } from "../types";
import { parseISO, getYear, getMonth } from "date-fns";

export const fetchStockData = async (symbol: string): Promise<StockDataPoint[]> => {
  const response = await fetch(`/api/stock/${symbol}`);
  if (!response.ok) throw new Error("Failed to fetch stock data");
  return response.json();
};

export const fetchQuoteData = async (symbol: string): Promise<QuoteData> => {
  const response = await fetch(`/api/quote/${symbol}`);
  if (!response.ok) throw new Error("Failed to fetch quote data");
  return response.json();
};

export const processStockData = (data: StockDataPoint[]): AnalysisDataPoint[] => {
  const processed: AnalysisDataPoint[] = [];

  for (let i = 0; i < data.length; i++) {
    const current = data[i];
    const prev = i > 0 ? data[i - 1] : null;

    // Daily Return
    const dailyReturn = prev ? (current.close - prev.close) / prev.close : null;

    // Moving Averages
    const ma50 = i >= 49 ? data.slice(i - 49, i + 1).reduce((sum, d) => sum + d.close, 0) / 50 : null;
    const ma200 = i >= 199 ? data.slice(i - 199, i + 1).reduce((sum, d) => sum + d.close, 0) / 200 : null;

    // Volatility (30-day rolling annualized)
    let volatility: number | null = null;
    if (i >= 29) {
      const returns = [];
      for (let j = i - 29; j <= i; j++) {
        const c = data[j];
        const p = j > 0 ? data[j - 1] : null;
        if (p) returns.push((c.close - p.close) / p.close);
      }
      if (returns.length > 0) {
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        volatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized
      }
    }

    const date = typeof current.date === 'string' ? parseISO(current.date) : current.date;

    processed.push({
      ...current,
      dailyReturn,
      volatility,
      ma50,
      ma200,
      year: getYear(date),
      month: getMonth(date) + 1, // 1-indexed
      monthlyReturn: dailyReturn ? dailyReturn * 100 : null, // Simplified for now, will refine in heatmap
    });
  }

  return processed;
};

export const calculateMonthlyReturns = (data: AnalysisDataPoint[]) => {
  const yearlyMonthly: Record<number, Record<number, number>> = {};

  data.forEach((d) => {
    if (!yearlyMonthly[d.year]) yearlyMonthly[d.year] = {};
    if (d.dailyReturn !== null) {
      if (!yearlyMonthly[d.year][d.month]) yearlyMonthly[d.year][d.month] = 0;
      yearlyMonthly[d.year][d.month] += d.dailyReturn * 100;
    }
  });

  return yearlyMonthly;
};

export const calculateSeasonalAverages = (data: AnalysisDataPoint[]) => {
  const monthlySums: Record<number, { sum: number; count: number }> = {};

  data.forEach((d) => {
    if (!monthlySums[d.month]) monthlySums[d.month] = { sum: 0, count: 0 };
    monthlySums[d.month].sum += d.close;
    monthlySums[d.month].count += 1;
  });

  const averages = Object.entries(monthlySums).map(([month, { sum, count }]) => ({
    month: parseInt(month),
    average: sum / count,
  }));

  return averages.sort((a, b) => a.month - b.month);
};

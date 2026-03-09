export interface StockDataPoint {
  date: Date | string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose?: number;
  volume: number;
  symbol?: string;
}

export interface AnalysisDataPoint extends StockDataPoint {
  dailyReturn: number | null;
  volatility: number | null;
  ma50: number | null;
  ma200: number | null;
  year: number;
  month: number;
  monthlyReturn: number | null;
}

export interface QuoteData {
  symbol: string;
  shortName: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  marketCap: number;
}

export interface AppDocument {
  id: string;
  name: string;
  type: string;
  content: string; // Extracted text for analysis
  size: number;
}

export interface DashboardProps {
  customData?: StockDataPoint[];
  symbolName?: string;
  documents?: AppDocument[];
  onReset?: () => void;
}

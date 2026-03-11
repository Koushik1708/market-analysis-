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
  years?: number;
  documents?: AppDocument[];
  onReset?: () => void;
  onPredict?: (data?: StockDataPoint[], predictionData?: any) => void;
}

export interface PredictionPoint {
  date: string;
  actualPrice?: number;
  modelPrediction?: number;
  aiAdjustedPrediction?: number;
  upperBound?: number;
  lowerBound?: number;
}

export type MarketRegime = 
  | 'Bull Market' 
  | 'Bear Market' 
  | 'Sideways Market' 
  | 'Bearish Correction' 
  | 'Recovery Phase';

export interface MarketContext {
  indexName: string;
  trend: 'Bullish' | 'Bearish' | 'Neutral';
  dailyReturn: number;
  volatility: number;
}

export interface SectorContext {
  sectorName: string;
  momentum: number;
  volatility: number;
  correlation: number;
  trend: 'Bullish' | 'Bearish' | 'Neutral';
}

export interface InstitutionalFlow {
  score: number; // 0-100
  signal: 'Bullish' | 'Bearish' | 'Neutral';
  obvTrend: 'Up' | 'Down' | 'Flat';
  adLineTrend: 'Up' | 'Down' | 'Flat';
  volatilityExpansion: boolean;
}

export interface BacktestPoint {
  date: string;
  predictedPrice: number;
  actualPrice: number;
  error: number;
}

export interface BacktestMetrics {
  mae: number;
  rmse: number;
  directionalAccuracy: number;
  totalPredictions: number;
  testStartDate: string;
  testEndDate: string;
  predictions: BacktestPoint[];
}

export interface AIAnalysisResult {
  predictions: PredictionPoint[];
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  reasoning: string;
  keyFactors: string[];
  newsSentiment?: {
    score: number;
    label: 'Positive' | 'Neutral' | 'Negative';
    headlines: string[];
  };
  projectedRange: {
    min: number;
    max: number;
  };
  confidenceScore: number;
  marketRegime: MarketRegime;
  marketContext?: MarketContext;
  sectorContext?: SectorContext;
  institutionalFlow?: InstitutionalFlow;
  backtestMetrics?: BacktestMetrics;
}

import React, { useEffect, useState } from 'react';
import { fetchStockData, fetchQuoteData, processStockData, calculateMonthlyReturns, calculateSeasonalAverages } from '../services/stockService';
import { loadFromCache, saveToCache } from '../services/stockCacheService';
import { AnalysisDataPoint, QuoteData, DashboardProps } from '../types';
import PriceChart from './Charts/PriceChart';
import VolatilityChart from './Charts/VolatilityChart';
import MovingAverageChart from './Charts/MovingAverageChart';
import MonthlyHeatmap from './Charts/MonthlyHeatmap';
import SeasonalChart from './Charts/SeasonalChart';
import ResearchAssistant from './ResearchAssistant';
import { TrendingUp, TrendingDown, Activity, BarChart3, Calendar, RefreshCw, AlertCircle, ArrowLeft, Sparkles, BrainCircuit, Globe, Newspaper, Info } from 'lucide-react';

const DEFAULT_SYMBOL = 'SUNPHARMA.NS';

const StockDashboard: React.FC<DashboardProps> = ({ customData, symbolName, years, documents = [], onReset, onPredict }) => {
  const [data, setData] = useState<AnalysisDataPoint[]>([]);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [predictionData, setPredictionData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    // If we've already fetched the data and stored it in App state, use it
    if (customData && customData.length > 0) {
      setData(processStockData(customData));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const activeSymbol = symbolName || DEFAULT_SYMBOL;
      const activeYears = years || 5;

      // Try to load the full payload from IndexedDB cache first
      let payload: any = null;
      try {
        payload = await loadFromCache(activeSymbol, activeYears);
      } catch {
        // If cache read fails, continue to fetch fresh data
        payload = null;
      }

      if (!payload) {
        const res = await fetch("/api/analyze-stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company: activeSymbol,
            years: activeYears
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || "Failed to fetch stock data");
        }
        payload = await res.json();

        if (!payload || !payload.historicalData) {
          throw new Error("No data found for this ticker. Ensure symbol is valid.");
        }

        // Persist large payload to IndexedDB (non-blocking, failures are safe)
        saveToCache(activeSymbol, activeYears, payload).catch(() => {});
      }

      let historicalArray = payload.historicalData;
      let predResult = payload.predictionResult;

      if (!Array.isArray(historicalArray)) {
        throw new Error("Invalid data format received from API.");
      }

      // Convert iso strings back to Date objects strictly for the processor if they got stringified
      const processedFormat = historicalArray.map(d => ({
        ...d,
        date: typeof d.date === 'string' ? new Date(d.date) : d.date
      }));
      processedFormat.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Fetch quote separately
      const quoteData = await fetchQuoteData(activeSymbol).catch(() => null);

      setData(processedFormat);
      setPredictionData(predResult);
      setQuote(quoteData);
    } catch (err: any) {
      console.error(err);
      setError(err.message === "Failed to fetch stock data"
        ? "Unable to fetch stock data. Please check the ticker symbol or try again."
        : (err.message || "Unable to fetch stock data. Please check the ticker symbol or try again."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [customData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 gap-4">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-zinc-500 font-medium">Analyzing Market Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 gap-4 p-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="text-xl font-bold text-zinc-900">Oops! Something went wrong</h2>
        <p className="text-zinc-500 max-w-md">{error}</p>
        <button
          onClick={loadData}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  const monthlyReturns = calculateMonthlyReturns(data);
  const seasonalAverages = calculateSeasonalAverages(data);
  const latest = data[data.length - 1];

  // Compute year range for seasonal chart
  const chartYears = [...new Set(data.map(d => d.year))].sort((a: number, b: number) => a - b);
  const yearRange = chartYears.length === 0 ? undefined : chartYears.length === 1 ? `${chartYears[0]}` : `${chartYears[0]}–${chartYears[chartYears.length - 1]}`;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-12 font-sans selection:bg-purple-500/30">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-10 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[5rem] py-4 md:py-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            {onReset && (
              <button
                onClick={onReset}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                title="Back to Upload"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-400" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600/20 border border-purple-500/30 rounded-lg flex items-center justify-center">
                <Activity className="text-purple-400 w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-neutral-100 uppercase tracking-wide">
                  {symbolName || 'Stock Analysis'}
                </h1>
                <p className="text-xs text-neutral-400 font-medium tracking-wider uppercase">
                  {customData ? 'Custom Dataset' : `${DEFAULT_SYMBOL} • NSE`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            {predictionData?.marketRegime && (
              <div className="pl-4 border-l border-neutral-800 whitespace-nowrap hidden lg:block">
                <p className="text-xs text-neutral-500 uppercase tracking-widest mb-0.5">Market Regime</p>
                <p className="text-sm font-bold text-purple-400 flex items-center gap-1.5"><Globe className="w-4 h-4" /> {predictionData.marketRegime}</p>
              </div>
            )}
            
            {quote && (
              <div className="text-left md:text-right w-full md:w-auto">
                <div className="text-xl md:text-2xl font-bold text-neutral-100 tracking-tight">₹{quote.regularMarketPrice.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                <div className={`flex items-center justify-start md:justify-end gap-1 text-sm font-semibold ${quote.regularMarketChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {quote.regularMarketChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {quote.regularMarketChange >= 0 ? '+' : ''}{quote.regularMarketChange.toFixed(2)} ({quote.regularMarketChangePercent.toFixed(2)}%)
                </div>
              </div>
            )}

            {customData && (
              <div className="text-left md:text-right w-full md:w-auto">
                <div className="text-xl md:text-2xl font-bold text-neutral-100">₹{latest.close.toLocaleString('en-IN')}</div>
                <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Last Recorded</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 overflow-x-hidden">
        
        {/* Row 2: Charts - Trading Terminal Style */}
        <div className="bg-neutral-900 p-1 md:p-6 rounded-2xl border border-neutral-800 shadow-xl relative overflow-hidden">
           <PriceChart data={data} symbolName={symbolName} />
        </div>

        {/* Row 3 Grid: Technicals, Sector, Confidence, News */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Technical Indicators */}
          <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Technical Signals
              </div>
              <ul className="space-y-4">
                 <li className="flex justify-between items-center">
                   <span className="text-sm text-neutral-400">Trend (200 SMA)</span>
                   <span className={`px-2 py-0.5 rounded text-xs font-bold ${latest.close > (latest.ma200 || 0) ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                     {latest.close > (latest.ma200 || 0) ? 'BULLISH' : 'BEARISH'}
                   </span>
                 </li>
                 <li className="flex justify-between items-center">
                   <span className="text-sm text-neutral-400">Volatility</span>
                   <span className={`px-2 py-0.5 rounded text-xs font-bold ${latest.volatility && latest.volatility > 0.25 ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                     {latest.volatility && latest.volatility > 0.25 ? 'HIGH' : 'NORMAL'}
                   </span>
                 </li>
                 <li className="flex justify-between items-center">
                   <span className="text-sm text-neutral-400">Momentum Cross</span>
                   <span className={`px-2 py-0.5 rounded text-xs font-bold ${latest.ma50 && latest.ma200 && latest.ma50 > latest.ma200 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                     {latest.ma50 && latest.ma200 && latest.ma50 > latest.ma200 ? 'GOLDEN CROSS' : 'NEUTRAL'}
                   </span>
                 </li>
              </ul>
            </div>
          </div>

          {/* Sector Correlation */}
          <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-sm flex flex-col justify-between">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Sector Correlation
            </div>
            {predictionData?.sectorContext ? (
               <div className="space-y-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-2xl font-bold text-neutral-100">{predictionData.sectorContext.sectorName}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase border ${predictionData.sectorContext.trend === 'Bullish' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{predictionData.sectorContext.trend}</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-neutral-400 mb-1.5">
                      <span>Pearson Correlation</span>
                      <span className="font-mono text-neutral-200">{predictionData.sectorContext.correlation.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                       <div className="bg-blue-500 h-full rounded-full transition-all" style={{width: `${Math.max(0, predictionData.sectorContext.correlation * 100)}%`}}></div>
                    </div>
                  </div>
               </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-neutral-600">Generating prediction to view...</div>
            )}
          </div>

          {/* Prediction Confidence */}
          <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-sm flex flex-col justify-between group relative">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-1.5 hover:text-neutral-300 transition-colors">
              <BrainCircuit className="w-4 h-4" /> Prediction Confidence
              <Info className="w-3.5 h-3.5 cursor-help" />
            </div>
            
            <div className="absolute top-[-40px] left-1/2 -translate-x-1/2 w-64 p-3 bg-neutral-800 text-neutral-200 text-xs rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-neutral-700">
              Confidence is derived from ensemble variance and AI macroeconomic conviction.
            </div>

            {predictionData ? (
               <div className="space-y-4">
                 <div className="flex items-end gap-2">
                   <span className="text-4xl font-bold text-neutral-100">{predictionData.confidenceScore || 0}%</span>
                 </div>
                 <div>
                    <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                       <div className="bg-purple-500 h-full rounded-full" style={{width: `${predictionData.confidenceScore || 0}%`}}></div>
                    </div>
                 </div>
                 <div className="flex justify-between items-center bg-neutral-950/50 p-2.5 rounded-lg border border-neutral-800/50">
                    <span className="text-xs text-neutral-500 uppercase font-semibold">AI Sentiment</span>
                    <span className={`text-xs font-bold uppercase ${predictionData.sentiment === 'Bullish' ? 'text-emerald-400' : predictionData.sentiment === 'Bearish' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {predictionData.sentiment}
                    </span>
                 </div>
               </div>
            ) : (
               <div className="flex-1 flex items-center justify-center text-sm text-neutral-600">Loading AI...</div>
            )}
          </div>

          {/* News Sentiment */}
          <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-sm flex flex-col justify-between">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Newspaper className="w-4 h-4" /> News Sentiment
            </div>
            {predictionData?.newsSentiment ? (
              <div className="space-y-3">
                 <div className="flex items-center gap-3">
                   <span className={`text-sm font-bold uppercase px-2.5 py-1 rounded border ${predictionData.newsSentiment.label === 'Positive' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : predictionData.newsSentiment.label === 'Negative' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-neutral-800 text-neutral-300 border-neutral-700'}`}>
                     {predictionData.newsSentiment.label}
                   </span>
                   <span className="text-sm font-mono text-neutral-400">Score: {predictionData.newsSentiment.score}</span>
                 </div>
                 <ul className="space-y-2 mt-2">
                   {predictionData.newsSentiment.headlines?.slice(0, 2).map((headline: string, i: number) => (
                      <li key={i} className="text-xs text-neutral-400 line-clamp-2 leading-relaxed border-l-2 border-neutral-800 pl-2">
                        {headline}
                      </li>
                   ))}
                 </ul>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-neutral-600">Checking API sources...</div>
            )}
          </div>
        </div>

        {/* Deep Analysis Expanders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
           <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl overflow-hidden">
              <MovingAverageChart data={data} />
           </div>
           <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl overflow-hidden">
              <VolatilityChart data={data} />
           </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
           <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl overflow-hidden">
              <SeasonalChart data={seasonalAverages} yearRange={yearRange} />
           </div>
           <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl overflow-hidden">
              <MonthlyHeatmap data={monthlyReturns} />
           </div>
        </div>

        {/* Research Assistant */}
        {documents.length > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl overflow-hidden mt-6">
            <ResearchAssistant documents={documents} />
          </div>
        )}

        {/* AI Prediction CTA */}
        {onPredict && (
          <section className="bg-gradient-to-br from-neutral-900 to-neutral-950 p-8 rounded-3xl shadow-2xl border border-purple-500/30 text-white relative overflow-hidden group mt-8">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 mix-blend-overlay"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 blur-[100px] rounded-full point-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 mb-2 text-neutral-100 tracking-tight">
                  <Sparkles className="text-purple-400" /> Executive AI Summary
                </h2>
                <p className="text-neutral-400 max-w-xl text-sm leading-relaxed">
                  Open the full Artificial Intelligence terminal. Gemini examines idiosyncratic momentum, macro-economic regimes, and sector correlation metrics to project a 14-day probability forecast.
                </p>
              </div>
              <button
                onClick={() => onPredict && onPredict(data, predictionData)}
                className="shrink-0 px-8 py-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-500 transition-all shadow-[0_0_40px_-10px_rgba(168,85,247,0.4)] hover:shadow-[0_0_60px_-15px_rgba(168,85,247,0.6)] hover:scale-105 flex items-center gap-2 border border-purple-400/50 uppercase tracking-widest text-sm"
              >
                <BrainCircuit className="w-5 h-5" /> Enter Terminal
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

const StatCard = ({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) => (
  <div className="bg-neutral-900 p-6 rounded-2xl shadow-sm border border-neutral-800 flex items-start justify-between">
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-neutral-100">{value}</h3>
    </div>
    <div className="p-2 bg-neutral-800 rounded-lg">
      {icon}
    </div>
  </div>
);

const InsightItem = ({ label, value, color }: { label: string; value: string; color: 'emerald' | 'red' | 'orange' | 'blue' }) => {
  const colorClasses = {
    emerald: 'text-emerald-600',
    red: 'text-red-600',
    orange: 'text-orange-600',
    blue: 'text-blue-600'
  };

  return (
    <li className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100">
      <span className="text-sm font-medium text-zinc-600">{label}</span>
      <span className={`text-sm font-bold ${colorClasses[color]}`}>{value}</span>
    </li>
  );
};

export default StockDashboard;

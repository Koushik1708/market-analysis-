import React, { useEffect, useState } from 'react';
import { fetchStockData, fetchQuoteData, processStockData, calculateMonthlyReturns, calculateSeasonalAverages } from '../services/stockService';
import { AnalysisDataPoint, QuoteData, DashboardProps } from '../types';
import PriceChart from './Charts/PriceChart';
import VolatilityChart from './Charts/VolatilityChart';
import MovingAverageChart from './Charts/MovingAverageChart';
import MonthlyHeatmap from './Charts/MonthlyHeatmap';
import SeasonalChart from './Charts/SeasonalChart';
import ResearchAssistant from './ResearchAssistant';
import { TrendingUp, TrendingDown, Activity, BarChart3, Calendar, RefreshCw, AlertCircle, ArrowLeft, Sparkles, BrainCircuit } from 'lucide-react';

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

      const cacheKey = `stock_data_v2_${activeSymbol}_${activeYears}`;
      let payload: any = null;
      try {
        const cachedStr = sessionStorage.getItem(cacheKey);
        if (cachedStr) {
          payload = JSON.parse(cachedStr);
        }
      } catch (e) {
        console.warn("Session storage failed to parse cache", e);
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

        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(payload));
        } catch (e) {
          console.warn("Could not save to session storage (quota exceeded or unavailable)", e);
        }
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
    <div className="min-h-screen bg-zinc-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-[5rem] py-4 md:py-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            {onReset && (
              <button
                onClick={onReset}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                title="Back to Upload"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-600" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Activity className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-zinc-900">
                  {symbolName || 'Stock Analysis'}
                </h1>
                <p className="text-xs text-zinc-500 font-medium tracking-wider uppercase">
                  {customData ? 'Custom Dataset' : `${DEFAULT_SYMBOL} • NSE India`}
                </p>
              </div>
            </div>
          </div>

          {quote && (
            <div className="text-left md:text-right w-full md:w-auto">
              <div className="text-xl md:text-2xl font-bold text-zinc-900">₹{quote.regularMarketPrice.toLocaleString('en-IN')}</div>
              <div className={`flex items-center justify-start md:justify-end gap-1 text-sm font-semibold ${quote.regularMarketChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {quote.regularMarketChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {quote.regularMarketChange >= 0 ? '+' : ''}{quote.regularMarketChange.toFixed(2)} ({quote.regularMarketChangePercent.toFixed(2)}%)
              </div>
            </div>
          )}

          {customData && (
            <div className="text-left md:text-right w-full md:w-auto">
              <div className="text-xl md:text-2xl font-bold text-zinc-900">₹{latest.close.toLocaleString('en-IN')}</div>
              <p className="text-xs text-zinc-500 font-medium uppercase">Last Recorded Price</p>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 md:py-8 space-y-6 md:space-y-8 overflow-x-hidden">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title={customData ? "Total Records" : "Market Cap"}
            value={customData ? data.length.toString() : `₹${(quote?.marketCap ? quote.marketCap / 1e11 : 0).toFixed(2)}T`}
            icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
          />
          <StatCard
            title="Period High"
            value={`₹${Math.max(...data.map(d => d.high)).toLocaleString('en-IN')}`}
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          />
          <StatCard
            title="Period Low"
            value={`₹${Math.min(...data.map(d => d.low)).toLocaleString('en-IN')}`}
            icon={<TrendingDown className="w-5 h-5 text-red-500" />}
          />
          <StatCard
            title="Current Volatility"
            value={`${((latest?.volatility || 0) * 100).toFixed(2)}%`}
            icon={<Activity className="w-5 h-5 text-orange-500" />}
          />
        </div>

        {/* Charts - One by One */}
        <PriceChart data={data} symbolName={symbolName} />
        <MovingAverageChart data={data} />
        <VolatilityChart data={data} />
        <SeasonalChart data={seasonalAverages} yearRange={yearRange} />
        <MonthlyHeatmap data={monthlyReturns} />

        {/* Research Assistant */}
        {documents.length > 0 && (
          <ResearchAssistant documents={documents} />
        )}

        {/* Insights Section */}
        <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-black/5">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-zinc-900">Mathematical Insights</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <p className="text-zinc-600 leading-relaxed">
                The provided dataset has been analyzed using standard quantitative finance algorithms.
                We've calculated rolling volatility, moving averages, and seasonal performance mapping
                to give you a professional view of the asset's behavior.
              </p>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <h4 className="font-semibold text-blue-900 mb-1">Data Integrity</h4>
                <p className="text-sm text-blue-800">
                  Analysis is performed locally on your browser. Your data is never uploaded to our servers,
                  ensuring maximum privacy and security.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-zinc-900">Technical Summary</h4>
              <ul className="space-y-3">
                <InsightItem label="Trend" value={latest.close > (latest.ma200 || 0) ? 'Bullish' : 'Bearish'} color={latest.close > (latest.ma200 || 0) ? 'emerald' : 'red'} />
                <InsightItem label="Volatility" value={latest.volatility && latest.volatility > 0.25 ? 'High' : 'Moderate'} color={latest.volatility && latest.volatility > 0.25 ? 'orange' : 'blue'} />
                <InsightItem label="MA Cross" value={latest.ma50 && latest.ma200 && latest.ma50 > latest.ma200 ? 'Golden Cross' : 'Death Cross'} color={latest.ma50 && latest.ma200 && latest.ma50 > latest.ma200 ? 'emerald' : 'red'} />
              </ul>
            </div>
          </div>
        </section>

        {/* AI Prediction CTA */}
        {onPredict && (
          <section className="bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-8 rounded-3xl shadow-xl border border-purple-700/50 text-white relative overflow-hidden group">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
                  <Sparkles className="text-purple-300" /> AI Price Prediction
                </h2>
                <p className="text-purple-200 max-w-xl">
                  Take your analysis to the next level. Let our Gemini AI analyze historical momentum and current macroeconomic factors (geopolitics, inflation, etc.) to forecast the next 14 days of market movement.
                </p>
              </div>
              <button
                onClick={() => onPredict && onPredict(data, predictionData)}
                className="shrink-0 px-8 py-4 bg-white text-purple-900 rounded-xl font-bold hover:bg-purple-50 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)] hover:scale-105 flex items-center gap-2"
              >
                <BrainCircuit className="w-5 h-5" /> Generate Forecast
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

const StatCard = ({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5 flex items-start justify-between">
    <div>
      <p className="text-sm font-medium text-zinc-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-zinc-900">{value}</h3>
    </div>
    <div className="p-2 bg-zinc-50 rounded-lg">
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

import React, { useEffect, useState } from 'react';
import { fetchStockData, fetchQuoteData, processStockData, calculateMonthlyReturns, calculateSeasonalAverages } from '../services/stockService';
import { AnalysisDataPoint, QuoteData, DashboardProps } from '../types';
import PriceChart from './Charts/PriceChart';
import VolatilityChart from './Charts/VolatilityChart';
import MovingAverageChart from './Charts/MovingAverageChart';
import MonthlyHeatmap from './Charts/MonthlyHeatmap';
import SeasonalChart from './Charts/SeasonalChart';
import ResearchAssistant from './ResearchAssistant';
import { TrendingUp, TrendingDown, Activity, BarChart3, Calendar, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';

const DEFAULT_SYMBOL = 'SUNPHARMA.NS';

const StockDashboard: React.FC<DashboardProps> = ({ customData, symbolName, documents = [], onReset }) => {
  const [data, setData] = useState<AnalysisDataPoint[]>([]);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (customData) {
      setData(processStockData(customData));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [stockData, quoteData] = await Promise.all([
        fetchStockData(DEFAULT_SYMBOL),
        fetchQuoteData(DEFAULT_SYMBOL)
      ]);
      const processed = processStockData(stockData);
      setData(processed);
      setQuote(quoteData);
    } catch (err) {
      console.error(err);
      setError("Failed to load stock data. Please check your connection or try again later.");
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

  return (
    <div className="min-h-screen bg-zinc-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
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
                  {symbolName || 'Sun Pharma Analysis'}
                </h1>
                <p className="text-xs text-zinc-500 font-medium tracking-wider uppercase">
                  {customData ? 'Custom Dataset' : `${DEFAULT_SYMBOL} • NSE India`}
                </p>
              </div>
            </div>
          </div>
          
          {quote && (
            <div className="text-right">
              <div className="text-2xl font-bold text-zinc-900">₹{quote.regularMarketPrice.toLocaleString('en-IN')}</div>
              <div className={`flex items-center justify-end gap-1 text-sm font-semibold ${quote.regularMarketChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {quote.regularMarketChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {quote.regularMarketChange >= 0 ? '+' : ''}{quote.regularMarketChange.toFixed(2)} ({quote.regularMarketChangePercent.toFixed(2)}%)
              </div>
            </div>
          )}

          {customData && (
             <div className="text-right">
                <div className="text-2xl font-bold text-zinc-900">₹{latest.close.toLocaleString('en-IN')}</div>
                <p className="text-xs text-zinc-500 font-medium uppercase">Last Recorded Price</p>
             </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
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
        <PriceChart data={data} />
        <MovingAverageChart data={data} />
        <VolatilityChart data={data} />
        <SeasonalChart data={seasonalAverages} />
        <MonthlyHeatmap data={monthlyReturns} />

        {/* Research Assistant */}
        {documents.length > 0 && (
          <ResearchAssistant documents={documents} />
        )}

        {/* Insights Section */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-black/5">
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

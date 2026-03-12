import React, { useState, useEffect } from 'react';
import { AnalysisDataPoint, AIAnalysisResult, PredictionPoint } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Sparkles,
  BrainCircuit,
  TrendingUp,
  Globe,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Newspaper,
  Info,
  Activity,
  BarChart3
} from 'lucide-react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface Props {
  data: AnalysisDataPoint[];
  predictionResult?: AIAnalysisResult | null;
  symbolName?: string;
  onBack: () => void;
}

// Simple internal Error Boundary fallback logic using hooks where possible, 
// but since real ErrorBoundary needs class, we'll wrap the critical chart render in a robust try-catch block 
// or just rely on strict optional chaining which React handles gracefully.

const AIPredictionPage: React.FC<Props> = ({ data, predictionResult, symbolName, onBack }) => {
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [showBacktestOverlay, setShowBacktestOverlay] = useState<boolean>(false);

  // Derived state for support, resistance, and risk
  const last60 = data?.slice(-60) || [];
  const support = last60.length > 0 ? Math.min(...last60.map(d => d.close)) : 0;
  const resistance = last60.length > 0 ? Math.max(...last60.map(d => d.close)) : 0;

  const latestVol = data[data.length - 1]?.volatility || 0.15;
  const riskLevel = latestVol < 0.15 ? 'Low' : latestVol < 0.25 ? 'Moderate' : 'High';
  const lastDataPoint = data[data.length - 1];
  const todayDate = lastDataPoint ? (typeof lastDataPoint.date === 'string' ? lastDataPoint.date : format(lastDataPoint.date as Date, 'yyyy-MM-dd')) : '';

  useEffect(() => {
    console.log("Prediction API response:", predictionResult);

    if (!data || data.length === 0) {
      onBack();
      return;
    }

    // Safely extract the prediction data, handling cases where it might be wrapped
    const safePrediction = predictionResult?.predictionResult ?? predictionResult?.prediction ?? predictionResult;

    if (!safePrediction || !safePrediction.predictions || safePrediction.predictions.length === 0) {
      console.error("Missing or malformed prediction block:", predictionResult);
      setError("Prediction data is missing. Please go back to the dashboard and try again.");
      return;
    }

    try {
      setResult(null);
      setChartData([]);
      setError(null);

      // Quickly sequence through loading steps purely for UI UX feel
      let stepNum = 1;
      setLoadingStep(stepNum);
      const interval = setInterval(() => {
        stepNum++;
        if (stepNum > 3) {
          clearInterval(interval);
          setResult(safePrediction);

          // Combine historical actuals and future predictions for chart
          const historical = data.slice(-40).map(d => {
            const dateStr = typeof d.date === 'string' ? d.date : format(d.date as Date, 'yyyy-MM-dd');
            const btPred = safePrediction?.backtestMetrics?.predictions?.find((p: any) => p.date === dateStr);

            return {
              date: dateStr,
              actualPrice: d.close,
              modelPrediction: undefined,
              aiAdjustedPrediction: undefined,
              lowerBound: undefined,
              upperBound: undefined,
              probabilityBounds: undefined,
              backtestPrediction: btPred ? btPred.predictedPrice : undefined
            };
          });

          const future = (safePrediction?.predictions ?? []).map((p: any) => ({
            ...p,
            probabilityBounds: p.lowerBound !== undefined && p.upperBound !== undefined
              ? [p.lowerBound, p.upperBound]
              : undefined
          }));

          setChartData([...historical, ...future]);
        } else {
          setLoadingStep(stepNum);
        }
      }, 400);

      return () => clearInterval(interval);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to render AI predictions.');
    }
  }, [data, predictionResult, symbolName]);

  const steps = [
    { id: 1, text: "Computing Ensemble Forecasting Models...", icon: <BrainCircuit className="w-5 h-5 text-blue-500" /> },
    { id: 2, text: "Generating Qualitative Explanation (Gemini AI)...", icon: <Globe className="w-5 h-5 text-purple-500" /> },
    { id: 3, text: "Compiling Professional Analytics Dashboard...", icon: <Sparkles className="w-5 h-5 text-emerald-500" /> }
  ];

  // Robust render helpers
  const renderValue = (val: number | undefined | null, decimals: number = 2, prefix: string = '') => {
    if (val === undefined || val === null || isNaN(val)) return '--';
    return `${prefix}${val.toFixed(decimals)}`;
  };

  return (
    <div className="min-h-screen bg-zinc-50 pb-12">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900">AI Price Prediction Dashboard</h1>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{symbolName || 'Asset'} • Ensemble Forecasting</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!result && !error ? (
          <div className="max-w-2xl mx-auto mt-20 bg-white p-8 rounded-3xl shadow-sm border border-black/5">
            <h2 className="text-2xl font-bold text-zinc-900 mb-8 text-center flex items-center justify-center gap-2">
              <Sparkles className="text-purple-600" /> Running Global Analysis...
            </h2>
            <div className="space-y-6">
              {steps.map((step) => {
                const isActive = loadingStep === step.id;
                const isPast = loadingStep > step.id;
                return (
                  <div key={step.id} className={`flex items-center gap-4 p-4 rounded-xl transition-all ${isActive ? 'bg-purple-50 border border-purple-100 scale-105' : isPast ? 'opacity-50' : 'opacity-30 grayscale'}`}>
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                      {isPast ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : isActive ? <Loader2 className="w-5 h-5 text-purple-600 animate-spin" /> : step.icon}
                    </div>
                    <span className={`font-medium ${isActive ? 'text-purple-900' : 'text-zinc-600'}`}>{step.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : error ? (
          <div className="max-w-xl mx-auto mt-20 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-zinc-900">Prediction Failed</h2>
            <p className="text-zinc-500 bg-red-50 p-4 rounded-xl font-mono text-sm border border-red-100">{error}</p>
            <button onClick={onBack} className="mt-4 px-6 py-2 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800">Return to Dashboard</button>
          </div>
        ) : result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Macro & Institutional Context Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {result.marketContext && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
                  <div className="text-sm font-medium text-zinc-500 mb-1 flex items-center gap-2">
                    <Globe className="w-4 h-4" /> Market Context ({result.marketContext.indexName})
                  </div>
                  <div className={`text-xl font-bold ${result.marketContext.trend === 'Bullish' ? 'text-emerald-600' : result.marketContext.trend === 'Bearish' ? 'text-red-600' : 'text-zinc-600'}`}>
                    {result.marketContext.trend} <span className="text-sm font-normal text-zinc-500 ml-2">({result.marketContext.dailyReturn > 0 ? '+' : ''}{result.marketContext.dailyReturn.toFixed(2)}%)</span>
                  </div>
                </div>
              )}
              {result.sectorContext && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
                  <div className="text-sm font-medium text-zinc-500 mb-1 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Sector Trend ({result.sectorContext.sectorName})
                  </div>
                  <div className={`text-xl font-bold ${result.sectorContext.trend === 'Bullish' ? 'text-emerald-600' : result.sectorContext.trend === 'Bearish' ? 'text-red-600' : 'text-zinc-600'}`}>
                    {result.sectorContext.trend} <span className="text-sm font-normal text-zinc-500 ml-2">(Score: {result.sectorContext.momentum.toFixed(0)})</span>
                  </div>
                </div>
              )}
              {result.institutionalFlow && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
                  <div className="text-sm font-medium text-zinc-500 mb-1 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Institutional Activity Signal
                  </div>
                  <div className={`text-xl font-bold flex items-center gap-2 ${result.institutionalFlow.signal === 'Bullish' ? 'text-emerald-600' : result.institutionalFlow.signal === 'Bearish' ? 'text-red-600' : 'text-yellow-600'}`}>
                    {result.institutionalFlow.signal} <span className="text-sm text-zinc-500 font-normal ml-2">({result.institutionalFlow.score}/100)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Forecast Summary & Regime Panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
                <div className="text-sm font-medium text-zinc-500 mb-1 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Market Regime
                </div>
                <div className="text-xl font-bold text-purple-700">
                  {result.marketRegime || '--'}
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
                <div className="text-sm font-medium text-zinc-500 mb-1">Expected Trend</div>
                <div className={`text-xl font-bold flex items-center gap-2 ${result.sentiment === 'Bullish' ? 'text-emerald-600' :
                  result.sentiment === 'Bearish' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                  {result.sentiment === 'Bullish' ? '📈' : result.sentiment === 'Bearish' ? '📉' : '➖'} {result.sentiment || 'Neutral'}
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 relative group">
                <div className="text-sm font-medium text-zinc-500 mb-1 flex items-center gap-1">
                  Prediction Confidence
                  <Info className="w-3.5 h-3.5 text-zinc-400 cursor-help" />
                </div>
                {/* Tooltip */}
                <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 -translate-y-full w-64 p-3 bg-zinc-900 text-white text-xs rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  Confidence is mapped using ML ensemble variance, ATR volatility, regime stability, and institutional volume flows.
                  <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 rotate-45"></div>
                </div>
                <div className="text-xl font-bold text-zinc-900 flex items-center gap-3">
                  <span>{result.confidenceScore ?? '--'}%</span>
                  <div className="flex-1 bg-zinc-100 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${result.confidenceScore || 0}%` }} />
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
                <div className="text-sm font-medium text-zinc-500 mb-1">Risk Level</div>
                <div className={`text-xl font-bold ${riskLevel === 'Low' ? 'text-emerald-600' :
                  riskLevel === 'Moderate' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                  {riskLevel}
                </div>
              </div>
            </div>

            {/* Chart Section */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                  <TrendingUp className="text-blue-600" /> Forecast Chart
                </h3>
                <div className="text-sm text-zinc-500 font-medium bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-100">
                  Projected Range: <span className="text-zinc-900 font-bold">{renderValue(result.projectedRange?.min, 0, '₹')} – {renderValue(result.projectedRange?.max, 0, '₹')}</span>
                </div>
              </div>

              <div className="h-[500px] w-full">
                <ResponsiveContainer>
                  <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <defs>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorBand" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9333ea" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#9333ea" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(tick) => {
                        try { return format(parseISO(String(tick)), 'MMM dd') } catch (e) { return String(tick) }
                      }}
                      minTickGap={30}
                      stroke="#888" fontSize={12}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      stroke="#888"
                      fontSize={12}
                      tickFormatter={(v) => `₹${Number(v || 0).toFixed(0)}`}
                    />
                    <Tooltip
                      labelFormatter={(label) => {
                        try { return format(parseISO(String(label)), 'PPP') } catch (e) { return String(label) }
                      }}
                      formatter={(value: any, name: string, props: any) => {
                        const valNum = Number(value);
                        if (isNaN(valNum)) return [String(value), name];

                        if (name === 'ProbabilityBounds') {
                          return [`₹${Number(props.payload.lowerBound || 0).toFixed(0)} – ₹${Number(props.payload.upperBound || 0).toFixed(0)}`, 'Prediction Range'];
                        }

                        const cleanName =
                          name === 'actualPrice' ? 'Actual Price' :
                            name === 'modelPrediction' ? 'Statistical Ensemble Forecast' :
                              name === 'aiAdjustedPrediction' ? 'AI Adjusted Forecast' :
                                name === 'backtestPrediction' ? 'Backtest Forecast' : name;

                        return [`₹${valNum.toFixed(2)}`, cleanName];
                      }}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #f4f4f5', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                      labelStyle={{ color: '#18181b', fontWeight: 'bold', borderBottom: '1px solid #f4f4f5', paddingBottom: '8px', marginBottom: '8px' }}
                    />
                    <Legend verticalAlign="top" height={36} />

                    {/* Support and Resistance Zones */}
                    {support > 0 && (
                      <ReferenceArea y1={support * 0.99} y2={support * 1.01} {...{ fill: "#22c55e", fillOpacity: 0.1, strokeOpacity: 0 } as any} />
                    )}
                    {support > 0 && (
                      <ReferenceLine y={support} stroke="#22c55e" strokeDasharray="3 3" label={{ position: 'insideBottomLeft', value: 'Support', fill: '#22c55e', fontSize: 12, fontWeight: 'bold' }} />
                    )}

                    {resistance > 0 && (
                      <ReferenceArea y1={resistance * 0.99} y2={resistance * 1.01} {...{ fill: "#ef4444", fillOpacity: 0.1, strokeOpacity: 0 } as any} />
                    )}
                    {resistance > 0 && (
                      <ReferenceLine y={resistance} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Resistance', fill: '#ef4444', fontSize: 12, fontWeight: 'bold' }} />
                    )}

                    {/* Divider for Today */}
                    <ReferenceLine x={todayDate as string} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Today', fill: '#ef4444', fontSize: 12, fontWeight: 'bold' }} />

                    {/* Probability Band (Area chart using [lowerBound, upperBound]) */}
                    <Area
                      type="monotone"
                      dataKey="probabilityBounds"
                      name="ProbabilityBounds"
                      stroke="#9333ea"
                      strokeWidth={0}
                      fill="url(#colorBand)"
                      activeDot={false}
                    />

                    {/* Actual Price */}
                    <Area type="monotone" dataKey="actualPrice" name="Actual Price" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorActual)" />

                    {/* Optional Backtest Overlay */}
                    {showBacktestOverlay && (
                      <Line type="monotone" dataKey="backtestPrediction" name="Backtest Forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                    )}

                    {/* Ensemble Forecast */}
                    <Line type="monotone" dataKey="modelPrediction" name="Statistical Ensemble Forecast" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" dot={false} />

                    {/* AI Adjusted (same line as ensemble in our deterministic setup, but explicit) */}
                    <Line type="monotone" dataKey="aiAdjustedPrediction" name="AI Adjusted Forecast" stroke="#9333ea" strokeWidth={3} dot={{ r: 3, fill: '#9333ea' }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Metrics & Sentiment */}
              <div className="space-y-6 lg:col-span-1">

                {/* Backtesting / Model Performance */}
                {result.backtestMetrics && (
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" /> Model Performance
                      </h4>
                      <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                          checked={showBacktestOverlay}
                          onChange={(e) => setShowBacktestOverlay(e.target.checked)}
                        />
                        Show Overlay
                      </label>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                        <span className="text-sm text-zinc-600 font-medium">Directional Accuracy</span>
                        <span className="font-bold text-emerald-600">{result.backtestMetrics.directionalAccuracy}%</span>
                      </div>
                      <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                        <span className="text-sm text-zinc-600 font-medium">Average Error (MAE)</span>
                        <span className="font-bold text-zinc-900">{renderValue(result.backtestMetrics.mae, 2, '₹')}</span>
                      </div>
                      <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                        <span className="text-sm text-zinc-600 font-medium">Deviation (RMSE)</span>
                        <span className="font-bold text-zinc-900">{renderValue(result.backtestMetrics.rmse, 2, '₹')}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-zinc-100">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Test Period</span>
                        <span className="text-sm font-bold text-zinc-700">
                          {format(parseISO(result.backtestMetrics.testStartDate), 'MMM d, yyyy')} – {format(parseISO(result.backtestMetrics.testEndDate), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Predictions</span>
                        <span className="text-sm font-bold text-zinc-700">
                          {result.backtestMetrics.totalPredictions}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Market News Sentiment */}
                {result.newsSentiment && (
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Newspaper className="w-4 h-4" /> Market News Sentiment
                    </h4>

                    <div className="flex items-center gap-3 mb-6">
                      <div className={`px-3 py-1.5 rounded-lg font-bold text-sm border ${result.newsSentiment?.label === 'Positive' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        result.newsSentiment?.label === 'Negative' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}>
                        Score: {(result.newsSentiment?.score || 0) > 0 ? '+' : ''}{result.newsSentiment?.score || 0} ({result.newsSentiment?.label || 'Neutral'})
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Recent Headlines</p>
                      <ul className="space-y-3">
                        {Array.isArray(result.newsSentiment?.headlines) ? result.newsSentiment?.headlines.map((headline, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-zinc-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 mt-2 shrink-0" />
                            <span>{headline}</span>
                          </li>
                        )) : null}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Reasoning & Factors */}
              <div className="space-y-6 lg:col-span-2 flex flex-col">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 flex-grow">
                  <h4 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-3">
                    <BrainCircuit className="w-6 h-6 text-purple-600" /> AI Macro Reasoning Report
                  </h4>
                  <div className="prose prose-purple max-w-none">
                    {(Array.isArray(result.reasoning) ? result.reasoning : String(result.reasoning || '').split('\n'))
                      .filter(p => typeof p === 'string' && p.trim())
                      .map((paragraph, i) => (
                        <p key={i} className="text-zinc-600 leading-relaxed text-lg">{paragraph}</p>
                      ))}
                  </div>

                  <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mt-8 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Key Driving Factors
                  </h4>
                  <ul className="space-y-3">
                    {(Array.isArray(result.keyFactors) ? result.keyFactors : (result.keyFactors ? [String(result.keyFactors)] : [])).map((f, i) => (
                      <li key={i} className="flex items-start gap-3 bg-zinc-50 p-4 rounded-2xl text-sm leading-relaxed text-zinc-700 border border-zinc-100">
                        <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">{i + 1}</div>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AIPredictionPage;

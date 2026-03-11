import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart2, Shield, ArrowRight, Loader2, AlertCircle, FileText, Search } from 'lucide-react';
import { StockDataPoint, AppDocument } from '../types';

interface SearchResult {
  symbol: string;
  shortname: string;
  exchDisp: string;
}

interface LandingPageProps {
  onDataLoaded: (data: StockDataPoint[], fileName: string, documents: AppDocument[], years?: number) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onDataLoaded }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticker, setTicker] = useState('Tata Steel');
  const [years, setYears] = useState('5');
  
  // Autocomplete State
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced Search Logic
  useEffect(() => {
    const fetchSuggestions = async () => {
      const q = ticker.trim();
      if (q.length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }
      
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search-tickers?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          setShowDropdown(data.length > 0);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      // Don't search if the user just clicked a suggestion which perfectly matches the current ticker
      const perfectMatch = suggestions.find(s => s.symbol === ticker.trim());
      if (!perfectMatch) {
        fetchSuggestions();
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [ticker]);

  const handleSelectSuggestion = (sym: string) => {
    setTicker(sym);
    setShowDropdown(false);
    setSuggestions([]);
  };

  const handleAnalyze = async () => {
    if (!ticker.trim()) {
      setError("Please enter a valid stock ticker symbol.");
      return;
    }
    
    const yrNum = parseInt(years, 10) || 5;
    const t = ticker.trim();
    
    // Instead of fetching data here, we pass the parameters to the parent component
    // which will transition to the Dashboard for fetching.
    onDataLoaded([], t, [], yrNum);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050505] text-white font-sans">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0 opacity-50"
        style={{
          backgroundImage: `url('/hero-bg.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 20%',
          filter: 'brightness(0.85)'
        }}
      />

      {/* Animated Stock Candlestick Chart Behind Person */}
      <div className="absolute inset-0 z-[1] opacity-30 pointer-events-none">
        <AnimatedCandlesticks />
      </div>

      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/70 via-black/30 to-black" />

      {/* Animated Glow Elements */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px] animate-pulse delay-700" />

      <main className="relative z-20 flex flex-col items-center justify-center min-h-screen px-4 py-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl w-full"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-8">
            <Shield className="w-3 h-3" />
            Professional Grade Analytics
          </div>
          
          <h1 className="text-5xl md:text-8xl font-bold tracking-tighter mb-4 md:mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-zinc-500 leading-tight">
            QUANTUM <br /> ANALYTICS
          </h1>
          
          <p className="text-lg md:text-xl text-zinc-400 mb-8 md:mb-12 max-w-2xl mx-auto leading-relaxed px-4 md:px-0">
            Enter any global stock ticker symbol to generate instant, institutional-grade insights and AI-driven 14-day forecasts.
          </p>

          {/* Input Panel */}
          <div className="relative max-w-4xl mx-auto bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-zinc-800 backdrop-blur-xl">
            <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6 text-left">
              <div className="flex-1" ref={dropdownRef}>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Company Name / Ticker Input</label>
                <div className="relative w-full">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    {isSearching ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" /> : <Search className="w-5 h-5 text-zinc-500" />}
                  </div>
                  <input 
                    type="text" 
                    value={ticker}
                    onChange={(e) => {
                      setTicker(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(suggestions.length > 0)}
                    placeholder="e.g. Tata Steel, Reliance, ICICI Bank"
                    className="w-full bg-black/50 border border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                  />

                  {/* Autocomplete Dropdown — rendered inside the relative wrapper so top-full works correctly */}
                  <AnimatePresence>
                    {showDropdown && suggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 right-0 top-full mt-2 z-[9999] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto"
                      >
                        {suggestions.map((item, idx) => (
                          <div
                            key={item.symbol + idx}
                            onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(item.symbol); }}
                            className="px-4 py-3 hover:bg-neutral-800 cursor-pointer flex items-center justify-between gap-4 border-b border-white/5 last:border-0 transition-colors"
                          >
                            <div className="flex flex-col overflow-hidden min-w-0">
                              <span className="text-white font-medium truncate text-sm">{item.shortname}</span>
                              <span className="text-zinc-500 text-xs">{item.exchDisp}</span>
                            </div>
                            <span className="text-blue-400 font-mono text-xs font-bold bg-blue-500/10 px-2 py-1 rounded shrink-0">
                              {item.symbol}
                            </span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              
              <div className="w-full md:w-32">
                <label className="block text-sm font-medium text-zinc-400 mb-2">Years</label>
                <input 
                  type="number" 
                  value={years}
                  min="1"
                  max="20"
                  onChange={(e) => setYears(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full bg-black/50 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAnalyze}
                disabled={isLoading}
                className="w-full md:w-auto h-[50px] px-8 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 whitespace-nowrap"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><BarChart2 className="w-5 h-5"/> Analyze <ArrowRight className="w-4 h-4 ml-1" /></>}
              </motion.button>
            </div>
              
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm mt-4"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
            {/* Glow Effect on Hover */}
            <div className="absolute inset-0 rounded-3xl bg-blue-500/5 opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <FeatureItem 
              icon={<BarChart2 className="w-5 h-5 text-emerald-400" />}
              title="Global Multi-Asset Data"
              desc="Automatic fetching of OHLCV daily data directly."
            />
            <FeatureItem 
              icon={<FileText className="w-5 h-5 text-blue-400" />}
              title="Financial News Sentiment"
              desc="Aggregated real-time headlines with AI classification."
            />
            <FeatureItem 
              icon={<ArrowRight className="w-5 h-5 text-purple-400" />}
              title="Ensemble AI Forecasts"
              desc="Combined factor models with Gemini insights overlay."
            />
          </div>
        </motion.div>
      </main>

      {/* Footer Decoration */}
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
    </div>
  );
};

const AnimatedCandlesticks: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Generate candlestick data that slowly moves
    const numCandles = 28;
    const candleWidth = canvas.width / numCandles * 0.6;
    const gap = canvas.width / numCandles * 0.4;
    
    interface Candle {
      baseOpen: number;
      baseClose: number;
      baseHigh: number;
      baseLow: number;
      phase: number;
      speed: number;
      amplitude: number;
    }

    // Create a realistic price series that trends up/down
    let price = 0.4 + Math.random() * 0.2; // start around 40-60% of screen
    const candles: Candle[] = [];
    
    for (let i = 0; i < numCandles; i++) {
      const change = (Math.random() - 0.48) * 0.06; // slight upward bias
      const open = price;
      price += change;
      price = Math.max(0.15, Math.min(0.85, price));
      const close = price;
      const wickUp = Math.random() * 0.03;
      const wickDown = Math.random() * 0.03;
      const high = Math.max(open, close) + wickUp;
      const low = Math.min(open, close) - wickDown;
      
      candles.push({
        baseOpen: open,
        baseClose: close,
        baseHigh: high,
        baseLow: low,
        phase: Math.random() * Math.PI * 2,
        speed: 0.003 + Math.random() * 0.004,
        amplitude: 0.01 + Math.random() * 0.025
      });
    }

    let animFrame: number;
    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const totalWidth = candleWidth + gap;

      candles.forEach((candle, i) => {
        // Animated oscillation - candles slowly drift up/down
        const drift = Math.sin(time * candle.speed + candle.phase) * candle.amplitude;
        
        const open = (candle.baseOpen + drift) * canvas.height;
        const close = (candle.baseClose + drift) * canvas.height;
        const high = (candle.baseHigh + drift) * canvas.height;
        const low = (candle.baseLow + drift) * canvas.height;

        // Invert Y axis (canvas 0 is top)
        const yOpen = canvas.height - open;
        const yClose = canvas.height - close;
        const yHigh = canvas.height - high;
        const yLow = canvas.height - low;

        const x = i * totalWidth + gap / 2;
        const isBullish = close > open; // close > open = green
        
        const greenColor = 'rgba(34, 197, 94, 0.6)';
        const redColor = 'rgba(239, 68, 68, 0.6)';
        const wickGreen = 'rgba(34, 197, 94, 0.4)';
        const wickRed = 'rgba(239, 68, 68, 0.4)';

        // Draw wick (thin line from high to low)
        ctx.beginPath();
        ctx.strokeStyle = isBullish ? wickGreen : wickRed;
        ctx.lineWidth = 1.5;
        const candleCenter = x + candleWidth / 2;
        ctx.moveTo(candleCenter, yHigh);
        ctx.lineTo(candleCenter, yLow);
        ctx.stroke();

        // Draw body (rectangle from open to close)
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(Math.abs(yOpen - yClose), 2);
        
        ctx.fillStyle = isBullish ? greenColor : redColor;
        ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);

        // Subtle glow for bullish candles
        if (isBullish) {
          ctx.shadowColor = 'rgba(34, 197, 94, 0.3)';
          ctx.shadowBlur = 8;
          ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);
          ctx.shadowBlur = 0;
        }
      });

      time++;
      animFrame = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full"
      style={{ opacity: 0.8 }}
    />
  );
};

const FeatureItem = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
  <div className="p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800/50 backdrop-blur-sm">
    <div className="mb-4">{icon}</div>
    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">{title}</h3>
    <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
  </div>
);

export default LandingPage;

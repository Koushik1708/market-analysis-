import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileText, BarChart2, Shield, ArrowRight, Loader2, AlertCircle, FileCode } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist';
import { StockDataPoint, AppDocument } from '../types';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface LandingPageProps {
  onDataLoaded: (data: StockDataPoint[], fileName: string, documents: AppDocument[]) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onDataLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{
    stockData?: { data: StockDataPoint[], name: string };
    documents: AppDocument[];
  }>({ documents: [] });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  };

  const handleFile = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      if (file.name.endsWith('.pdf')) {
        const text = await extractTextFromPdf(file);
        const newDoc: AppDocument = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: 'pdf',
          content: text,
          size: file.size
        };
        setUploadedFiles(prev => ({
          ...prev,
          documents: [...prev.documents, newDoc]
        }));
      } else if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const reader = new FileReader();
        
        const dataPromise = new Promise<StockDataPoint[]>((resolve, reject) => {
          reader.onload = (e) => {
            try {
              const data = e.target?.result;
              let parsedData: any[] = [];

              if (file.name.endsWith('.csv')) {
                const results = Papa.parse(data as string, { header: false, skipEmptyLines: true });
                const rows = results.data as string[][];
                
                if (rows.length < 2) {
                  reject(new Error("CSV file is empty or invalid."));
                  return;
                }

                // Detect multi-row header (e.g., Ticker row, Date row)
                let dataStartIndex = 1;
                let headerRow = rows[0];
                let ticker = '';

                // Check if row 1 is a Ticker row
                if (rows[1] && rows[1][0]?.toLowerCase() === 'ticker') {
                  ticker = rows[1][1] || '';
                  dataStartIndex = 2;
                }
                
                // Check if next row is a Date label row
                if (rows[dataStartIndex] && rows[dataStartIndex][0]?.toLowerCase() === 'date') {
                  dataStartIndex++;
                }

                // Map rows to objects
                parsedData = rows.slice(dataStartIndex).map(row => {
                  const obj: any = {};
                  headerRow.forEach((header, index) => {
                    obj[header] = row[index];
                  });
                  if (ticker) obj.Ticker = ticker;
                  return obj;
                });
              } else {
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                parsedData = XLSX.utils.sheet_to_json(worksheet);
              }

              const mappedData: StockDataPoint[] = parsedData.map((row: any) => {
                // Try to find date in various column names
                const dateVal = row.Date || row.date || row.DATE || row.Price || row[''];
                const close = parseFloat(row.Close || row.close || row.CLOSE || row.Price || row.price);
                const open = parseFloat(row.Open || row.open || row.OPEN);
                const high = parseFloat(row.High || row.high || row.HIGH);
                const low = parseFloat(row.Low || row.low || row.LOW);
                const volume = parseFloat(row.Volume || row.volume || row.VOLUME || 0);

                // If row.Price is used for date (as in the sample), we need to be careful
                // The sample has: Price, Close, High, Low, Open, Volume
                // And data row: 2021-01-12, 887.38, ...
                // So row.Price is actually the date.
                
                let actualDate = dateVal;
                let actualClose = close;

                // Heuristic: if close is NaN but Price is a number, Price might be Close
                // But in this specific format, Price is the first column which is the Date.
                if (isNaN(new Date(actualDate).getTime())) {
                  // Try to find any column that looks like a date
                  const possibleDate = Object.values(row).find(v => !isNaN(new Date(v as string).getTime()));
                  if (possibleDate) actualDate = possibleDate;
                }

                if (!actualDate || isNaN(close)) return null;

                return {
                  date: new Date(actualDate),
                  open: isNaN(open) ? close : open,
                  high: isNaN(high) ? close : high,
                  low: isNaN(low) ? close : low,
                  close,
                  volume,
                  symbol: row.Ticker
                };
              }).filter(Boolean) as StockDataPoint[];

              if (mappedData.length === 0) {
                reject(new Error("No valid stock data found. Ensure your file has 'Date' and 'Close' columns."));
              }

              mappedData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              resolve(mappedData);
            } catch (err: any) {
              reject(err);
            }
          };
        });

        if (file.name.endsWith('.csv')) {
          reader.readAsText(file);
        } else {
          reader.readAsBinaryString(file);
        }

        const mappedData = await dataPromise;
        setUploadedFiles(prev => ({
          ...prev,
          stockData: { data: mappedData, name: file.name }
        }));
      } else {
        // Generic text file
        const text = await file.text();
        const newDoc: AppDocument = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: 'text',
          content: text,
          size: file.size
        };
        setUploadedFiles(prev => ({
          ...prev,
          documents: [...prev.documents, newDoc]
        }));
      }
    } catch (err: any) {
      setError(err.message || "Failed to process file.");
    } finally {
      setIsLoading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files) as File[];
    files.forEach(file => handleFile(file));
  };

  const handleAnalyze = () => {
    if (uploadedFiles.stockData) {
      onDataLoaded(uploadedFiles.stockData.data, uploadedFiles.stockData.name, uploadedFiles.documents);
    } else {
      setError("Please upload at least one stock data file (CSV/Excel) to begin analysis.");
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050505] text-white font-sans">
      {/* Background Image with Overlay - adjusted to show person till knees */}
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
          className="text-center max-w-4xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-8">
            <Shield className="w-3 h-3" />
            Professional Grade Analytics
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-zinc-500">
            QUANTUM <br /> ANALYTICS
          </h1>
          
          <p className="text-xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Upload your historical stock data and unlock institutional-grade insights. 
            Now supporting research PDFs and related documents.
          </p>

          {/* Upload Bar */}
          <div className="relative max-w-2xl mx-auto">
            <motion.div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              className={`
                relative group cursor-pointer
                p-8 rounded-2xl border-2 border-dashed transition-all duration-300
                ${isDragging ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}
              `}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                multiple
                accept=".csv,.xlsx,.xls,.pdf,.txt"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []) as File[];
                  files.forEach(file => handleFile(file));
                }}
              />
              
              <div className="flex flex-col items-center gap-4">
                {isLoading ? (
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-blue-600 transition-colors duration-500">
                    <Upload className="w-8 h-8 text-zinc-400 group-hover:text-white" />
                  </div>
                )}
                
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">
                    {isLoading ? 'Processing Data...' : 'Drop your Files or PDFs here'}
                  </p>
                  <p className="text-sm text-zinc-500 mt-1">
                    Supports .xlsx, .csv, .pdf, and .txt files
                  </p>
                </div>
              </div>

              {/* Glow Effect on Hover */}
              <div className="absolute inset-0 rounded-2xl bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </motion.div>

            {/* File List */}
            <AnimatePresence>
              {(uploadedFiles.stockData || uploadedFiles.documents.length > 0) && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 space-y-2 text-left"
                >
                  {uploadedFiles.stockData && (
                    <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <BarChart2 className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium text-blue-100">{uploadedFiles.stockData.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-blue-400 uppercase">Stock Data</span>
                    </div>
                  )}
                  {uploadedFiles.documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                      <div className="flex items-center gap-3">
                        {doc.type === 'pdf' ? <FileText className="w-4 h-4 text-red-400" /> : <FileCode className="w-4 h-4 text-zinc-400" />}
                        <span className="text-sm font-medium text-zinc-300">{doc.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">{doc.type}</span>
                    </div>
                  ))}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAnalyze}
                    className="w-full mt-4 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                  >
                    START ANALYSIS <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <FeatureItem 
              icon={<BarChart2 className="w-5 h-5 text-emerald-400" />}
              title="Volatility Analysis"
              desc="Annualized rolling volatility metrics."
            />
            <FeatureItem 
              icon={<FileText className="w-5 h-5 text-blue-400" />}
              title="Document Intelligence"
              desc="Analyze research PDFs and reports."
            />
            <FeatureItem 
              icon={<ArrowRight className="w-5 h-5 text-purple-400" />}
              title="Seasonal Heatmaps"
              desc="Historical monthly performance mapping."
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

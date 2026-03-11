# 📈 AI-Powered Stock Market Analysis & Prediction Dashboard

> An intelligent, full-stack financial analytics platform that combines real-time market data, ensemble machine learning, and Google Gemini AI to deliver professional-grade stock analysis and 14-day price forecasting — all in a beautiful, responsive web UI.

[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-market--analysis--six.vercel.app-blue?style=for-the-badge)](https://market-analysis-six.vercel.app)
[![Vercel Deploy](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![AI](https://img.shields.io/badge/AI-Gemini%202.0%20Flash-34A853?style=for-the-badge&logo=google)](https://aistudio.google.com)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Prediction Pipeline](#-prediction-pipeline)
- [Supported Asset Types](#-supported-asset-types)
- [Running Locally](#-running-locally)
- [Deployment](#-deployment)
- [Project Structure](#-project-structure)
- [Future Improvements](#-future-improvements)
- [Disclaimer](#%EF%B8%8F-disclaimer)

---

## 🌐 Overview

This application is a production-grade financial analytics platform for **exploring market behavior and AI-driven forecasting**. It allows users to search for any Indian stock, index, or global commodity, and instantly generates:

- **Interactive technical charts** with historical OHLCV data, moving averages, volatility, and seasonality
- **AI-assisted 14-day price forecasts** powered by a pipeline of statistical models, ML ensembles, and Gemini AI reasoning
- **Market sentiment analysis** sourced from real-time financial news headlines

The entire analysis pipeline — from data fetching to prediction — runs securely on Vercel Serverless Functions, keeping the frontend fast and lightweight.

---

## ✨ Key Features

- 🔎 **Intelligent Live Autocomplete Search** — Debounced real-time suggestions from Yahoo Finance, proxied securely by a serverless CORS proxy (`/api/search-tickers`)
- 📡 **Real-Time Data Fetching** — Historical OHLCV market data fetched directly from Yahoo Finance API via secure serverless backend
- 🧹 **Automatic Ticker Normalization** — Handles fuzzy inputs like `"icici bank"` → `ICICIBANK.NS`, `"nifty"` → `^NSEI`, `"gold"` → `GC=F`
- 📊 **Technical Indicator Suite** — SMA-50, SMA-200, RSI, MACD, Bollinger Bands, Rolling Volatility, OBV, ATR, Momentum
- 🤖 **ML Ensemble Forecasting** — In-server Random Forest + Gradient Boosting regressor blend with Holt-Winters, Mean Reversion, and Momentum statistical models
- 🧠 **Gemini AI Reasoning** — Incorporates macro context, sector data, news sentiment, and market regime into qualitative reasoning powered by Google Gemini 3 Flash
- 📉 **Walk-Forward Backtesting** — Computes MAE, RMSE, and Directional Accuracy over a held-out 20% test slice of historical data
- 📱 **Fully Responsive UI** — Mobile-first glassmorphism design using Tailwind CSS, with `framer-motion` micro-animations
- 🛡️ **Graceful Error Handling** — All API error responses return structured JSON messages with helpful suggestions; no silent crashes
---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────┐
│                FRONTEND (Vite + React)        │
│                                              │
│   LandingPage → StockDashboard → AIPredict  │
│         ↕                  ↕                │
│  /api/search-tickers   /api/analyze-stock   │
└──────────────────────────────────────────────┘
               ↓                  ↓
┌──────────────────────────────────────────────┐
│        VERCEL SERVERLESS FUNCTIONS            │
│                                              │
│  search-tickers.ts → Yahoo Finance Search   │
│  analyze-stock.ts  → Yahoo Finance Charts   │
│                    → Technical Indicators   │
│                    → ML Model Training      │
│                    → Gemini AI API          │
└──────────────────────────────────────────────┘
```

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Charting | Recharts (ComposedChart, AreaChart) |
| Animations | Framer Motion |
| Icons | Lucide React |

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Vercel Serverless Functions |
| Language | TypeScript (Node.js) |
| Data Source | Yahoo Finance v1 / v8 API |
| AI | Google Gemini 3 Flash Preview |
| Caching | In-Memory Global Map (2hr TTL) |

---

## 🔬 Prediction Pipeline

When a user requests analysis, the following steps occur **server-side**:

```
1.  Ticker Normalization
    └── Input sanitized → uppercase, spaces stripped → dictionary lookup → .NS appended

2.  Yahoo Finance Data Fetch (with 4.5s timeout + AbortController)
    └── Historical OHLCV Data (daily, up to 20 years)
    └── Market index data (^NSEI)
    └── Sector index data

3.  Technical Indicator Computation (Node.js)
    └── SMA-50, SMA-200, RSI, MACD, Bollinger Bands
    └── ATR, OBV, Accumulation/Distribution, Momentum
    └── Rolling Volatility (30-day Parkinson estimator)

4.  ML Model Training (80% train / 20% test split)
    └── Random Forest Regressor (5 trees, depth 4)
    └── Gradient Boosting Regressor (10 trees, depth 3)
    └── Feature vector: MA50, MA200, RSI, MACD, Vol, Momentum, OBV, Last Close

5.  Walk-Forward Backtesting
    └── 1-day ahead walk-forward predictions over test slice
    └── Computes MAE, RMSE, Directional Accuracy

6.  Ensemble Forecasting (14-day horizon)
    └── Stacks Holt-Winters + Momentum + Mean-Reversion + RF + GBM
    └── Regime-weighted blending (Bull Market vs Bear vs Sideways)

7.  Gemini AI Reasoning (with 4.5s timeout failsafe)
    └── Sends market regime, factor score, predictions, news headlines
    └── Returns Sentiment, Reasoning Report, Key Factors, News Sentiment Score
    └── Fallback: pure statistical reasoning if Gemini is unavailable

8.  Unified JSON Response → Cached for 2 hours
```

> ⚠️ This system provides analytical insights for educational research only. It does not guarantee any financial outcomes.

---

## 🌍 Supported Asset Types

The backend automatically resolves input strings to their correct Yahoo Finance ticker symbols:

| Asset Type | Input Example | Resolved Ticker |
|------------|--------------|-----------------|
| NSE Stocks | `RELIANCE`, `TCS`, `ICICI BANK` | `RELIANCE.NS`, `TCS.NS`, `ICICIBANK.NS` |
| NSE Indices | `NIFTY`, `NIFTY 50`, `BANKNIFTY` | `^NSEI`, `^NSEI`, `^NSEBANK` |
| BSE Index | `SENSEX` | `^BSESN` |
| Commodities | `GOLD`, `SILVER`, `CRUDE OIL` | `GC=F`, `SI=F`, `CL=F` |
| US Stocks | `AAPL`, `TSLA`, `MSFT` | `AAPL`, `TSLA`, `MSFT` *(pass-through)* |
| Other | Any valid Yahoo symbol | Passed directly |

---

## 💻 Running Locally

### Prerequisites

- **Node.js** v18 or higher
- A **Google Gemini API Key** (get one at [Google AI Studio](https://aistudio.google.com))

### Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Koushik1708/market-analysis-.git
   cd market-analysis-
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**

   Create a `.env.local` file at the root:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   > ⚠️ **Security note:** `GEMINI_API_KEY` is consumed exclusively by the Vercel Serverless Functions in `/api`. It is **never** exposed to the browser bundle.

4. **Start the Development Server**
   ```bash
   npm run dev
   ```

   The app will be available at [`http://localhost:5173`](http://localhost:5173).

   > 📝 **Note:** To test serverless API routes locally, use the [Vercel CLI](https://vercel.com/docs/cli):
   > ```bash
   > npx vercel dev
   > ```

---

## 🚀 Deployment

This project is fully pre-configured for **Vercel** deployment. All files inside `/api` are automatically served as Vercel Serverless Functions.

### Deploy via Vercel Dashboard

1. Push your code to a **GitHub repository**
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add the environment variable in the Vercel dashboard:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   > This variable is read only by serverless functions — it is never sent to the client.
4. Click **Deploy**!

### Deploy via Vercel CLI

```bash
npm install -g vercel
vercel --prod
```

---

## 📁 Project Structure

```
├── api/
│   ├── analyze-stock.ts       # Core data pipeline: Yahoo fetch, ML training, Gemini AI
│   └── search-tickers.ts      # Autocomplete CORS proxy to Yahoo Finance search
│
├── src/
│   ├── components/
│   │   ├── LandingPage.tsx    # Hero section, live autocomplete search UI
│   │   ├── StockDashboard.tsx # Dashboard: stats, charts, technical insights
│   │   ├── AIPredictionPage.tsx # AI forecast view with backtesting metrics
│   │   ├── ResearchAssistant.tsx # Context-aware chat interface
│   │   └── Charts/
│   │       ├── PriceChart.tsx
│   │       ├── MovingAverageChart.tsx
│   │       ├── VolatilityChart.tsx
│   │       ├── SeasonalChart.tsx
│   │       └── MonthlyHeatmap.tsx
│   │
│   ├── services/
│   │   ├── predictionService.ts # ML models, Gemini calls, backtesting
│   │   ├── stockCacheService.ts # IndexedDB cache (large datasets, auto-eviction)
│   │   └── stockService.ts    # Data fetching, OHLCV processing, technical indicators
│   │
│   ├── utils/
│   │   ├── mlModels.ts        # Pure TypeScript Random Forest & GBM implementations
│   │   └── technicalIndicators.ts # SMA, RSI, MACD, Bollinger, ATR, OBV, etc.
│   │
│   ├── types/                 # Shared TypeScript interfaces & types
│   ├── App.tsx                # Root component, routing, state management
│   └── main.tsx
│
├── public/                    # Static assets (hero images, favicon)
├── vercel.json                # Vercel serverless routes config
├── vite.config.ts             # Vite + API rewrite proxy config
└── package.json
```

---

## 🔮 Future Improvements

- [ ] **Advanced ML Models** — LSTM / Transformer-based time-series models for longer-horizon forecasting
- [ ] **Real-Time Streaming Data** — WebSocket integration with live tick-by-tick data
- [ ] **Portfolio Tracker** — Multi-asset portfolio view with correlation heatmaps and drawdown analysis
- [ ] **Expanded Global Markets** — Full coverage for LSE (`.L`), NYSE, TSX, and crypto pairs
- [ ] **User Accounts & Watchlists** — Supabase-powered persistent watchlists and saved analyses
- [ ] **Alerts System** — Email/push notifications for price thresholds and model signal changes

---

## ⚠️ Disclaimer

> This project is developed strictly for **educational and research purposes**.
>
> The analysis, forecasts, and model outputs presented are generated by mathematical and AI systems and **do not constitute financial advice**. Do not make investment decisions based solely on the outputs of this application. Always consult a registered financial professional before investing.

---

<div align="center">
  <p>Built with ❤️ using React, Vercel, and Google Gemini AI</p>
</div>

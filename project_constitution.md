# Project Constitution: AI Stock Prediction Platform

## 1. Project Overview
Transform the AI stock prediction application into a fully automated online platform. Users will enter a stock symbol and the number of years of historical data required. The system will automatically download market data, compute technical indicators locally, analyze recent news sentiment, and generate a 14-day stock price forecast complete with an AI-driven explanation.

## 2. Technology Stack
- **Frontend**: React 19, Vite, Tailwind CSS (v4), TypeScript.
- **Backend / Data Fetching**: Node.js/Express (`server.ts`) with `yahoo-finance2` for stock data and news.
- **Charts / Visualization**: Recharts, D3 (if needed).
- **AI Integration**: `@google/genai` (Gemini) for news sentiment analysis and AI reasoning layer.
- **Local Preprocessing**: Custom TypeScript utilities for technical indicators and factor modeling.

## 3. System Architecture
### Data Flow
1. **User Input**: Ticker Symbol & Years of Data.
2. **API Layer**: React frontend calls Express backend `/api/stock/:symbol`.
3. **Data Service**: Backend uses `yahoo-finance2` to fetch historical OHLCV data + latest news.
4. **Data Preprocessing**: Frontend/Backend calculates indicators (SMA, EMA, RSI, MACD, Bollinger Bands, Momentum, Volatility) without LLM.
5. **Prediction Engine**: Local ensemble model combines Holt-Winters, Momentum, Mean Reversion, and MA Crossover based on dynamic factor scoring.
6. **AI Layer**: Only aggregated indicators, prediction outputs, and news headlines are sent to the Gemini LLM for reasoning and sentiment extraction.
7. **UI**: Dashboard updates with actual vs. predicted charts, probability bounds, and AI insights.

## 4. SWARM Development Strategy
- **Architect Agent**: Defines the data flow, endpoints, and caching strategy.
- **Frontend Agent**: Implements the dark mode, bento-grid UI, and data visualization.
- **Backend Agent**: Enhances the Node.js API to fetch and normalize Yahoo Finance data.
- **Validator Agent**: Ensures calculations for technical indicators match standard financial definitions.
- **Optimizer Agent**: Minimizes LLM token usage by sending strict, structured summaries.

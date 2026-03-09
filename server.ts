import express from "express";
import { createServer as createViteServer } from "vite";
import YahooFinance from 'yahoo-finance2';
import path from 'path';
import { fileURLToPath } from 'url';

// @ts-ignore
const yahooFinance = new YahooFinance();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to fetch stock data
  app.get("/api/stock/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const { period1, period2 } = req.query;

      // Default to last 5 years if no period specified
      const end = period2 ? new Date(period2 as string) : new Date();
      const start = period1 ? new Date(period1 as string) : new Date(new Date().setFullYear(end.getFullYear() - 5));

      const queryOptions = {
        period1: start,
        period2: end,
        interval: '1d' as const,
      };

      const result = await yahooFinance.historical(symbol, queryOptions);
      res.json(result);
    } catch (error) {
      console.error("Error fetching stock data:", error);
      res.status(500).json({ error: "Failed to fetch stock data" });
    }
  });

  // API Route for summary info
  app.get("/api/quote/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const result = await yahooFinance.quote(symbol);
      res.json(result);
    } catch (error) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

// Vite plugin to run the Vercel API function locally during development
const vercelApiDevPlugin = () => ({
  name: 'vercel-api-dev-server',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      // Intercept the /api/analyze-stock route
      if (req.url && req.url.startsWith('/api/analyze-stock') && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const parsedBody = body ? JSON.parse(body) : {};

            // Mock Vercel Request
            const vercelReq = { body: parsedBody, method: req.method, query: {} };

            // Mock Vercel Response
            const vercelRes = {
              status: (code: number) => {
                res.statusCode = code;
                return vercelRes;
              },
              json: (data: any) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              }
            };

            // Load the API route using Vite's SSR system mapping
            const apiPath = path.resolve(__dirname, 'api/analyze-stock.ts');
            const { default: handler } = await server.ssrLoadModule(apiPath);

            await handler(vercelReq, vercelRes);
          } catch (e: any) {
            console.error('Local API dev plugin error:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message || "Internal server error" }));
          }
        });
        return; // Stop the chain, we've handled the request
      }
      next();
    });
  }
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), vercelApiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR can be disabled via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

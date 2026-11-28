import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import loginHandler from './api/login.js';
import logoutHandler from './api/logout.js';
import sessionHandler from './api/session.js';
import dataHandler from './api/data.js';
import kursHandler from './api/kurs.js';

const API_ROUTES = {
  '/api/login': loginHandler,
  '/api/logout': logoutHandler,
  '/api/session': sessionHandler,
  '/api/data': dataHandler,
  '/api/kurs': kursHandler
};

function enhanceResponse(res) {
  if (typeof res.status !== 'function') {
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
  }
  if (typeof res.json !== 'function') {
    res.json = (payload) => {
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.end(JSON.stringify(payload));
      return res;
    };
  }
  return res;
}

function localApiPlugin() {
  return {
    name: 'local-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const routeHandler = API_ROUTES[urlObj.pathname];
        if (!routeHandler) {
          return next();
        }

        req.query = Object.fromEntries(urlObj.searchParams.entries());
        enhanceResponse(res);

        try {
          await routeHandler(req, res);
        } catch (err) {
          console.error(`Local API Error (${urlObj.pathname}):`, err);
          if (!res.writableEnded) {
            res.status(500).json({ error: 'Internal Server Error' });
          }
        }
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    plugins: [react(), localApiPlugin()],
    server: {
      port: 3000,
      open: true
    }
  };
});

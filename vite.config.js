import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_SHEETS = {
  harga: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTpP3VHWDYD_sju_TrkIIvOQm_PoTbfQX8mMvm6HkcrsJ56cAQjP229Quz9Y_0hpaLwktjE5w8RBJzK/pub?gid=0&single=true&output=csv',
  stok: 'https://docs.google.com/spreadsheets/d/1YEu-awdBQxR1zOwSUZwDYkv_t3YFSzZ4srIeGCxW5zc/export?format=csv&gid=0'
};

const DEFAULT_PASSWORD = 'multibangun123';

function parseCsvFull(csvText, isStokMode = false) {
  const rows = [];
  let curCell = '';
  let curRow = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        curCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      curRow.push(curCell.trim());
      curCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      curRow.push(curCell.trim());
      if (curRow.some((c) => c !== '')) {
        rows.push(curRow);
      }
      curRow = [];
      curCell = '';
    } else {
      curCell += char;
    }
  }

  if (curCell || curRow.length > 0) {
    curRow.push(curCell.trim());
    if (curRow.some((c) => c !== '')) {
      rows.push(curRow);
    }
  }

  if (isStokMode) {
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === 'Brand') {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx !== -1) {
      const headers = rows[headerIdx];
      const data = rows.slice(headerIdx + 1);
      return { headers, data };
    }
  }

  if (rows.length === 0) return { headers: [], data: [] };
  return { headers: rows[0], data: rows.slice(1) };
}

function localApiPlugin() {
  return {
    name: 'local-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/data')) {
          try {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const mode = urlObj.searchParams.get('mode') || 'harga';
            const password = urlObj.searchParams.get('password') || '';

            if (password !== DEFAULT_PASSWORD) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Unauthorized: Password salah.' }));
              return;
            }

            const csvUrl = DEFAULT_SHEETS[mode] || DEFAULT_SHEETS.harga;
            const fetchRes = await fetch(csvUrl);
            if (!fetchRes.ok) {
              throw new Error(`HTTP ${fetchRes.status}`);
            }

            const csvText = await fetchRes.text();
            const parsed = parseCsvFull(csvText, mode === 'stok');

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                status: 'success',
                mode,
                headers: parsed.headers,
                data: parsed.data,
                timestamp: new Date().toISOString()
              })
            );
          } catch (err) {
            console.error('Local API Plugin Error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
          }
          return;
        }
        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), localApiPlugin()],
  server: {
    port: 3000,
    open: true
  }
});


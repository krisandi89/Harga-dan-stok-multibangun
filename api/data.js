// Vercel Serverless Function Proxy (/api/data.js)

const DEFAULT_SHEETS = {
  harga: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTpP3VHWDYD_sju_TrkIIvOQm_PoTbfQX8mMvm6HkcrsJ56cAQjP229Quz9Y_0hpaLwktjE5w8RBJzK/pub?gid=0&single=true&output=csv',
  stok: 'https://docs.google.com/spreadsheets/d/1YEu-awdBQxR1zOwSUZwDYkv_t3YFSzZ4srIeGCxW5zc/export?format=csv&gid=0'
};

const DEFAULT_PASSWORD = 'multibangun123';

// Pure JS CSV Parser returning array of rows (prevents duplicate header key collisions)
function parseCsvToRows(csvText, isStokMode = false) {
  let lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== '');

  if (isStokMode) {
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('Brand,')) {
        headerIndex = i;
        break;
      }
    }
    if (headerIndex !== -1) {
      lines = lines.slice(headerIndex);
    }
  }

  if (lines.length === 0) return { headers: [], data: [] };

  const parseLine = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur.replace(/^"|"$/g, '').trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.replace(/^"|"$/g, '').trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.some((v) => v !== '')) {
      data.push(values);
    }
  }

  return { headers, data };
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { mode = 'harga', password = '' } = req.query;

  // Password verification
  const REQUIRED_PASSWORD = process.env.APP_PASSWORD || process.env.BACKEND_PASSWORD || DEFAULT_PASSWORD;

  if (password !== REQUIRED_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Password salah atau tidak valid.' });
  }

  // GAS WebApp URL option
  const GAS_URL = process.env.GAS_WEBAPP_URL;

  try {
    if (GAS_URL) {
      const targetUrl = new URL(GAS_URL);
      targetUrl.searchParams.append('mode', mode);
      if (password) targetUrl.searchParams.append('password', password);

      const response = await fetch(targetUrl.toString());
      if (response.status === 401) {
        return res.status(401).json({ error: 'Unauthorized: Password backend GAS salah.' });
      }
      if (!response.ok) {
        throw new Error(`GAS response error: ${response.statusText}`);
      }
      const json = await response.json();
      return res.status(200).json(json);
    }

    // Direct server-side fetch from Google Sheets
    const csvUrl = DEFAULT_SHEETS[mode] || DEFAULT_SHEETS.harga;
    const response = await fetch(csvUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${mode} data: ${response.status}`);
    }

    const csvText = await response.text();
    const parsed = parseCsvToRows(csvText, mode === 'stok');

    return res.status(200).json({
      status: 'success',
      mode,
      headers: parsed.headers,
      data: parsed.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

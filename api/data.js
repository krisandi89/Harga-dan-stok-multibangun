// Vercel Serverless Function Proxy (/api/data.js)

const DEFAULT_SHEETS = {
  harga: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTpP3VHWDYD_sju_TrkIIvOQm_PoTbfQX8mMvm6HkcrsJ56cAQjP229Quz9Y_0hpaLwktjE5w8RBJzK/pub?gid=0&single=true&output=csv',
  stok: 'https://docs.google.com/spreadsheets/d/1YEu-awdBQxR1zOwSUZwDYkv_t3YFSzZ4srIeGCxW5zc/export?format=csv&gid=0'
};

const DEFAULT_PASSWORD = 'multibangun123';

// Multiline-aware CSV Parser: Preserves cell line-breaks (e.g. multiline Keterangan)
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
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      curRow.push(curCell.trim());
      curCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // skip \r\n
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
    const parsed = parseCsvFull(csvText, mode === 'stok');

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

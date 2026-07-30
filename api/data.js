import Papa from 'papaparse';

// Direct fallback Google Sheets URLs (Shielded from client-side browser visibility!)
const DEFAULT_SHEETS = {
  harga: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTpP3VHWDYD_sju_TrkIIvOQm_PoTbfQX8mMvm6HkcrsJ56cAQjP229Quz9Y_0hpaLwktjE5w8RBJzK/pub?gid=0&single=true&output=csv',
  stok: 'https://docs.google.com/spreadsheets/d/1YEu-awdBQxR1zOwSUZwDYkv_t3YFSzZ4srIeGCxW5zc/export?format=csv&gid=0'
};

// Default master password if no Environment Variable is set in Vercel
const DEFAULT_PASSWORD = 'multibangun123';

export default async function handler(req, res) {
  // Enable CORS for Vercel deployment
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

  // Password verification: checks Vercel ENV VAR first, falls back to DEFAULT_PASSWORD
  const REQUIRED_PASSWORD = process.env.APP_PASSWORD || process.env.BACKEND_PASSWORD || DEFAULT_PASSWORD;

  if (password !== REQUIRED_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Password salah atau tidak valid.' });
  }

  // Check if custom GAS_WEBAPP_URL is set in Vercel environment variables
  const GAS_URL = process.env.GAS_WEBAPP_URL;

  try {
    if (GAS_URL) {
      // Fetch from deployed Google Apps Script Web App
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

    // Direct server-side fetch (Fallback: hides Sheet URL from user browser)
    const csvUrl = DEFAULT_SHEETS[mode] || DEFAULT_SHEETS.harga;
    const response = await fetch(csvUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${mode} data: ${response.status}`);
    }

    const csvText = await response.text();
    let cleanedCsv = csvText;

    // For STOK mode, parse starting from header row 'Brand'
    if (mode === 'stok') {
      const lines = csvText.split('\n');
      let headerIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('Brand,')) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex !== -1) {
        cleanedCsv = lines.slice(headerIndex).join('\n');
      }
    }

    const parsed = Papa.parse(cleanedCsv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim()
    });

    return res.status(200).json({
      status: 'success',
      mode,
      headers: parsed.meta.fields || [],
      data: parsed.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

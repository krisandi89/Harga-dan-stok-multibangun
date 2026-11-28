// Vercel Serverless Function Proxy (/api/data.js)
import { applyApiHeaders, requireAuth } from './_auth.js';
import { parseCsvFull } from './_csvParser.js';

const VALID_MODES = new Set(['harga', 'stok']);

function getSheetUrl(mode) {
  if (mode === 'stok') {
    return (process.env.STOK_SHEET_URL || '').trim();
  }
  return (process.env.HARGA_SHEET_URL || '').trim();
}

export default async function handler(req, res) {
  if (!applyApiHeaders(req, res, ['GET', 'OPTIONS'])) {
    return;
  }

  if (!requireAuth(req, res)) {
    return;
  }

  const rawMode = String(req.query?.mode || 'harga').toLowerCase().trim();
  if (!VALID_MODES.has(rawMode)) {
    return res.status(400).json({ error: 'Mode tidak valid. Gunakan "harga" atau "stok".' });
  }
  const mode = rawMode;

  const gasUrl = (process.env.GAS_WEBAPP_URL || '').trim();

  try {
    if (gasUrl) {
      const targetUrl = new URL(gasUrl);
      targetUrl.searchParams.set('mode', mode);

      const gasPassword = (process.env.GAS_BACKEND_PASSWORD || '').trim();
      if (gasPassword) {
        targetUrl.searchParams.set('password', gasPassword);
      }

      const response = await fetch(targetUrl.toString(), {
        signal: AbortSignal.timeout(10000)
      });

      if (response.status === 401) {
        return res.status(502).json({ error: 'Autentikasi ke backend GAS gagal.' });
      }
      if (!response.ok) {
        throw new Error(`GAS response error: HTTP ${response.status}`);
      }

      const json = await response.json();
      if (json?.error) {
        return res.status(502).json({ error: 'Backend GAS mengembalikan error.' });
      }
      return res.status(200).json(json);
    }

    const csvUrl = getSheetUrl(mode);
    if (!csvUrl) {
      const envName = mode === 'stok' ? 'STOK_SHEET_URL' : 'HARGA_SHEET_URL';
      return res.status(503).json({
        error: `Konfigurasi sumber data ${mode} belum lengkap (${envName} belum disetel).`
      });
    }

    const response = await fetch(csvUrl, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${mode} sheet: HTTP ${response.status}`);
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
    console.error(`API /api/data (${mode}) Error:`, error);
    return res.status(500).json({ error: `Gagal memuat data ${mode}. Silakan coba lagi.` });
  }
}

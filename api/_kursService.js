import { parseCsvFull } from './_csvParser.js';

const PANIN_SOURCE_URL = 'https://kurs.web.id/bank/panin';

const CACHE_TTL_MS = 25_000;
let cachedResult = null;
let cachedAt = 0;

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
};

/**
 * Parse rate strings supporting both US ("18,390.00") and ID ("Rp18.354,45") formats.
 */
function parseRateNumber(raw) {
  if (!raw) return null;
  let cleaned = String(raw).replace(/rp/gi, '').replace(/\s+/g, '').trim();
  if (!cleaned) return null;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    // Whichever separator appears last is the decimal separator
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    // e.g. "18,390" (thousands) vs "18390,45" (decimal)
    const parts = cleaned.split(',');
    cleaned = parts[parts.length - 1].length === 3 ? cleaned.replace(/,/g, '') : cleaned.replace(',', '.');
  } else if (hasDot) {
    const parts = cleaned.split('.');
    if (parts[parts.length - 1].length === 3) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) && num > 1000 && num < 100000 ? num : null;
}

/**
 * Primary source: Fetch Bank Panin USD/IDR Beli, Jual, and Tengah rates from kurs.web.id.
 */
async function fetchPaninUsdIdr() {
  const res = await fetch(PANIN_SOURCE_URL, {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(5000)
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${PANIN_SOURCE_URL}`);
  }

  const html = await res.text();
  const usdRowMatch = html.match(
    /href=["'][^"']*\/bank\/panin\/usd["'][\s\S]*?<\/tr>/i
  );
  if (!usdRowMatch) {
    throw new Error('Baris USD Bank Panin tidak ditemukan.');
  }

  // Match starts after the first <td> (containing the USD link), so matched cells are [Beli, Jual, Tengah]
  const cells = [...usdRowMatch[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').trim());

  const buy = parseRateNumber(cells[0]);
  const sell = parseRateNumber(cells[1]);
  const mid = parseRateNumber(cells[2]) ?? (buy && sell ? Number(((buy + sell) / 2).toFixed(2)) : null);

  if (!sell) {
    throw new Error('Kurs Jual USD Bank Panin tidak tersedia.');
  }

  return {
    buy,
    sell,
    mid,
    source: 'Bank Panin'
  };
}

/**
 * Fallback source: Read "Kurs Jual USD Bank Panin" column from HARGA_SHEET_URL if primary scraper fails.
 */
async function fetchPaninFromHargaSheet() {
  const hargaUrl = (process.env.HARGA_SHEET_URL || '').trim();
  if (!hargaUrl) return null;

  const res = await fetch(hargaUrl, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;

  const csvText = await res.text();
  const parsed = parseCsvFull(csvText, false);
  const kursColIdx = parsed.headers.findIndex((h) => /kurs.*panin/i.test(String(h || '')));
  if (kursColIdx === -1) return null;

  for (const row of parsed.data) {
    const sell = parseRateNumber(row[kursColIdx]);
    if (sell) {
      return {
        buy: null,
        sell,
        mid: null,
        source: 'Bank Panin (Sheet)'
      };
    }
  }
  return null;
}

/**
 * Fetch Bank Panin USD/IDR rate (with short TTL cache, stale fallback, and Sheet fallback).
 */
export async function getUsdIdrKurs() {
  const now = Date.now();
  if (cachedResult && now - cachedAt < CACHE_TTL_MS) {
    return cachedResult;
  }

  try {
    const panin = await fetchPaninUsdIdr();
    const payload = {
      status: 'success',
      currency: 'USD/IDR',
      panin,
      stale: false,
      fetchedAt: new Date().toISOString()
    };

    cachedResult = payload;
    cachedAt = now;
    return payload;
  } catch (err) {
    console.warn('Primary Bank Panin kurs fetch failed:', err.message);

    if (cachedResult) {
      return { ...cachedResult, stale: true };
    }

    try {
      const sheetPanin = await fetchPaninFromHargaSheet();
      if (sheetPanin) {
        const fallbackPayload = {
          status: 'success',
          currency: 'USD/IDR',
          panin: sheetPanin,
          stale: true,
          fetchedAt: new Date().toISOString()
        };
        cachedResult = fallbackPayload;
        cachedAt = now;
        return fallbackPayload;
      }
    } catch (fallbackErr) {
      console.warn('Sheet fallback kurs fetch failed:', fallbackErr.message);
    }

    throw err;
  }
}

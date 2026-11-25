const PANIN_SOURCE_URL = 'https://kurs.web.id/bank/panin';

const CACHE_TTL_MS = 25_000;
let cachedResult = null;
let cachedAt = 0;

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
};

function parseRateNumber(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/,/g, '').trim();
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) && num > 1000 && num < 100000 ? num : null;
}

/**
 * Fetch Bank Panin USD/IDR Beli, Jual, and Tengah rates.
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
    /href=["']https?:\/\/kurs\.web\.id\/bank\/panin\/usd["'][\s\S]*?<\/tr>/i
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
 * Fetch Bank Panin USD/IDR rate (with short TTL cache and stale fallback).
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
      fetchedAt: new Date().toISOString()
    };

    cachedResult = payload;
    cachedAt = now;
    return payload;
  } catch (err) {
    console.warn('Bank Panin kurs fetch failed:', err.message);
    if (cachedResult) {
      return cachedResult;
    }
    throw err;
  }
}

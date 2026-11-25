const YAHOO_URLS = [
  'https://query1.finance.yahoo.com/v8/finance/chart/USDIDR=X?interval=1d&range=1d',
  'https://query2.finance.yahoo.com/v8/finance/chart/USDIDR=X?interval=1d&range=1d'
];
const JSDELIVR_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json';
const ER_API_URL = 'https://open.er-api.com/v6/latest/USD';
const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR';
const PANIN_SOURCE_URL = 'https://kurs.web.id/bank/panin';

const CACHE_TTL_MS = 25_000;
let cachedResult = null;
let cachedAt = 0;

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json,text/html;q=0.9,*/*;q=0.8'
};

function parseRateNumber(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/,/g, '').trim();
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) && num > 1000 && num < 100000 ? num : null;
}

async function fetchJsonWithTimeout(url, timeoutMs = 3000) {
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  return res.json();
}

async function fetchYahooSpot() {
  for (const url of YAHOO_URLS) {
    try {
      const json = await fetchJsonWithTimeout(url, 2500);
      const meta = json?.chart?.result?.[0]?.meta;
      const rate = Number(meta?.regularMarketPrice);
      if (Number.isFinite(rate) && rate > 1000) {
        const prevClose = Number(meta?.chartPreviousClose ?? meta?.previousClose);
        const rawChange = meta?.fulldayChange ?? (Number.isFinite(prevClose) ? rate - prevClose : null);
        const rawPct = meta?.regularMarketChangePercent ??
          (Number.isFinite(prevClose) && prevClose > 0 ? ((rate - prevClose) / prevClose) * 100 : null);

        return {
          rate,
          change: Number.isFinite(Number(rawChange)) ? Number(Number(rawChange).toFixed(2)) : null,
          changePercent: Number.isFinite(Number(rawPct)) ? Number(Number(rawPct).toFixed(2)) : null,
          source: 'Spot Pasar (Yahoo Finance)',
          marketTime: meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null
        };
      }
    } catch (err) {
      console.warn(`Yahoo Finance unavailable (${url}):`, err.message);
    }
  }
  throw new Error('Yahoo Finance unavailable');
}

async function fetchFallbackSpot() {
  return Promise.any([
    fetchJsonWithTimeout(JSDELIVR_URL, 3000).then((json) => {
      const rate = Number(json?.usd?.idr);
      if (!Number.isFinite(rate) || rate <= 1000) throw new Error('Invalid jsDelivr rate');
      return {
        rate: Number(rate.toFixed(2)),
        change: null,
        changePercent: null,
        source: 'Spot Pasar (Currency API)',
        marketTime: json?.date ? `${json.date}T00:00:00.000Z` : null
      };
    }),
    fetchJsonWithTimeout(FRANKFURTER_URL, 3000).then((json) => {
      const rate = Number(json?.rates?.IDR);
      if (!Number.isFinite(rate) || rate <= 1000) throw new Error('Invalid Frankfurter rate');
      return {
        rate,
        change: null,
        changePercent: null,
        source: 'Frankfurter (ECB)',
        marketTime: json?.date ? `${json.date}T00:00:00.000Z` : null
      };
    }),
    fetchJsonWithTimeout(ER_API_URL, 3000).then((json) => {
      const rate = Number(json?.rates?.IDR);
      if (!Number.isFinite(rate) || rate <= 1000) throw new Error('Invalid ER-API rate');
      return {
        rate,
        change: null,
        changePercent: null,
        source: 'ExchangeRate-API',
        marketTime: json?.time_last_update_unix ? new Date(json.time_last_update_unix * 1000).toISOString() : null
      };
    })
  ]);
}

/**
 * Fetch real-time spot USD/IDR rate with fast parallel fallbacks.
 */
async function fetchSpotUsdIdr() {
  try {
    return await fetchYahooSpot();
  } catch {
    return fetchFallbackSpot();
  }
}

/**
 * Best-effort fetch of Bank Panin USD/IDR Beli, Jual, and Tengah rates.
 */
async function fetchPaninUsdIdr() {
  try {
    const res = await fetch(PANIN_SOURCE_URL, {
      headers: {
        ...DEFAULT_HEADERS,
        Accept: 'text/html,application/xhtml+xml'
      },
      signal: AbortSignal.timeout(3500)
    });
    if (!res.ok) return null;

    const html = await res.text();
    const usdRowMatch = html.match(
      /href=["']https?:\/\/kurs\.web\.id\/bank\/panin\/usd["'][\s\S]*?<\/tr>/i
    );
    if (!usdRowMatch) return null;

    // Match starts after the first <td> (containing the USD link), so matched cells are [Beli, Jual, Tengah]
    const cells = [...usdRowMatch[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((m) => m[1].replace(/<[^>]+>/g, '').trim());

    const buy = parseRateNumber(cells[0]);
    const sell = parseRateNumber(cells[1]);
    const mid = parseRateNumber(cells[2]) ?? (buy && sell ? Number(((buy + sell) / 2).toFixed(2)) : null);

    if (!buy && !sell) return null;

    return {
      buy,
      sell,
      mid,
      source: 'Bank Panin'
    };
  } catch (err) {
    console.warn('Bank Panin kurs fetch skipped:', err.message);
    return null;
  }
}

/**
 * Fetch combined real-time spot and Bank Panin USD/IDR rates (with short TTL cache).
 */
export async function getUsdIdrKurs() {
  const now = Date.now();
  if (cachedResult && now - cachedAt < CACHE_TTL_MS) {
    return cachedResult;
  }

  const [spotResult, paninResult] = await Promise.allSettled([
    fetchSpotUsdIdr(),
    fetchPaninUsdIdr()
  ]);

  const spot = spotResult.status === 'fulfilled' ? spotResult.value : null;
  const panin = paninResult.status === 'fulfilled' ? paninResult.value : null;

  if (!spot && !panin) {
    if (cachedResult) return cachedResult;
    throw spotResult.reason || new Error('Gagal memuat kurs USD/IDR.');
  }

  const payload = {
    status: 'success',
    currency: 'USD/IDR',
    spot,
    panin,
    fetchedAt: new Date().toISOString()
  };

  cachedResult = payload;
  cachedAt = now;
  return payload;
}

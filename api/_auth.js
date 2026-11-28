import crypto from 'node:crypto';

export const SESSION_COOKIE_NAME = 'mb_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 jam

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 menit
const RATE_LIMIT_MAX_ATTEMPTS = 10;
const RATE_LIMIT_MAX_KEYS = 1000;
const failedLoginMap = new Map();

export function getRequiredPassword() {
  return (process.env.APP_PASSWORD || process.env.BACKEND_PASSWORD || '').trim();
}

function getSessionSecret() {
  const explicitSecret = (process.env.SESSION_SECRET || '').trim();
  if (explicitSecret) return explicitSecret;

  const password = getRequiredPassword();
  if (!password) return '';

  // Fallback deterministik agar session tetap valid lintas cold start Vercel
  // jika admin hanya menyetel APP_PASSWORD.
  return crypto
    .createHash('sha256')
    .update(`multibangun-session-v1:${password}`)
    .digest('hex');
}

export function timingSafeEqualStrings(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function verifyPassword(candidate) {
  const required = getRequiredPassword();
  if (!required) {
    return { ok: false, misconfigured: true };
  }
  if (typeof candidate !== 'string' || !candidate) {
    return { ok: false, misconfigured: false };
  }
  return {
    ok: timingSafeEqualStrings(candidate, required),
    misconfigured: false
  };
}

export function createSessionToken() {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('SESSION_SECRET atau APP_PASSWORD belum dikonfigurasi.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const payloadObj = {
    v: 1,
    iat: nowSec,
    exp: nowSec + SESSION_TTL_SECONDS,
    jti: crypto.randomBytes(12).toString('base64url')
  };

  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

export function verifySessionToken(token) {
  if (typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  const secret = getSessionSecret();
  if (!secret) return null;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  if (!timingSafeEqualStrings(signature, expectedSignature)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);
    if (decoded?.v !== 1 || typeof decoded?.exp !== 'number' || decoded.exp <= nowSec) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader = '') {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return cookies;

  for (const pair of cookieHeader.split(';')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;
    const key = pair.slice(0, eqIndex).trim();
    const rawValue = pair.slice(eqIndex + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      cookies[key] = rawValue;
    }
  }
  return cookies;
}

function isSecureRequest(req) {
  const host = String(req.headers?.host || '');
  const isLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
  if (isLocalhost) return false;

  const proto = String(req.headers?.['x-forwarded-proto'] || '').toLowerCase();
  return proto === 'https' || process.env.VERCEL === '1';
}

export function setSessionCookie(req, res, token) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`
  ];
  if (isSecureRequest(req)) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req, res) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0'
  ];
  if (isSecureRequest(req)) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function getAuthenticatedSession(req) {
  const cookies = parseCookies(req.headers?.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  if (cookieToken) {
    const session = verifySessionToken(cookieToken);
    if (session) return { authenticated: true, session };
  }

  const authHeader = String(req.headers?.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    const session = verifySessionToken(bearerToken);
    if (session) return { authenticated: true, session };
  }

  return { authenticated: false, session: null };
}

export function requireAuth(req, res) {
  if (!getRequiredPassword()) {
    res.status(503).json({
      error: 'Konfigurasi server belum lengkap. Hubungi admin untuk menyetel APP_PASSWORD.'
    });
    return false;
  }

  const { authenticated } = getAuthenticatedSession(req);
  if (!authenticated) {
    res.status(401).json({
      error: 'Unauthorized: Sesi tidak valid atau telah berakhir. Silakan login kembali.'
    });
    return false;
  }

  return true;
}

export function applyApiHeaders(req, res, allowedMethods = ['GET', 'OPTIONS']) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');

  const origin = req.headers?.origin;
  if (origin) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    let isSameOrigin = false;
    try {
      const originHost = new URL(origin).host;
      isSameOrigin = Boolean(req.headers?.host) && originHost === req.headers.host;
    } catch {
      // Invalid origin header; keep isSameOrigin as false
    }

    if (isSameOrigin || allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(','));
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return false;
  }

  if (!allowedMethods.includes(req.method)) {
    res.setHeader('Allow', allowedMethods.join(', '));
    res.status(405).json({ error: 'Method Not Allowed' });
    return false;
  }

  return true;
}

export async function readJsonBody(req, maxBytes = 8192) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
      return req.body.trim() ? JSON.parse(req.body) : {};
    }
  }

  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Payload terlalu besar.'));
        req.destroy();
        return;
      }
      raw += chunk.toString('utf8');
    });

    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Format body JSON tidak valid.'));
      }
    });

    req.on('error', reject);
  });
}

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

export function checkLoginRateLimit(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = failedLoginMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    if (entry) failedLoginMap.delete(ip);
    return { allowed: true, retryAfterSeconds: 0, ip };
  }

  if (entry.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      ip
    };
  }

  return { allowed: true, retryAfterSeconds: 0, ip };
}

export function recordFailedLogin(ip) {
  const now = Date.now();
  if (failedLoginMap.size >= RATE_LIMIT_MAX_KEYS) {
    for (const [key, val] of failedLoginMap.entries()) {
      if (now >= val.resetAt) failedLoginMap.delete(key);
    }
    if (failedLoginMap.size >= RATE_LIMIT_MAX_KEYS) {
      const oldestKey = failedLoginMap.keys().next().value;
      if (oldestKey) failedLoginMap.delete(oldestKey);
    }
  }

  const existing = failedLoginMap.get(ip);
  if (!existing || now >= existing.resetAt) {
    failedLoginMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    existing.count += 1;
  }
}

export function resetLoginRateLimit(ip) {
  failedLoginMap.delete(ip);
}

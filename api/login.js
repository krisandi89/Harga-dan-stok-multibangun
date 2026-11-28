import {
  applyApiHeaders,
  checkLoginRateLimit,
  createSessionToken,
  readJsonBody,
  recordFailedLogin,
  resetLoginRateLimit,
  setSessionCookie,
  verifyPassword
} from './_auth.js';

export default async function handler(req, res) {
  if (!applyApiHeaders(req, res, ['POST', 'OPTIONS'])) {
    return;
  }

  const rateLimit = checkLoginRateLimit(req);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    return res.status(429).json({
      error: `Terlalu banyak percobaan login gagal. Coba lagi dalam ${rateLimit.retryAfterSeconds} detik.`
    });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Body request tidak valid.' });
  }

  const password = typeof body?.password === 'string' ? body.password.trim() : '';
  const result = verifyPassword(password);

  if (result.misconfigured) {
    return res.status(503).json({
      error: 'Konfigurasi server belum lengkap. Atur APP_PASSWORD pada environment variable.'
    });
  }

  if (!result.ok) {
    recordFailedLogin(rateLimit.ip);
    return res.status(401).json({ error: 'Password salah. Silakan coba lagi.' });
  }

  resetLoginRateLimit(rateLimit.ip);
  const token = createSessionToken();
  setSessionCookie(req, res, token);

  return res.status(200).json({
    status: 'success',
    authenticated: true
  });
}

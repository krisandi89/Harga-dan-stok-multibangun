import {
  applyApiHeaders,
  getAuthenticatedSession,
  getRequiredPassword
} from './_auth.js';

export default async function handler(req, res) {
  if (!applyApiHeaders(req, res, ['GET', 'OPTIONS'])) {
    return;
  }

  if (!getRequiredPassword()) {
    return res.status(503).json({
      authenticated: false,
      configured: false,
      error: 'Konfigurasi server belum lengkap. Atur APP_PASSWORD pada environment variable.'
    });
  }

  const { authenticated } = getAuthenticatedSession(req);
  return res.status(200).json({
    authenticated,
    configured: true
  });
}

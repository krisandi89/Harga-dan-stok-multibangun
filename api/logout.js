import { applyApiHeaders, clearSessionCookie } from './_auth.js';

export default async function handler(req, res) {
  if (!applyApiHeaders(req, res, ['POST', 'OPTIONS'])) {
    return;
  }

  clearSessionCookie(req, res);
  return res.status(200).json({
    status: 'success',
    authenticated: false
  });
}

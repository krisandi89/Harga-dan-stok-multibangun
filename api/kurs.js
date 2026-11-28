import { applyApiHeaders, requireAuth } from './_auth.js';
import { getUsdIdrKurs } from './_kursService.js';

export default async function handler(req, res) {
  if (!applyApiHeaders(req, res, ['GET', 'OPTIONS'])) {
    return;
  }

  if (!requireAuth(req, res)) {
    return;
  }

  try {
    const kursData = await getUsdIdrKurs();
    res.setHeader('Cache-Control', 'private, max-age=20');
    return res.status(200).json(kursData);
  } catch (error) {
    console.error('Kurs API Error:', error);
    return res.status(500).json({ error: 'Gagal memuat kurs USD/IDR Bank Panin.' });
  }
}

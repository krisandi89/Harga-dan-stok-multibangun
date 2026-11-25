import { getUsdIdrKurs } from './_kursService.js';

const DEFAULT_PASSWORD = 'multibangun123';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { password = '' } = req.query;
  const REQUIRED_PASSWORD = process.env.APP_PASSWORD || process.env.BACKEND_PASSWORD || DEFAULT_PASSWORD;

  if (password !== REQUIRED_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Password salah atau tidak valid.' });
  }

  try {
    const kursData = await getUsdIdrKurs();
    return res.status(200).json(kursData);
  } catch (error) {
    console.error('Kurs API Error:', error);
    return res.status(500).json({ error: error.message || 'Gagal memuat kurs USD/IDR.' });
  }
}

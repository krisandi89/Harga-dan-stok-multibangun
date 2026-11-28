# Multibangun MaterialHub — Harga & Stok Material

Dashboard pencarian cepat (*spotlight-style*) untuk melihat **harga** dan **ketersediaan stok** material Multibangun secara *real-time*, lengkap dengan informasi **Kurs Jual USD/IDR Bank Panin**.

## Fitur Utama

- **Pencarian Fleksibel**: Mendukung pencarian lintas kolom, variasi spasi/tanda hubung (`80mil` ↔ `80 MIL`, `re520` ↔ `RE 520`, `polyflex` ↔ `POLY-FLEX`), variasi ejaan (`80 mill`, `geotekstil`), normalisasi desimal (`2mm` ↔ `2.00 MM`), dan toleransi typo ringan.
- **Mode Harga & Stok**: Pembersihan kolom otomatis, penamaan jelas (`Konversi Satuan` / `Konversi Net`), serta *forward-fill* otomatis untuk sel `Brand` yang di-merge pada sheet Stok.
- **Tampilan Kartu & Tabel Responsif**: Default tampilan kartu yang ringkas di desktop & mobile, dengan opsi pindah ke tampilan tabel (*sticky first column* di mobile).
- **Banner Kurs Jual Bank Panin**: Update otomatis setiap 30 detik dengan tampilan waktu WIB dan fallback otomatis bila sumber utama sedang gangguan.
- **Keamanan Berbasis Session Cookie (`HttpOnly`)**: Autentikasi dilakukan di server (`POST /api/login`) menggunakan *constant-time password check*, token bertanda tangan HMAC-SHA256, rate-limiting login gagal, dan nol kredensial/URL sheet di kode publik maupun bundle frontend.

## Tech Stack

- **Frontend**: React 18, Vite, Lucide Icons
- **Backend**: Vercel Serverless Functions (`/api/login`, `/api/logout`, `/api/session`, `/api/data`, `/api/kurs`)
- **Sumber Data**: Google Sheets CSV (opsional melalui Google Apps Script) & kurs USD/IDR Bank Panin

## Menjalankan Secara Lokal

1. Salin file template environment:
   ```bash
   cp .env.example .env.local
   ```
2. Isi nilai variabel di `.env.local` (file ini diabaikan oleh `.gitignore` dan tidak akan ikut ter-commit).
3. Jalankan server pengembangan:
   ```bash
   npm install
   npm run dev
   ```
   Aplikasi berjalan di `http://localhost:3000`.

## Konfigurasi Environment Variables (Vercel & Lokal)

| Variabel | Wajib | Keterangan |
|---|---|---|
| `APP_PASSWORD` | Ya | Password login dashboard |
| `SESSION_SECRET` | Disarankan | String acak min. 32 karakter (`openssl rand -hex 32`) untuk menandatangani session cookie |
| `HARGA_SHEET_URL` | Ya* | URL CSV Google Sheet Harga (*wajib jika tidak memakai `GAS_WEBAPP_URL`) |
| `STOK_SHEET_URL` | Ya* | URL CSV Google Sheet Stok (*wajib jika tidak memakai `GAS_WEBAPP_URL`) |
| `GAS_WEBAPP_URL` | Opsional | URL Web App Google Apps Script jika memakai backend GAS (`gas/Code.gs`) |
| `GAS_BACKEND_PASSWORD` | Opsional | Password backend GAS (disetel di Script Properties GAS) |
| `ALLOWED_ORIGINS` | Opsional | Daftar origin CORS tambahan (pisahkan dengan koma) |

## Skrip NPM

```bash
npm run dev      # Jalankan Vite dev server + middleware API lokal
npm run build    # Build produksi ke folder dist/
npm run preview  # Preview hasil build produksi
npm run lint     # Jalankan ESLint pada seluruh kode
npm test         # Jalankan unit test (parser CSV, auth, flexible search)
```

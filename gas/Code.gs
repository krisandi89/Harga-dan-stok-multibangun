/**
 * Google Apps Script (GAS) Backend untuk Multibangun MaterialHub
 * 
 * CARA PAKAI:
 * 1. Buka https://script.google.com/
 * 2. Buat proyek baru "Multibangun-Backend"
 * 3. Copas kode di bawah ini ke dalam Code.gs
 * 4. Klik "Deploy" -> "New deployment"
 * 5. Select type: "Web app"
 * 6. Execute as: "Me"
 * 7. Who has access: "Anyone"
 * 8. Klik "Deploy" dan simpan Web App URL.
 * 9. Masukkan Web App URL tersebut ke Vercel Environment Variable: GAS_WEBAPP_URL
 */

const CONFIG = {
  // Masukkan password jika ingin memproteksi backend (Opsional)
  BACKEND_PASSWORD: "", 
  
  // Sheet URLs
  HARGA_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTpP3VHWDYD_sju_TrkIIvOQm_PoTbfQX8mMvm6HkcrsJ56cAQjP229Quz9Y_0hpaLwktjE5w8RBJzK/pub?gid=0&single=true&output=csv',
  STOK_CSV_URL: 'https://docs.google.com/spreadsheets/d/1YEu-awdBQxR1zOwSUZwDYkv_t3YFSzZ4srIeGCxW5zc/export?format=csv&gid=0'
};

function doGet(e) {
  const mode = (e && e.parameter && e.parameter.mode) ? e.parameter.mode : 'harga';
  const password = (e && e.parameter && e.parameter.password) ? e.parameter.password : '';
  
  // Verifikasi Password jika dikonfigurasi
  if (CONFIG.BACKEND_PASSWORD && password !== CONFIG.BACKEND_PASSWORD) {
    return createJsonResponse({ error: 'Unauthorized: Password backend tidak valid' }, 401);
  }

  try {
    const csvUrl = mode === 'stok' ? CONFIG.STOK_CSV_URL : CONFIG.HARGA_CSV_URL;
    const response = UrlFetchApp.fetch(csvUrl);
    const csvText = response.getContentText();
    
    let lines = csvText.split('\n');
    
    if (mode === 'stok') {
      let headerIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('Brand,')) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx !== -1) {
        lines = lines.slice(headerIdx);
      }
    }
    
    const parsedData = parseCsvLines(lines);
    
    return createJsonResponse({
      status: 'success',
      mode: mode,
      headers: parsedData.headers,
      data: parsedData.rows,
      timestamp: new Date().toISOString()
    }, 200);

  } catch (error) {
    return createJsonResponse({ error: error.toString() }, 500);
  }
}

function parseCsvLines(lines) {
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const headers = parseCsvRow(lines[0]).map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCsvRow(lines[i]);
    const rowObj = {};
    
    headers.forEach((header, index) => {
      rowObj[header] = values[index] !== undefined ? values[index].trim() : '';
    });
    
    rows.push(rowObj);
  }
  
  return { headers, rows };
}

function parseCsvRow(rowStr) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function createJsonResponse(obj, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

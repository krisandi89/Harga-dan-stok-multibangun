/**
 * Google Apps Script (GAS) Backend untuk Multibangun MaterialHub
 *
 * CARA PAKAI (AMAN UNTUK REPO PUBLIK — JANGAN HARDCODE URL/PASSWORD DI KODE):
 * 1. Buka https://script.google.com/ dan buat proyek "Multibangun-Backend"
 * 2. Copas kode di bawah ini ke dalam Code.gs
 * 3. Buka "Project Settings" -> "Script Properties" -> tambahkan property:
 *    - HARGA_CSV_URL    : URL CSV Google Sheet Harga (atau pakai SpreadsheetApp.openById)
 *    - STOK_CSV_URL     : URL CSV Google Sheet Stok
 *    - BACKEND_PASSWORD : Password rahasia (samakan dengan GAS_BACKEND_PASSWORD di Vercel)
 * 4. Klik "Deploy" -> "New deployment" -> "Web app"
 * 5. Execute as: "Me" | Who has access: "Anyone"
 * 6. Simpan Web App URL ke Vercel Environment Variable: GAS_WEBAPP_URL
 */

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    BACKEND_PASSWORD: (props.getProperty('BACKEND_PASSWORD') || '').trim(),
    HARGA_CSV_URL: (props.getProperty('HARGA_CSV_URL') || '').trim(),
    STOK_CSV_URL: (props.getProperty('STOK_CSV_URL') || '').trim()
  };
}

function doGet(e) {
  const config = getConfig();
  const mode = (e && e.parameter && e.parameter.mode) ? e.parameter.mode : 'harga';
  const password = (e && e.parameter && e.parameter.password) ? e.parameter.password : '';

  // Verifikasi Password jika dikonfigurasi di Script Properties
  if (config.BACKEND_PASSWORD && password !== config.BACKEND_PASSWORD) {
    return createJsonResponse({ error: 'Unauthorized: Password backend tidak valid' });
  }

  try {
    const csvUrl = mode === 'stok' ? config.STOK_CSV_URL : config.HARGA_CSV_URL;
    if (!csvUrl) {
      return createJsonResponse({
        error: 'Script Property ' + (mode === 'stok' ? 'STOK_CSV_URL' : 'HARGA_CSV_URL') + ' belum disetel.'
      });
    }

    const response = UrlFetchApp.fetch(csvUrl);
    const csvText = response.getContentText();
    const parsedData = parseCsvFull(csvText, mode === 'stok');

    return createJsonResponse({
      status: 'success',
      mode: mode,
      headers: parsedData.headers,
      data: parsedData.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return createJsonResponse({ error: error.toString() });
  }
}

function parseCsvFull(csvText, isStokMode) {
  const rows = [];
  let curCell = '';
  let curRow = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        curCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      curRow.push(curCell.trim());
      curCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      curRow.push(curCell.trim());
      if (curRow.some(function (c) { return c !== ''; })) {
        rows.push(curRow);
      }
      curRow = [];
      curCell = '';
    } else {
      curCell += char;
    }
  }

  if (curCell || curRow.length > 0) {
    curRow.push(curCell.trim());
    if (curRow.some(function (c) { return c !== ''; })) {
      rows.push(curRow);
    }
  }

  if (isStokMode) {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === 'Brand') {
        return { headers: rows[i], data: rows.slice(i + 1) };
      }
    }
  }

  if (rows.length === 0) return { headers: [], data: [] };
  return { headers: rows[0], data: rows.slice(1) };
}

function createJsonResponse(obj) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

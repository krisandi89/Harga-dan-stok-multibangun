// Multiline-aware CSV Parser: Preserves cell line-breaks (e.g. multiline Keterangan)
export function parseCsvFull(csvText, isStokMode = false) {
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
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      curRow.push(curCell.trim());
      curCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // skip \r\n
      curRow.push(curCell.trim());
      if (curRow.some((c) => c !== '')) {
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
    if (curRow.some((c) => c !== '')) {
      rows.push(curRow);
    }
  }

  if (isStokMode) {
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === 'Brand') {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx !== -1) {
      const headers = rows[headerIdx];
      const data = rows.slice(headerIdx + 1);
      return { headers, data };
    }
  }

  if (rows.length === 0) return { headers: [], data: [] };
  return { headers: rows[0], data: rows.slice(1) };
}

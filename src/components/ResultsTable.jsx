import React from 'react';
import { Search, AlertCircle } from 'lucide-react';

export default function ResultsTable({
  isLoading,
  data,
  headers,
  query,
  currentMode
}) {
  // Helper to escape regex special chars
  const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Helper to highlight matching text
  const renderHighlightedText = (text, searchTerm) => {
    if (!text || !searchTerm.trim()) return text || '-';
    const textStr = String(text);
    const regex = new RegExp(`(${escapeRegex(searchTerm.trim())})`, 'gi');
    const parts = textStr.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="highlight">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  if (isLoading) {
    return (
      <div className="results-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <span>Memuat data {currentMode.toUpperCase()}...</span>
        </div>
      </div>
    );
  }

  if (!query.trim()) {
    return (
      <div className="results-container">
        <div className="empty-state">
          <Search className="big-icon" />
          <h2>Mulai Pencarian</h2>
          <p>Ketik kata kunci untuk mencari {currentMode} material</p>
          <div className="footer-hint" style={{ marginTop: '0.5rem' }}>
            <kbd>Ctrl</kbd> + <kbd>K</kbd> untuk fokus ke pencarian
          </div>
        </div>
      </div>
    );
  }

  const searchTerm = query.toLowerCase().trim();

  // Filter rows matching search query across all cells in array or object
  const filteredData = data.filter((row) => {
    if (Array.isArray(row)) {
      return row.some((cell) => cell !== null && cell !== undefined && String(cell).toLowerCase().includes(searchTerm));
    }
    return Object.values(row).some(
      (val) => val !== null && val !== undefined && String(val).toLowerCase().includes(searchTerm)
    );
  });

  if (filteredData.length === 0) {
    return (
      <div className="results-container">
        <div className="no-results">
          <AlertCircle className="big-icon" />
          <p>Tidak ditemukan hasil untuk "{query}"</p>
        </div>
      </div>
    );
  }

  // Format headers & display logic
  let displayHeaders = headers;
  let processedData = [];

  if (currentMode === 'harga') {
    // Array-based cell row format ensures duplicate "Konversi" headers get exact column values
    processedData = filteredData.map((row) => {
      if (Array.isArray(row)) return row;
      // Fallback for object format
      return headers.map((h) => row[h] || '');
    });
  } else if (currentMode === 'stok') {
    displayHeaders = ['Brand', 'Material', 'Dimensi Roll', 'Saldo', 'Keterangan', 'Gudang'];
    
    processedData = filteredData.map((row) => {
      if (Array.isArray(row)) {
        const brand = row[0] || '-';
        const material = row[1] || '-';
        const dimensi = row[2] || '-';
        const saldoValue = row[3] || '';
        const unit = row[4] || '';
        const saldoFormatted = unit ? `${saldoValue} ${unit}` : (saldoValue || '-');
        const keterangan = row[5] || '-';
        const gudang = row[6] || '-';
        return [brand, material, dimensi, saldoFormatted, keterangan, gudang];
      }
      // Object fallback
      const saldoValue = row['Saldo'] || '';
      const unitKey = Object.keys(row).find((key) => key === '' || key.match(/^(pcs|m2|m'|m|batang|roll)$/i));
      const unit = unitKey ? row[unitKey] : '';
      return [
        row['Brand'] || '-',
        row['Material'] || '-',
        row['Dimensi Roll'] || '-',
        unit ? `${saldoValue} ${unit}` : (saldoValue || '-'),
        row['Keterangan'] || '-',
        row['Gudang'] || '-'
      ];
    });
  }

  return (
    <div className="results-container">
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {displayHeaders.map((h, idx) => (
                <th key={idx}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedData.map((rowCells, rIdx) => (
              <tr key={rIdx}>
                {rowCells.map((cellValue, cIdx) => (
                  <td key={cIdx}>{renderHighlightedText(cellValue, query)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="results-footer">
        <span>{filteredData.length} hasil ditemukan</span>
        <span>Mode: {currentMode.toUpperCase()}</span>
      </div>
    </div>
  );
}

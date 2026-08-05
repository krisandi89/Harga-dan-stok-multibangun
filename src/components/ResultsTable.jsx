import React, { useState } from 'react';
import { Search, AlertCircle, LayoutList, Table } from 'lucide-react';

export default function ResultsTable({
  isLoading,
  data,
  headers,
  query,
  currentMode
}) {
  const [viewLayout, setViewLayout] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      return 'cards';
    }
    return 'table';
  });

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
    processedData = filteredData.map((row) => {
      if (Array.isArray(row)) return row;
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
      <div className="results-header-tools">
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Menampilkan {filteredData.length} hasil
        </span>

        <div className="view-mode-toggle">
          <button
            className={`view-mode-btn ${viewLayout === 'table' ? 'active' : ''}`}
            onClick={() => setViewLayout('table')}
            title="Tampilan Tabel (Sticky Left Column)"
          >
            <Table size={14} />
            <span>Tabel</span>
          </button>
          <button
            className={`view-mode-btn ${viewLayout === 'cards' ? 'active' : ''}`}
            onClick={() => setViewLayout('cards')}
            title="Tampilan Kartu Ringkas Mobile"
          >
            <LayoutList size={14} />
            <span>Kartu</span>
          </button>
        </div>
      </div>

      {viewLayout === 'table' ? (
        <>
          <div className="mobile-scroll-hint">
            ← Geser tabel ke kanan untuk melihat detail lengkap →
          </div>
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
        </>
      ) : (
        <div className="mobile-cards-grid">
          {processedData.map((rowCells, rIdx) => {
            const primaryTitle = rowCells[1] || rowCells[0] || 'Item Material';
            const badgeTag = rowCells[0] || 'BRAND';
            return (
              <div key={rIdx} className="mobile-card">
                <div className="mobile-card-header">
                  <div className="mobile-card-title">
                    {renderHighlightedText(primaryTitle, query)}
                  </div>
                  <span className="mobile-card-badge">
                    {renderHighlightedText(badgeTag, query)}
                  </span>
                </div>
                {displayHeaders.map((headerName, cIdx) => {
                  if (cIdx === 0 && primaryTitle === rowCells[1]) return null;
                  if (cIdx === 1) return null;
                  return (
                    <div key={cIdx} className="mobile-card-row">
                      <span className="mobile-card-label">{headerName}:</span>
                      <span className="mobile-card-value">
                        {renderHighlightedText(rowCells[cIdx], query)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <div className="results-footer">
        <span>{filteredData.length} item ditemukan</span>
        <span>Mode: {currentMode.toUpperCase()}</span>
      </div>
    </div>
  );
}


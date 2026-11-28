import React, { useState, useMemo } from 'react';
import { Search, AlertCircle, LayoutList, Table } from 'lucide-react';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedText(text, searchTerm) {
  if (text === null || text === undefined || text === '') return '-';
  const trimmed = searchTerm.trim();
  const textStr = String(text);
  if (!trimmed) return textStr;

  const trimmedLower = trimmed.toLowerCase();
  const regex = new RegExp(`(${escapeRegex(trimmed)})`, 'gi');
  const parts = textStr.split(regex);

  return parts.map((part, i) =>
    part.toLowerCase() === trimmedLower ? (
      <span key={i} className="highlight">
        {part}
      </span>
    ) : (
      part
    )
  );
}

/**
 * Normalize HARGA headers:
 * - Drop empty spacer columns and global sheet-level helper columns (e.g. "Kurs Jual USD Bank Panin").
 * - Disambiguate duplicate "Konversi" headers into "Konversi Satuan" / "Konversi Net".
 * - Normalize casing typos like "Harga NEt" -> "Harga Net".
 */
function buildHargaColumnPlan(rawHeaders = []) {
  const columns = [];
  let prevCleanHeader = '';

  rawHeaders.forEach((rawHeader, index) => {
    const trimmed = String(rawHeader || '').trim();
    if (!trimmed) return;
    if (/^kurs\s+jual/i.test(trimmed)) return;

    let label = trimmed.replace(/^harga\s+net$/i, 'Harga Net');
    if (/^konversi$/i.test(label)) {
      if (/satuan/i.test(prevCleanHeader)) {
        label = 'Konversi Satuan';
      } else if (/net/i.test(prevCleanHeader)) {
        label = 'Konversi Net';
      }
    }

    columns.push({ index, rawHeader: trimmed, label });
    prevCleanHeader = label;
  });

  return columns;
}

export default function ResultsTable({
  isLoading,
  data,
  headers,
  query,
  currentMode
}) {
  const [viewLayout, setViewLayout] = useState('cards');

  const trimmedQuery = query.trim();

  const { displayHeaders, processedData } = useMemo(() => {
    if (!trimmedQuery || !Array.isArray(data) || data.length === 0) {
      return { displayHeaders: headers || [], processedData: [] };
    }

    const searchTerm = trimmedQuery.toLowerCase();

    if (currentMode === 'stok') {
      const stokHeaders = ['Brand', 'Material', 'Dimensi Roll', 'Saldo', 'Keterangan', 'Gudang'];
      let lastBrand = '';

      const normalizedRows = data.map((row) => {
        if (Array.isArray(row)) {
          const rawBrand = row[0] || '';
          if (rawBrand) lastBrand = rawBrand;
          const brand = rawBrand || lastBrand || '-';
          const material = row[1] || '-';
          const dimensi = row[2] || '-';
          const saldoValue = row[3] || '';
          const unit = row[4] || '';
          const saldoFormatted = unit ? `${saldoValue} ${unit}`.trim() : (saldoValue || '-');
          const keterangan = row[5] || '-';
          const gudang = row[6] || '-';
          return [brand, material, dimensi, saldoFormatted, keterangan, gudang];
        }

        const rawBrand = row['Brand'] || '';
        if (rawBrand) lastBrand = rawBrand;
        const saldoValue = row['Saldo'] || '';
        const unitKey = Object.keys(row).find((key) => key === '' || /^(pcs|m2|m'|m|batang|roll)$/i.test(key));
        const unit = unitKey ? row[unitKey] : '';
        return [
          rawBrand || lastBrand || '-',
          row['Material'] || '-',
          row['Dimensi Roll'] || '-',
          unit ? `${saldoValue} ${unit}`.trim() : (saldoValue || '-'),
          row['Keterangan'] || '-',
          row['Gudang'] || '-'
        ];
      });

      const filtered = normalizedRows.filter((rowCells) =>
        rowCells.some((cell) => String(cell).toLowerCase().includes(searchTerm))
      );

      return { displayHeaders: stokHeaders, processedData: filtered };
    }

    // Mode HARGA
    const columnPlan = buildHargaColumnPlan(headers);
    const activePlan = columnPlan.length > 0
      ? columnPlan
      : (headers || []).map((h, index) => ({ index, rawHeader: h, label: h || `Kolom ${index + 1}` }));

    const normalizedRows = data.map((row) => {
      if (Array.isArray(row)) {
        return activePlan.map((col) => row[col.index] ?? '');
      }
      return activePlan.map((col) => row[col.rawHeader] ?? '');
    });

    const filtered = normalizedRows.filter((rowCells) =>
      rowCells.some((cell) => cell !== null && cell !== undefined && String(cell).toLowerCase().includes(searchTerm))
    );

    return {
      displayHeaders: activePlan.map((col) => col.label),
      processedData: filtered
    };
  }, [data, headers, trimmedQuery, currentMode]);

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

  if (!trimmedQuery) {
    return (
      <div className="results-container">
        <div className="empty-state">
          <Search className="big-icon" />
          <h2>Mulai Pencarian</h2>
          <p>Ketik kata kunci untuk mencari {currentMode} material</p>
          <div className="footer-hint" style={{ marginTop: '0.5rem' }}>
            <kbd>{IS_MAC ? '⌘' : 'Ctrl'}</kbd> + <kbd>K</kbd> untuk fokus ke pencarian
          </div>
        </div>
      </div>
    );
  }

  if (processedData.length === 0) {
    return (
      <div className="results-container">
        <div className="no-results">
          <AlertCircle className="big-icon" />
          <p>Tidak ditemukan hasil untuk &ldquo;{query}&rdquo;</p>
        </div>
      </div>
    );
  }

  const brandColIdx = displayHeaders.findIndex((h) => /^brand$/i.test(h));
  const materialColIdx = displayHeaders.findIndex((h) => /^material$/i.test(h));
  const titleIdx = materialColIdx !== -1 ? materialColIdx : (displayHeaders.length > 1 ? 1 : 0);
  const badgeIdx = brandColIdx !== -1 ? brandColIdx : (titleIdx !== 0 ? 0 : -1);

  return (
    <div className="results-container">
      <div className="results-header-tools">
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Menampilkan {processedData.length} hasil
        </span>

        <div className="view-mode-toggle">
          <button
            type="button"
            className={`view-mode-btn ${viewLayout === 'table' ? 'active' : ''}`}
            onClick={() => setViewLayout('table')}
            title="Tampilan Tabel (Sticky Left Column)"
          >
            <Table size={14} />
            <span>Tabel</span>
          </button>
          <button
            type="button"
            className={`view-mode-btn ${viewLayout === 'cards' ? 'active' : ''}`}
            onClick={() => setViewLayout('cards')}
            title="Tampilan Kartu Ringkas"
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
                      <td key={cIdx}>{renderHighlightedText(cellValue, trimmedQuery)}</td>
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
            const titleValue = rowCells[titleIdx];
            const badgeValue = badgeIdx !== -1 ? rowCells[badgeIdx] : '';
            const primaryTitle = titleValue || badgeValue || 'Item Material';
            const showBadge = badgeIdx !== -1 && badgeValue && badgeValue !== '-' && primaryTitle !== badgeValue;

            return (
              <div key={rIdx} className="mobile-card">
                <div className="mobile-card-header">
                  <div className="mobile-card-title">
                    {renderHighlightedText(primaryTitle, trimmedQuery)}
                  </div>
                  {showBadge && (
                    <span className="mobile-card-badge">
                      {renderHighlightedText(badgeValue, trimmedQuery)}
                    </span>
                  )}
                </div>
                {displayHeaders.map((headerName, cIdx) => {
                  if (cIdx === titleIdx && titleValue) return null;
                  if (cIdx === badgeIdx && (showBadge || primaryTitle === badgeValue)) return null;
                  const cellVal = rowCells[cIdx];
                  if (currentMode === 'harga' && (cellVal === '' || cellVal === null || cellVal === undefined)) {
                    return null;
                  }
                  return (
                    <div key={cIdx} className="mobile-card-row">
                      <span className="mobile-card-label">{headerName}:</span>
                      <span className="mobile-card-value">
                        {renderHighlightedText(cellVal, trimmedQuery)}
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
        <span>{processedData.length} item ditemukan</span>
        <span>Mode: {currentMode.toUpperCase()}</span>
      </div>
    </div>
  );
}

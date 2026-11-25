import React from 'react';
import { LogOut, Clock } from 'lucide-react';

function formatIdr(value) {
  if (!Number.isFinite(Number(value))) return '-';
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0
  }).format(Math.round(Number(value)));
}

function formatTimeWib(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export default function Header({ isAuthenticated, onLogout, kurs, kursLoading, kursError }) {
  const paninSell = kurs?.panin?.sell;
  const updatedTime = formatTimeWib(kurs?.fetchedAt);

  return (
    <header className="header">
      {isAuthenticated && (
        <div className="header-top-bar">
          <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>●</span> Terautentikasi
          </div>
          <button className="logout-btn" onClick={onLogout} title="Keluar dari Aplikasi">
            <LogOut size={14} />
            Keluar
          </button>
        </div>
      )}

      <h1>
        Multibangun <span className="text-accent">MaterialHub</span>
      </h1>
      <p className="tagline">Pusat data harga dan ketersediaan stok material</p>

      {isAuthenticated && (
        <div className="kurs-banner" aria-live="polite">
          <div className="kurs-main">
            <span className="kurs-live-dot" title="Update otomatis setiap 30 detik" />
            <span className="kurs-label">Kurs Panin · Jual</span>

            {kursLoading && !paninSell ? (
              <span className="kurs-value-muted">Memuat kurs Panin...</span>
            ) : paninSell ? (
              <span className="kurs-value">1 USD = Rp {formatIdr(paninSell)}</span>
            ) : (
              <span className="kurs-value-muted">{kursError || 'Kurs Panin belum tersedia'}</span>
            )}
          </div>

          {updatedTime !== '-' && (
            <div className="kurs-meta">
              <span className="kurs-updated" title="Sumber: Kurs Jual Bank Panin">
                <Clock size={12} />
                {updatedTime}
              </span>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

import React from 'react';
import { LogOut, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

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
  const spotRate = kurs?.spot?.rate;
  const spotChange = kurs?.spot?.change;
  const spotChangePct = kurs?.spot?.changePercent;
  const paninBuy = kurs?.panin?.buy;
  const paninSell = kurs?.panin?.sell;
  const updatedTime = formatTimeWib(kurs?.fetchedAt || kurs?.spot?.marketTime);

  const hasChange = Number.isFinite(Number(spotChange)) && Number(spotChange) !== 0;
  const isUp = Number(spotChange) > 0;
  const isDown = Number(spotChange) < 0;

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
            <span className="kurs-label">Kurs USD</span>

            {kursLoading && !kurs ? (
              <span className="kurs-value-muted">Memuat kurs...</span>
            ) : spotRate ? (
              <>
                <span className="kurs-value">1 USD = Rp {formatIdr(spotRate)}</span>
                {hasChange && (
                  <span className={`kurs-delta ${isUp ? 'up' : isDown ? 'down' : ''}`}>
                    {isUp ? <TrendingUp size={12} /> : isDown ? <TrendingDown size={12} /> : <Minus size={12} />}
                    {isUp ? '+' : ''}{formatIdr(spotChange)} ({isUp ? '+' : ''}{spotChangePct}%)
                  </span>
                )}
              </>
            ) : paninBuy || paninSell ? (
              <span className="kurs-value">
                Panin Tengah Rp {formatIdr(kurs?.panin?.mid ?? ((paninBuy + paninSell) / 2))}
              </span>
            ) : (
              <span className="kurs-value-muted">{kursError || 'Kurs belum tersedia'}</span>
            )}
          </div>

          <div className="kurs-meta">
            {(paninBuy || paninSell) && (
              <span className="kurs-panin-pill" title="Kurs referensi Bank Panin">
                <strong>Panin:</strong> Beli Rp {formatIdr(paninBuy)} · Jual Rp {formatIdr(paninSell)}
              </span>
            )}
            {updatedTime !== '-' && (
              <span className="kurs-updated" title={`Sumber: ${kurs?.spot?.source || 'Bank Panin'}`}>
                <Clock size={12} />
                {updatedTime}
              </span>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

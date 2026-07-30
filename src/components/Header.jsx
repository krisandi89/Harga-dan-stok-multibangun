import React from 'react';
import { LogOut } from 'lucide-react';

export default function Header({ isAuthenticated, onLogout }) {
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
    </header>
  );
}

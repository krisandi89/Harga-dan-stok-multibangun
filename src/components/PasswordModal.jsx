import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';

export default function PasswordModal({ isOpen, onClose, onSave, currentPassword }) {
  const [passwordInput, setPasswordInput] = useState(currentPassword || '');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(passwordInput.trim());
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={20} className="text-accent" />
            <h3>Password Backend</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.9rem', color: '#9ca3af' }}>
          Masukkan password backend jika backend GAS / Vercel di-proteksi oleh password.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="password"
            className="search-input"
            style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
            placeholder="Masukkan Password..."
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
          />

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setPasswordInput('');
                onSave('');
                onClose();
              }}
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                border: 'none',
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Hapus Password
            </button>
            <button type="submit" className="btn-primary">
              Simpan & Hubungkan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

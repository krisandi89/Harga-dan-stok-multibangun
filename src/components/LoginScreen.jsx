import React, { useState } from 'react';
import { Lock, Building2, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginScreen({ onLogin, error, isSubmitting }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim() || isSubmitting) return;
    onLogin(password.trim());
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon-badge">
            <Building2 size={28} className="text-accent" />
          </div>
          <h2>Multibangun <span className="text-accent">MaterialHub</span></h2>
          <p>Masukkan password untuk mengakses data harga dan stok</p>
        </div>

        {error && (
          <div className="login-error-alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <KeyRound size={20} className="input-icon" />
            <input
              type="password"
              className="login-input"
              placeholder="Masukkan Password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              required
            />
          </div>

          <button type="submit" className="login-submit-btn" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <span>Masuk ke Dashboard</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="login-footer-note">
          <Lock size={14} />
          <span>Password Bawaan: <strong>multibangun123</strong></span>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { RefreshCw, Lock } from 'lucide-react';

export default function StatusFooter({
  countdown,
  onRefresh,
  isRefreshing,
  onOpenPasswordModal,
  hasPassword
}) {
  return (
    <footer className="status-footer">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>Auto-refresh dalam: <strong>{countdown}s</strong></span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          className="refresh-btn"
          onClick={onOpenPasswordModal}
          title="Atur Password Backend"
        >
          <Lock size={14} />
          {hasPassword ? 'Password Set' : 'Password Backend'}
        </button>

        <button
          className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw size={14} />
          {isRefreshing ? 'Memperbarui...' : 'Refresh Manual'}
        </button>
      </div>
    </footer>
  );
}

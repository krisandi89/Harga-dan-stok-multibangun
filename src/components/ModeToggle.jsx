import React from 'react';
import { DollarSign, Package } from 'lucide-react';

export default function ModeToggle({ currentMode, onToggle }) {
  return (
    <div className="toggle-container">
      <button
        className={`toggle-btn ${currentMode === 'harga' ? 'active' : ''}`}
        onClick={() => onToggle('harga')}
      >
        <DollarSign size={18} />
        Harga
      </button>
      <button
        className={`toggle-btn ${currentMode === 'stok' ? 'active' : ''}`}
        onClick={() => onToggle('stok')}
      >
        <Package size={18} />
        Stok
      </button>
    </div>
  );
}

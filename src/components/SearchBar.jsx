import React, { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

export default function SearchBar({ query, setQuery, currentMode }) {
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        if (query) {
          setQuery('');
        } else {
          inputRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [query, setQuery]);

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="spotlight-container">
      <div className="spotlight">
        <Search className="search-icon" />
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={currentMode === 'harga' ? 'Cari harga material...' : 'Cari stok material...'}
          aria-label={currentMode === 'harga' ? 'Cari harga material' : 'Cari stok material'}
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            className="search-clear-btn"
            onClick={handleClear}
            aria-label="Hapus pencarian"
            title="Hapus pencarian (Esc)"
          >
            <X size={16} />
          </button>
        ) : (
          <div className="search-hint-kbd">
            <kbd>{IS_MAC ? '⌘ K' : 'Ctrl K'}</kbd>
          </div>
        )}
      </div>
    </div>
  );
}

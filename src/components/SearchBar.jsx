import React, { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

export default function SearchBar({ query, setQuery, currentMode }) {
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
          autoComplete="off"
        />
        <div className="search-hint-kbd">
          <kbd>⌘ K</kbd>
        </div>
      </div>
    </div>
  );
}

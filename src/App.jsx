import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import ModeToggle from './components/ModeToggle';
import SearchBar from './components/SearchBar';
import ResultsTable from './components/ResultsTable';
import StatusFooter from './components/StatusFooter';
import LoginScreen from './components/LoginScreen';

const AUTO_REFRESH_SECONDS = 30;
const DEFAULT_PASSWORD = 'multibangun123';

const DEFAULT_SHEETS = {
  harga: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTpP3VHWDYD_sju_TrkIIvOQm_PoTbfQX8mMvm6HkcrsJ56cAQjP229Quz9Y_0hpaLwktjE5w8RBJzK/pub?gid=0&single=true&output=csv',
  stok: 'https://docs.google.com/spreadsheets/d/1YEu-awdBQxR1zOwSUZwDYkv_t3YFSzZ4srIeGCxW5zc/export?format=csv&gid=0'
};

function parseCsvFullClient(csvText, isStokMode = false) {
  const rows = [];
  let curCell = '';
  let curRow = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        curCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      curRow.push(curCell.trim());
      curCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      curRow.push(curCell.trim());
      if (curRow.some((c) => c !== '')) {
        rows.push(curRow);
      }
      curRow = [];
      curCell = '';
    } else {
      curCell += char;
    }
  }

  if (curCell || curRow.length > 0) {
    curRow.push(curCell.trim());
    if (curRow.some((c) => c !== '')) {
      rows.push(curRow);
    }
  }

  if (isStokMode) {
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === 'Brand') {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx !== -1) {
      const headers = rows[headerIdx];
      const data = rows.slice(headerIdx + 1);
      return { headers, data };
    }
  }

  if (rows.length === 0) return { headers: [], data: [] };
  return { headers: rows[0], data: rows.slice(1) };
}

export default function App() {
  const [password, setPassword] = useState(() => sessionStorage.getItem('mb_auth_password') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(sessionStorage.getItem('mb_auth_password')));
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentMode, setCurrentMode] = useState('harga'); // 'harga' | 'stok'
  const [query, setQuery] = useState('');

  const [data, setData] = useState({ harga: [], stok: [] });
  const [headers, setHeaders] = useState({ harga: [], stok: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS);

  // Fetch data function with serverless API + Direct Google Sheets CSV Fallback
  const fetchData = useCallback(async (modeToFetch, pass, isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams({ mode: modeToFetch });
      if (pass) params.append('password', pass);

      let fetchedSuccess = false;
      try {
        const res = await fetch(`/api/data?${params.toString()}`);

        if (res.status === 401) {
          setIsAuthenticated(false);
          setAuthError('Password salah. Silakan coba lagi.');
          sessionStorage.removeItem('mb_auth_password');
          return false;
        }

        if (res.ok) {
          const json = await res.json();
          setData((prev) => ({ ...prev, [modeToFetch]: json.data || [] }));
          setHeaders((prev) => ({ ...prev, [modeToFetch]: json.headers || [] }));
          setIsAuthenticated(true);
          setAuthError('');
          fetchedSuccess = true;
        }
      } catch (e) {
        console.warn('Backend API endpoint unreachable, falling back to direct sheets fetch...', e);
      }

      // Fallback if API returned error or was 404
      if (!fetchedSuccess) {
        const csvUrl = DEFAULT_SHEETS[modeToFetch] || DEFAULT_SHEETS.harga;
        const resCsv = await fetch(csvUrl);
        if (!resCsv.ok) throw new Error(`HTTP ${resCsv.status}`);
        const csvText = await resCsv.text();
        const parsed = parseCsvFullClient(csvText, modeToFetch === 'stok');

        setData((prev) => ({ ...prev, [modeToFetch]: parsed.data || [] }));
        setHeaders((prev) => ({ ...prev, [modeToFetch]: parsed.headers || [] }));
        setIsAuthenticated(true);
        setAuthError('');
      }

      return true;
    } catch (err) {
      console.error(`Gagal memuat data ${modeToFetch}:`, err);
      if (pass === DEFAULT_PASSWORD || sessionStorage.getItem('mb_auth_password')) {
        setIsAuthenticated(true);
        setAuthError('');
        return true;
      }
      setAuthError('Gagal terhubung ke server API data.');
      return false;
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);


  // Handle User Login
  const handleLogin = async (enteredPassword) => {
    setAuthError('');
    setIsSubmitting(true);

    if (enteredPassword !== DEFAULT_PASSWORD && sessionStorage.getItem('mb_auth_password') && enteredPassword !== sessionStorage.getItem('mb_auth_password')) {
      const success = await fetchData(currentMode, enteredPassword, false);
      setIsSubmitting(false);
      if (success) {
        setPassword(enteredPassword);
        sessionStorage.setItem('mb_auth_password', enteredPassword);
      } else {
        setAuthError('Password salah. Silakan coba lagi.');
      }
      return;
    }

    setPassword(enteredPassword);
    sessionStorage.setItem('mb_auth_password', enteredPassword);
    setIsAuthenticated(true);
    setAuthError('');

    await fetchData(currentMode, enteredPassword, false);
    setIsSubmitting(false);
  };

  // Handle Logout
  const handleLogout = () => {
    setPassword('');
    setIsAuthenticated(false);
    sessionStorage.removeItem('mb_auth_password');
    setData({ harga: [], stok: [] });
  };

  // Mode toggle handler
  const handleModeToggle = (newMode) => {
    if (newMode === currentMode) return;
    setCurrentMode(newMode);
    setQuery('');
    if (!data[newMode] || data[newMode].length === 0) {
      fetchData(newMode, password);
    }
  };

  // Initial load
  useEffect(() => {
    if (password) {
      fetchData('harga', password);
    }
  }, [fetchData, password]);

  // Countdown & Auto-refresh timer
  useEffect(() => {
    if (!isAuthenticated) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData(currentMode, password, true);
          return AUTO_REFRESH_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentMode, password, isAuthenticated, fetchData]);

  // Manual refresh handler
  const handleManualRefresh = () => {
    fetchData(currentMode, password, true);
    setCountdown(AUTO_REFRESH_SECONDS);
  };

  // Render Login Screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} error={authError} isSubmitting={isSubmitting} />;
  }

  return (
    <div className="app-container">
      <Header isAuthenticated={isAuthenticated} onLogout={handleLogout} />

      <ModeToggle currentMode={currentMode} onToggle={handleModeToggle} />

      <SearchBar query={query} setQuery={setQuery} currentMode={currentMode} />

      <ResultsTable
        isLoading={isLoading && (!data[currentMode] || data[currentMode].length === 0)}
        data={data[currentMode] || []}
        headers={headers[currentMode] || []}
        query={query}
        currentMode={currentMode}
      />

      <StatusFooter
        countdown={countdown}
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
      />
    </div>
  );
}

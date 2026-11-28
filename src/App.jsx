import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import ModeToggle from './components/ModeToggle';
import SearchBar from './components/SearchBar';
import ResultsTable from './components/ResultsTable';
import StatusFooter from './components/StatusFooter';
import LoginScreen from './components/LoginScreen';

const AUTO_REFRESH_SECONDS = 30;

export default function App() {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentMode, setCurrentMode] = useState('harga'); // 'harga' | 'stok'
  const [query, setQuery] = useState('');

  const [data, setData] = useState({ harga: [], stok: [] });
  const [headers, setHeaders] = useState({ harga: [], stok: [] });
  const [dataError, setDataError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [kurs, setKurs] = useState(null);
  const [kursLoading, setKursLoading] = useState(false);
  const [kursError, setKursError] = useState('');

  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS);

  const handleSessionExpired = useCallback(() => {
    setIsAuthenticated(false);
    setAuthError('Sesi Anda telah berakhir. Silakan login kembali.');
    setData({ harga: [], stok: [] });
    setHeaders({ harga: [], stok: [] });
    setKurs(null);
    setKursError('');
    setDataError('');
  }, []);

  // Cek sesi cookie HttpOnly saat aplikasi pertama kali dibuka
  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const res = await fetch('/api/session', {
          method: 'GET',
          credentials: 'same-origin'
        });

        const json = await res.json().catch(() => ({}));
        if (!active) return;

        if (res.ok && json.authenticated) {
          setIsAuthenticated(true);
          setAuthError('');
        } else {
          setIsAuthenticated(false);
          if (res.status === 503 && json.error) {
            setAuthError(json.error);
          }
        }
      } catch (err) {
        console.warn('Gagal memeriksa sesi login:', err);
        if (active) setIsAuthenticated(false);
      } finally {
        if (active) setIsCheckingSession(false);
      }
    }

    checkSession();
    return () => {
      active = false;
    };
  }, []);

  // Fetch kurs jual Bank Panin USD/IDR dari /api/kurs (autentikasi via HttpOnly cookie)
  const fetchKurs = useCallback(async () => {
    setKursLoading(true);
    try {
      const res = await fetch('/api/kurs', {
        method: 'GET',
        credentials: 'same-origin'
      });

      if (res.status === 401) {
        handleSessionExpired();
        return false;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      if (!json?.panin?.sell) {
        throw new Error('Kurs jual Bank Panin belum tersedia');
      }

      setKurs(json);
      setKursError('');
      return true;
    } catch (err) {
      console.warn('Gagal memuat kurs Panin USD/IDR:', err);
      setKursError('Gagal memuat kurs Panin');
      return false;
    } finally {
      setKursLoading(false);
    }
  }, [handleSessionExpired]);

  // Fetch data harga/stok melalui serverless proxy /api/data (tanpa fallback publik dari client)
  const fetchData = useCallback(async (modeToFetch, isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams({ mode: modeToFetch });
      const res = await fetch(`/api/data?${params.toString()}`, {
        method: 'GET',
        credentials: 'same-origin'
      });

      if (res.status === 401) {
        handleSessionExpired();
        return false;
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `Gagal memuat data (HTTP ${res.status})`);
      }

      setData((prev) => ({ ...prev, [modeToFetch]: json.data || [] }));
      setHeaders((prev) => ({ ...prev, [modeToFetch]: json.headers || [] }));
      setDataError('');
      return true;
    } catch (err) {
      console.error(`Gagal memuat data ${modeToFetch}:`, err);
      setDataError(err.message || `Gagal memuat data ${modeToFetch}.`);
      return false;
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [handleSessionExpired]);

  // Login melalui POST /api/login — tunggu verifikasi server sebelum membuka dashboard
  const handleLogin = async (enteredPassword) => {
    setAuthError('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password: enteredPassword })
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.authenticated) {
        setIsAuthenticated(false);
        setAuthError(json.error || 'Password salah. Silakan coba lagi.');
        return;
      }

      setAuthError('');
      setCountdown(AUTO_REFRESH_SECONDS);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Login error:', err);
      setIsAuthenticated(false);
      setAuthError('Gagal terhubung ke server autentikasi. Periksa koneksi Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Logout melalui POST /api/logout untuk menghapus HttpOnly cookie di server
  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
    } catch (err) {
      console.warn('Logout request failed:', err);
    } finally {
      setIsAuthenticated(false);
      setAuthError('');
      setData({ harga: [], stok: [] });
      setHeaders({ harga: [], stok: [] });
      setDataError('');
      setKurs(null);
      setKursError('');
      setQuery('');
      setCurrentMode('harga');
    }
  };

  // Mode toggle handler
  const handleModeToggle = (newMode) => {
    if (newMode === currentMode) return;
    setCurrentMode(newMode);
    setQuery('');
    setDataError('');
    if (!data[newMode] || data[newMode].length === 0) {
      fetchData(newMode);
    }
  };

  // Initial load saat terautentikasi (hanya 1x fetch per sesi masuk)
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData('harga');
    fetchKurs();
  }, [isAuthenticated, fetchData, fetchKurs]);

  // Countdown tick (tanpa memanggil async side-effect di dalam state updater)
  useEffect(() => {
    if (!isAuthenticated) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isAuthenticated]);

  // Trigger auto-refresh saat countdown mencapai 0
  useEffect(() => {
    if (!isAuthenticated || countdown > 0) return;

    fetchData(currentMode, true);
    fetchKurs();
    setCountdown(AUTO_REFRESH_SECONDS);
  }, [countdown, isAuthenticated, currentMode, fetchData, fetchKurs]);

  // Manual refresh handler
  const handleManualRefresh = () => {
    fetchData(currentMode, true);
    fetchKurs();
    setCountdown(AUTO_REFRESH_SECONDS);
  };

  if (isCheckingSession) {
    return (
      <div className="login-wrapper">
        <div className="loading-state">
          <div className="spinner" />
          <span>Memeriksa sesi...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} error={authError} isSubmitting={isSubmitting} />;
  }

  return (
    <div className="app-container">
      <Header
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
        kurs={kurs}
        kursLoading={kursLoading}
        kursError={kursError}
      />

      <ModeToggle currentMode={currentMode} onToggle={handleModeToggle} />

      <SearchBar query={query} setQuery={setQuery} currentMode={currentMode} />

      {dataError && (
        <div className="login-error-alert" role="alert">
          <span>{dataError}</span>
        </div>
      )}

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

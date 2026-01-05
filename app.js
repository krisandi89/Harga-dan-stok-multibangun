/**
 * Multibangun Dashboard - Harga & Stok Material
 * Spotlight-style search from Google Sheets data
 */

// =============================================
// CONFIGURATION
// =============================================
const CONFIG = {
    // Google Sheets CSV URLs
    sheets: {
        harga: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTpP3VHWDYD_sju_TrkIIvOQm_PoTbfQX8mMvm6HkcrsJ56cAQjP229Quz9Y_0hpaLwktjE5w8RBJzK/pub?gid=0&single=true&output=csv',
        stok: 'https://docs.google.com/spreadsheets/d/1YEu-awdBQxR1zOwSUZwDYkv_t3YFSzZ4srIeGCxW5zc/export?format=csv&gid=0'
    },
    debounceMs: 300,
    minSearchLength: 1,
    autoRefreshMs: 30000 // Auto-refresh every 30 seconds
};

// =============================================
// STATE
// =============================================
let state = {
    currentMode: 'harga',
    data: {
        harga: [],
        stok: []
    },
    headers: {
        harga: [],
        stok: []
    },
    isLoading: false,
    dataLoaded: {
        harga: false,
        stok: false
    },
    refreshTimer: null,
    countdownTimer: null,
    countdown: 30
};

// =============================================
// DOM ELEMENTS
// =============================================
const elements = {
    searchInput: document.getElementById('searchInput'),
    currentMode: document.getElementById('currentMode'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    emptyState: document.getElementById('emptyState'),
    noResults: document.getElementById('noResults'),
    searchQuery: document.getElementById('searchQuery'),
    resultsTable: document.getElementById('resultsTable'),
    tableHeader: document.getElementById('tableHeader'),
    tableBody: document.getElementById('tableBody'),
    resultsCount: document.getElementById('resultsCount'),
    toggleBtns: document.querySelectorAll('.toggle-btn')
};

// =============================================
// DATA FETCHING
// =============================================
async function fetchSheetData(mode) {
    console.log(`Fetching ${mode} data...`);

    try {
        const response = await fetch(CONFIG.sheets[mode]);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();

        // For STOK mode, we need to find the actual header row (starts with "Brand")
        if (mode === 'stok') {
            const lines = csvText.split('\n');
            let headerIndex = -1;

            // Find the line that starts with "Brand"
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('Brand,')) {
                    headerIndex = i;
                    break;
                }
            }

            if (headerIndex !== -1) {
                // Rebuild CSV starting from header row
                const cleanedCsv = lines.slice(headerIndex).join('\n');

                const parsed = Papa.parse(cleanedCsv, {
                    header: true,
                    skipEmptyLines: true,
                    transformHeader: (header) => header.trim()
                });

                if (parsed.errors.length > 0) {
                    console.warn('CSV parsing warnings:', parsed.errors);
                }

                state.headers[mode] = parsed.meta.fields || [];
                state.data[mode] = parsed.data;
                state.dataLoaded[mode] = true;

                console.log(`${mode} data loaded:`, state.data[mode].length, 'rows');
                console.log(`${mode} headers:`, state.headers[mode]);

                return true;
            }
        }

        // Default parsing for HARGA mode (or fallback)
        const parsed = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim()
        });

        if (parsed.errors.length > 0) {
            console.warn('CSV parsing warnings:', parsed.errors);
        }

        state.headers[mode] = parsed.meta.fields || [];
        state.data[mode] = parsed.data;
        state.dataLoaded[mode] = true;

        console.log(`${mode} data loaded:`, state.data[mode].length, 'rows');

        return true;
    } catch (error) {
        console.error(`Error fetching ${mode} data:`, error);
        return false;
    }
}

async function loadCurrentModeData() {
    const mode = state.currentMode;

    if (state.dataLoaded[mode]) {
        return true;
    }

    showLoading(true);
    const success = await fetchSheetData(mode);
    showLoading(false);

    return success;
}

// =============================================
// SEARCH FUNCTIONALITY
// =============================================
function searchData(query) {
    const mode = state.currentMode;
    const data = state.data[mode];

    if (!query || query.length < CONFIG.minSearchLength) {
        return [];
    }

    const searchTerm = query.toLowerCase().trim();

    return data.filter(row => {
        // Search across all columns
        return Object.values(row).some(value => {
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(searchTerm);
        });
    });
}

function highlightText(text, query) {
    if (!text || !query) return text;

    const textStr = String(text);
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return textStr.replace(regex, '<span class="highlight">$1</span>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// =============================================
// UI UPDATES
// =============================================
function showLoading(show) {
    state.isLoading = show;
    elements.loadingIndicator.classList.toggle('hidden', !show);
    elements.emptyState.classList.add('hidden');
    elements.noResults.classList.add('hidden');
    elements.resultsTable.classList.add('hidden');
}

function showEmptyState() {
    elements.loadingIndicator.classList.add('hidden');
    elements.emptyState.classList.remove('hidden');
    elements.noResults.classList.add('hidden');
    elements.resultsTable.classList.add('hidden');
}

function showNoResults(query) {
    elements.loadingIndicator.classList.add('hidden');
    elements.emptyState.classList.add('hidden');
    elements.noResults.classList.remove('hidden');
    elements.resultsTable.classList.add('hidden');
    elements.searchQuery.textContent = query;
}

function showResults(results, query) {
    const mode = state.currentMode;
    let headers = state.headers[mode];
    let displayHeaders = headers;
    let processedResults = results;

    // Custom header mapping for STOK mode
    if (mode === 'stok') {
        // Define the columns we want to show for STOK (including Brand)
        displayHeaders = ['Brand', 'Material', 'Dimensi Roll', 'Saldo', 'Keterangan', 'Gudang'];

        // Process results to combine Saldo with unit column
        processedResults = results.map(row => {
            // Find the unit column (column after Saldo, typically empty header or specific name)
            const saldoValue = row['Saldo'] || '';
            // Look for unit in the 5th column (index after Saldo)
            const unitKey = Object.keys(row).find(key => key === '' || key.match(/^(pcs|m2|m'|m|batang|roll)$/i));
            const unit = unitKey ? row[unitKey] : '';

            return {
                ...row,
                'Saldo': unit ? `${saldoValue} ${unit}` : saldoValue
            };
        });
    }

    // Build table header
    elements.tableHeader.innerHTML = `
        <tr>
            ${displayHeaders.map(h => `<th>${h}</th>`).join('')}
        </tr>
    `;

    // Build table body with highlighted text
    elements.tableBody.innerHTML = processedResults.map(row => `
        <tr>
            ${displayHeaders.map(h => `<td>${highlightText(row[h] || '-', query)}</td>`).join('')}
        </tr>
    `).join('');

    elements.resultsCount.textContent = results.length;

    elements.loadingIndicator.classList.add('hidden');
    elements.emptyState.classList.add('hidden');
    elements.noResults.classList.add('hidden');
    elements.resultsTable.classList.remove('hidden');
}

function updateModeDisplay() {
    elements.currentMode.textContent = state.currentMode.toUpperCase();
    elements.searchInput.placeholder =
        state.currentMode === 'harga'
            ? 'Ketik untuk mencari harga... (contoh: SS30)'
            : 'Ketik untuk mencari stok... (contoh: SS30)';
}

// =============================================
// EVENT HANDLERS
// =============================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function handleSearch() {
    const query = elements.searchInput.value.trim();

    if (!query) {
        showEmptyState();
        return;
    }

    // Ensure data is loaded
    const dataReady = await loadCurrentModeData();

    if (!dataReady) {
        showNoResults(query);
        return;
    }

    const results = searchData(query);

    if (results.length === 0) {
        showNoResults(query);
    } else {
        showResults(results, query);
    }
}

const debouncedSearch = debounce(handleSearch, CONFIG.debounceMs);

async function handleModeToggle(mode) {
    if (mode === state.currentMode) return;

    // Update state
    state.currentMode = mode;

    // Update UI
    elements.toggleBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    updateModeDisplay();

    // Clear and refocus search
    elements.searchInput.value = '';
    elements.searchInput.focus();
    showEmptyState();

    // Preload data for this mode
    await loadCurrentModeData();
}

// =============================================
// INITIALIZATION
// =============================================
function initEventListeners() {
    // Search input
    elements.searchInput.addEventListener('input', debouncedSearch);

    // Toggle buttons
    elements.toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            handleModeToggle(btn.dataset.mode);
        });
    });

    // Focus search on load
    elements.searchInput.focus();
}

// =============================================
// AUTO-REFRESH FUNCTIONALITY
// =============================================
async function refreshData() {
    console.log('Auto-refreshing data...');

    // Force reload data (bypass cache)
    state.dataLoaded.harga = false;
    state.dataLoaded.stok = false;

    // Reload current mode data
    const success = await fetchSheetData(state.currentMode);

    if (success) {
        console.log('Data refreshed successfully!');

        // Re-run search if there's a query
        const query = elements.searchInput.value.trim();
        if (query) {
            const results = searchData(query);
            if (results.length === 0) {
                showNoResults(query);
            } else {
                showResults(results, query);
            }
        }
    }
}

function updateCountdownDisplay() {
    const countdownEl = document.getElementById('refreshCountdown');
    if (countdownEl) {
        countdownEl.textContent = state.countdown;
    }
}

function startAutoRefresh() {
    // Clear existing timers
    stopAutoRefresh();

    // Reset countdown
    state.countdown = Math.floor(CONFIG.autoRefreshMs / 1000);
    updateCountdownDisplay();

    // Countdown timer (every second)
    state.countdownTimer = setInterval(() => {
        state.countdown--;
        if (state.countdown < 0) {
            state.countdown = Math.floor(CONFIG.autoRefreshMs / 1000);
        }
        updateCountdownDisplay();
    }, 1000);

    // Refresh timer
    state.refreshTimer = setInterval(async () => {
        await refreshData();
        state.countdown = Math.floor(CONFIG.autoRefreshMs / 1000);
    }, CONFIG.autoRefreshMs);

    console.log(`Auto-refresh started: every ${CONFIG.autoRefreshMs / 1000} seconds`);
}

function stopAutoRefresh() {
    if (state.refreshTimer) {
        clearInterval(state.refreshTimer);
        state.refreshTimer = null;
    }
    if (state.countdownTimer) {
        clearInterval(state.countdownTimer);
        state.countdownTimer = null;
    }
}

async function init() {
    console.log('Initializing Multibangun Dashboard...');

    initEventListeners();
    updateModeDisplay();
    showEmptyState();

    // Preload harga data (default mode)
    await loadCurrentModeData();

    // Start auto-refresh
    startAutoRefresh();

    console.log('Dashboard ready!');
}

// Start the app
document.addEventListener('DOMContentLoaded', init);

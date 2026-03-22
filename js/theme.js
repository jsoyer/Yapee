// Theme script: apply Bootstrap 5 data-bs-theme, support auto/light/dark modes.
// Loaded as a plain <script> (no type="module") so the IIFE runs synchronously
// before Bootstrap CSS renders, preventing a flash of the wrong theme.
// getThemeMode / setThemeMode are provided by js/theme-api.js for ES module consumers.

(function () {
    const STORAGE_KEY = 'themeMode';
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    function applyTheme(mode) {
        let effective;
        if (mode === 'dark') effective = 'dark';
        else if (mode === 'light') effective = 'light';
        else effective = mq.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-bs-theme', effective);
    }

    // Fast path: use sessionStorage cache to avoid FOUC.
    const cached = sessionStorage.getItem(STORAGE_KEY);
    applyTheme(cached || 'auto');

    // Async load from persistent storage and re-apply if needed.
    chrome.storage.local.get([STORAGE_KEY], function (result) {
        const mode = result[STORAGE_KEY] || 'auto';
        sessionStorage.setItem(STORAGE_KEY, mode);
        applyTheme(mode);
    });

    // React to OS-level theme changes when in auto mode.
    mq.addEventListener('change', function () {
        chrome.storage.local.get([STORAGE_KEY], function (result) {
            const mode = result[STORAGE_KEY] || 'auto';
            if (!mode || mode === 'auto') applyTheme('auto');
        });
    });

    // React to theme changes made in other extension pages (options -> popup).
    chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === 'local' && changes[STORAGE_KEY]) {
            const mode = changes[STORAGE_KEY].newValue || 'auto';
            sessionStorage.setItem(STORAGE_KEY, mode);
            applyTheme(mode);
        }
    });
})();

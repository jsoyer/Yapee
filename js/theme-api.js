// ES module API for theme management.
// The actual theme application runs in js/theme.js (plain script, loaded first).
// This module exposes helpers for options.js and any other ES module consumers.

const STORAGE_KEY = 'themeMode';

/**
 * Returns the current stored theme mode.
 * @returns {Promise<'auto'|'light'|'dark'>}
 */
export async function getThemeMode() {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    return result[STORAGE_KEY] || 'auto';
}

/**
 * Persists the theme mode. The theme.js storage.onChanged listener picks it
 * up and applies it to the current page automatically.
 * @param {'auto'|'light'|'dark'} mode
 */
export async function setThemeMode(mode) {
    await chrome.storage.local.set({ [STORAGE_KEY]: mode });
}

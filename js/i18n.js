let _messages = null;
let _locale = 'auto';

/**
 * Load the user's locale preference from storage.
 * If a manual locale is set, fetch the corresponding messages.json.
 * Must be called (and awaited) before applyI18n() for the override to work.
 */
export async function initLocale() {
    const data = await chrome.storage.local.get(['locale']);
    _locale = data.locale ?? 'auto';
    if (_locale === 'auto') {
        _messages = null;
        return;
    }
    try {
        const r = await fetch(chrome.runtime.getURL(`_locales/${_locale}/messages.json`));
        _messages = await r.json();
    } catch {
        _messages = null;
    }
}

/**
 * Return the current locale setting ('auto', 'en', 'fr', …).
 */
export function getLocale() {
    return _locale;
}

/**
 * Persist a new locale and reload messages.
 * Pass 'auto' to revert to browser detection.
 */
export async function setLocale(locale) {
    await chrome.storage.local.set({ locale });
    await initLocale();
    applyI18n();
}

/**
 * Get a translated message by key.
 * Uses the manually-loaded messages if a locale override is active,
 * otherwise falls back to chrome.i18n.getMessage().
 */
export function msg(key, substitutions) {
    if (_messages && _messages[key]) {
        let text = _messages[key].message;
        if (substitutions) {
            const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
            for (let i = 0; i < subs.length; i++) {
                text = text.replace(`$${i + 1}`, subs[i]);
            }
        }
        return text || key;
    }
    return chrome.i18n.getMessage(key, substitutions) || key;
}

/**
 * Apply translations to all data-i18n* attributes in the DOM.
 */
export function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
        const text = msg(el.dataset.i18n);
        if (text && text !== el.dataset.i18n) el.textContent = text;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
        const text = msg(el.dataset.i18nPlaceholder);
        if (text && text !== el.dataset.i18nPlaceholder) el.placeholder = text;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
        const text = msg(el.dataset.i18nTitle);
        if (text && text !== el.dataset.i18nTitle) el.title = text;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
        const text = msg(el.dataset.i18nAria);
        if (text && text !== el.dataset.i18nAria) el.setAttribute('aria-label', text);
    });
}

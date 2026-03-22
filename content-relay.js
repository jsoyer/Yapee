// Relay messages from page scripts (Tampermonkey companion) to the background service worker.
// Injected on pages where the user has granted host permissions.

window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.type !== 'yape-add-package') return;
    const { url, name } = event.data;
    if (!url) return;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
        const pageHost = window.location.hostname;
        const urlHost = parsed.hostname;
        if (pageHost !== urlHost && !urlHost.endsWith('.' + pageHost) && !pageHost.endsWith('.' + urlHost)) return;
    } catch { return; }
    chrome.runtime.sendMessage({ action: 'addPackage', url, name }, (response) => {
        window.postMessage({
            type: 'yape-add-package-response',
            url,
            success: response?.success ?? false,
            error: chrome.runtime.lastError?.message || response?.error || null
        }, window.location.origin);
    });
});

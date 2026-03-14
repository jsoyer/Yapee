// Relay messages from page scripts (Tampermonkey companion) to the background service worker.
// Injected on pages where the user has granted host permissions.

window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.type !== 'yape-add-package') return;
    const { url, name } = event.data;
    if (!url) return;
    chrome.runtime.sendMessage({ action: 'addPackage', url, name }, (response) => {
        window.postMessage({
            type: 'yape-add-package-response',
            url,
            success: response?.success ?? false,
            error: chrome.runtime.lastError?.message || response?.error || null
        }, '*');
    });
});

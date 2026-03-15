import { pullStoredData, origin, getAuthHeaders, incrementStat } from './js/storage.js';
import { addPackage, getStatusDownloads, isCaptchaWaiting, deleteFinished, togglePause } from './js/pyload-api.js';

function nameFromUrl(url) {
    try {
        const pathname = new URL(url).pathname;
        const segment = decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '');
        const name = segment.replace(/\.[^.]+$/, '');
        if (name.length > 2) return name;
    } catch {}
    return url.split('/').pop() || url;
}

const notify = function(title, message, options = {}) {
    return chrome.notifications.create(options.id || '', {
        type: 'basic',
        title: title || 'Yapee',
        message: message || '',
        iconUrl: './images/icon.png',
        buttons: options.buttons || [],
    });
}

async function downloadLink(info, tab) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const statusRes = await fetch(`${origin}/api/statusServer`, { method: 'GET', redirect: 'error', signal: controller.signal, headers: { ...getAuthHeaders() }, credentials: 'omit' });
        const statusJson = await statusRes.json();
        clearTimeout(timeoutId);
        if (Object.hasOwn(statusJson, 'error')) {
            if (statusJson.error === 'Forbidden') notify('Yapee', chrome.i18n.getMessage('bgInvalidCredentials'));
            else notify('Yapee', chrome.i18n.getMessage('bgServerUnreachable'));
            return;
        }
        const checkRes = await fetch(`${origin}/api/checkURLs?urls=["${encodeURIComponent(info.linkUrl)}"]`, {
            method: 'POST',
            redirect: 'error',
            headers: { ...getAuthHeaders() },
            credentials: 'omit'
        });
        const checkJson = await checkRes.json();
        if (Object.hasOwn(checkJson, 'error')) {
            notify('Yapee', chrome.i18n.getMessage('bgCheckUrlError', [checkJson.error || 'unknown error']));
            return;
        }
        const safeName = nameFromUrl(info.linkUrl).replace(/[^a-z0-9._\-]/gi, '_');
        const addRes = await fetch(`${origin}/api/addPackage?name="${encodeURIComponent(safeName)}"&links=["${encodeURIComponent(info.linkUrl)}"]`, {
            method: 'POST',
            redirect: 'error',
            headers: { ...getAuthHeaders() },
            credentials: 'omit'
        });
        const addJson = await addRes.json();
        if (Object.hasOwn(addJson, 'error')) {
            notify('Yapee', chrome.i18n.getMessage('bgDownloadError', [addJson.error || 'unknown error']));
            return;
        }
        incrementStat('packagesAdded');
        notify('Yapee', chrome.i18n.getMessage('bgDownloadAdded'));
    } catch (e) {
        clearTimeout(timeoutId);
        notify('Yapee', chrome.i18n.getMessage('bgServerUnreachable'));
    }
}

chrome.runtime.onInstalled.addListener( () => {
    chrome.contextMenus.create({
        id: 'yape',
        title: chrome.i18n.getMessage('bgContextMenu'),
        contexts:['link']
    });
    chrome.alarms.create('checkDownloads', { periodInMinutes: 0.5 });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if ('yape' !== info.menuItemId) return;
    pullStoredData(() => {
        downloadLink(info, tab);
    });
});

function handleAddPackage(msg, sendResponse) {
    if (msg.action !== 'addPackage' || !msg.url) return false;
    pullStoredData(() => {
        addPackage(msg.name || msg.url, msg.url, (success, error) => {
            if (success) incrementStat('packagesAdded');
            sendResponse({ success, error: error || null });
        });
    });
    return true;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (msg.type === 'notification') {
        notify(msg.title, msg.message);
        return false;
    }
    return handleAddPackage(msg, sendResponse);
});

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
    return handleAddPackage(msg, sendResponse);
});

// --- Notification on complete + Badge ---

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== 'checkDownloads') return;
    pullStoredData(() => {
        getStatusDownloads((downloads) => {
            const currentCount = downloads.length;

            // Badge: captcha warning takes priority, then download count
            isCaptchaWaiting((hasCaptcha) => {
                if (hasCaptcha) {
                    chrome.action.setBadgeText({ text: '!' });
                    chrome.action.setBadgeBackgroundColor({ color: '#dc3545' });
                } else if (currentCount > 0) {
                    chrome.action.setBadgeText({ text: String(currentCount) });
                    chrome.action.setBadgeBackgroundColor({ color: '#0d6efd' });
                } else {
                    chrome.action.setBadgeText({ text: '' });
                }
            });

            // Notification on complete
            chrome.storage.session.get(['lastDownloadCount'], (data) => {
                const lastCount = data.lastDownloadCount || 0;
                if (lastCount > 0 && currentCount === 0) {
                    notify('Yapee', chrome.i18n.getMessage('bgDownloadsComplete'), {
                        id: 'downloadsComplete',
                        buttons: [{ title: chrome.i18n.getMessage('bgClearFinished') || 'Clear finished' }]
                    });
                }
                chrome.storage.session.set({ lastDownloadCount: currentCount });
            });
        });
    });
});

// --- Notification button handler ---

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (notificationId === 'downloadsComplete' && buttonIndex === 0) {
        pullStoredData(() => {
            deleteFinished(() => {
                chrome.notifications.clear(notificationId);
            });
        });
    }
});

// --- Keyboard shortcuts ---

chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-pause') {
        pullStoredData(() => {
            togglePause(() => {});
        });
    }
});

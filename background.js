import { pullStoredData, origin, getAuthHeaders, incrementStat } from './js/storage.js';
import { addPackage, getStatusDownloads } from './js/pyload-api.js';

const notify = function(title, message) {
    return chrome.notifications.create('', {
        type: 'basic',
        title: title || 'Yape',
        message: message || '',
        iconUrl: './images/icon.png',
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
            if (statusJson.error === 'Forbidden') notify('Yape', chrome.i18n.getMessage('bgInvalidCredentials'));
            else notify('Yape', chrome.i18n.getMessage('bgServerUnreachable'));
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
            notify('Yape', chrome.i18n.getMessage('bgCheckUrlError', [checkJson.error || 'unknown error']));
            return;
        }
        const safeName = encodeURIComponent(info.linkUrl.replace(/[^a-z0-9._\-]/gi, '_'));
        const addRes = await fetch(`${origin}/api/addPackage?name="${safeName}"&links=["${encodeURIComponent(info.linkUrl)}"]`, {
            method: 'GET',
            redirect: 'error',
            headers: { ...getAuthHeaders() },
            credentials: 'omit'
        });
        const addJson = await addRes.json();
        if (Object.hasOwn(addJson, 'error')) {
            notify('Yape', chrome.i18n.getMessage('bgDownloadError', [addJson.error || 'unknown error']));
            return;
        }
        incrementStat('packagesAdded');
        notify('Yape', chrome.i18n.getMessage('bgDownloadAdded'));
    } catch (e) {
        clearTimeout(timeoutId);
        notify('Yape', chrome.i18n.getMessage('bgServerUnreachable'));
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

// --- Notification on complete ---

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== 'checkDownloads') return;
    pullStoredData(() => {
        getStatusDownloads((downloads) => {
            chrome.storage.session.get(['lastDownloadCount'], (data) => {
                const lastCount = data.lastDownloadCount || 0;
                const currentCount = downloads.length;
                if (lastCount > 0 && currentCount === 0) {
                    notify('Yape', chrome.i18n.getMessage('bgDownloadsComplete'));
                }
                chrome.storage.session.set({ lastDownloadCount: currentCount });
            });
        });
    });
});

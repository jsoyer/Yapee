import { pullStoredData, origin, getAuthHeaders } from './js/storage.js';

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
        const statusRes = await fetch(`${origin}/api/statusServer`, { method: 'POST', redirect: 'error', signal: controller.signal, headers: { ...getAuthHeaders() } });
        const statusJson = await statusRes.json();
        clearTimeout(timeoutId);
        if (Object.hasOwn(statusJson, 'error')) {
            if (statusJson.error === 'Forbidden') notify('Yape', 'Invalid credentials, make sure you are logged in');
            else notify('Yape', 'Server unreachable');
            return;
        }
        const checkRes = await fetch(`${origin}/api/checkURLs`, {
            method: 'POST',
            redirect: 'error',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...getAuthHeaders() },
            body: `urls=["${encodeURIComponent(info.linkUrl)}"]`
        });
        const checkJson = await checkRes.json();
        if (Object.hasOwn(checkJson, 'error')) {
            notify('Yape', `Error checking url: ${checkJson.error || 'unknown error'}`);
            return;
        }
        const safeName = encodeURIComponent(info.linkUrl.replace(/[^a-z0-9._\-]/gi, '_'));
        const addRes = await fetch(`${origin}/api/addPackage`, {
            method: 'POST',
            redirect: 'error',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...getAuthHeaders() },
            body: `name="${safeName}"&links=["${encodeURIComponent(info.linkUrl)}"]`
        });
        const addJson = await addRes.json();
        if (Object.hasOwn(addJson, 'error')) {
            notify('Yape', `Error requesting download: ${addJson.error || 'unknown error'}`);
            return;
        }
        notify('Yape', 'Download added successfully');
    } catch (e) {
        clearTimeout(timeoutId);
        notify('Yape', 'Server unreachable');
    }
}

chrome.runtime.onInstalled.addListener( () => {
    chrome.contextMenus.create({
        id: 'yape',
        title: 'Download with Yape',
        contexts:['link']
    });
});

chrome.runtime.onMessage.addListener((data, sender) => {
    if (sender.id !== chrome.runtime.id) return;
    if (data.type === 'notification') {
        notify(data.title, data.message);
    }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if ('yape' !== info.menuItemId) return;
    pullStoredData(() => {
        downloadLink(info, tab);
    });
});

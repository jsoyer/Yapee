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

// --- Badge + Enhanced Notifications ---

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== 'checkDownloads') return;
    pullStoredData(() => {
        getStatusDownloads((downloads) => {
            const currentCount = downloads.length;

            // Build current packages map: { pid: { name, percent, speed } }
            const currentPackages = {};
            downloads.forEach(d => {
                if (!currentPackages[d.packageID]) {
                    currentPackages[d.packageID] = { name: d.name, percent: 0, speed: 0 };
                }
                const pkg = currentPackages[d.packageID];
                pkg.percent = Math.max(pkg.percent, parseFloat(d.percent) || 0);
                pkg.speed = Math.max(pkg.speed, d.speed || 0);
            });

            // Collect fids with error status
            const errorFids = {};
            downloads.forEach(d => {
                const s = (d.statusmsg || '').toLowerCase();
                if (s === 'failed' || s === 'aborted' || s === 'offline') {
                    errorFids[d.fid] = d.name;
                }
            });

            chrome.storage.session.get(
                ['lastDownloadCount', 'lastActivePackages', 'lastCaptchaState', 'notifiedErrors'],
                (data) => {
                    const lastCount = data.lastDownloadCount || 0;
                    const lastPackages = data.lastActivePackages || {};
                    const lastCaptcha = data.lastCaptchaState || false;
                    const notifiedErrors = new Set(data.notifiedErrors || []);

                    // Feature 1: Per-package completion
                    for (const pid of Object.keys(lastPackages)) {
                        if (!currentPackages[pid]) {
                            notify('Yapee', chrome.i18n.getMessage('bgPackageComplete', [lastPackages[pid].name]), {
                                id: `complete-${pid}`
                            });
                        }
                    }

                    // "All downloads complete" with clear button (existing)
                    if (lastCount > 0 && currentCount === 0) {
                        notify('Yapee', chrome.i18n.getMessage('bgDownloadsComplete'), {
                            id: 'downloadsComplete',
                            buttons: [{ title: chrome.i18n.getMessage('bgClearFinished') || 'Clear finished' }]
                        });
                    }

                    // Feature 2: Error notifications
                    for (const [fid, name] of Object.entries(errorFids)) {
                        if (!notifiedErrors.has(fid)) {
                            notifiedErrors.add(fid);
                            notify('Yapee', chrome.i18n.getMessage('bgDownloadFailed', [name]), {
                                id: `error-${fid}`
                            });
                        }
                    }
                    // Prune notifiedErrors: remove fids no longer in active downloads
                    const activeFids = new Set(downloads.map(d => String(d.fid)));
                    for (const fid of notifiedErrors) {
                        if (!activeFids.has(String(fid))) notifiedErrors.delete(fid);
                    }

                    // Feature 3: Captcha notification + Badge
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

                        if (hasCaptcha && !lastCaptcha) {
                            notify('Yapee', chrome.i18n.getMessage('bgCaptchaWaiting'), {
                                id: 'captchaWaiting'
                            });
                        }

                        // Feature 4: Progress notification for top active download
                        if (currentCount > 0) {
                            const top = downloads.reduce((a, b) => (b.speed > a.speed ? b : a), downloads[0]);
                            const pct = Math.min(100, Math.max(0, Math.round(parseFloat(top.percent) || 0)));
                            const speedStr = top.speed > 0 ? `${(top.speed / (1000 * 1000)).toFixed(1)} MB/s` : '';
                            const message = speedStr ? `${top.name} — ${speedStr}` : top.name;
                            chrome.notifications.update('downloadProgress', { progress: pct, message }, (updated) => {
                                if (!updated) {
                                    chrome.notifications.create('downloadProgress', {
                                        type: 'progress',
                                        title: 'Yapee',
                                        message,
                                        iconUrl: './images/icon.png',
                                        progress: pct
                                    });
                                }
                            });
                        } else {
                            chrome.notifications.clear('downloadProgress');
                        }

                        // Save state
                        chrome.storage.session.set({
                            lastDownloadCount: currentCount,
                            lastActivePackages: currentPackages,
                            lastCaptchaState: hasCaptcha,
                            notifiedErrors: [...notifiedErrors]
                        });
                    });
                }
            );
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

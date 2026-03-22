import { pullStoredData, incrementStat, addHistoryEntries, batchUpdateStats, getRetryQueue, setRetryQueue, isAutoRetryEnabled } from './js/storage.js';
import { addPackage, getStatusDownloads, isCaptchaWaiting, deleteFinished, togglePause, restartFile, isLoggedIn, checkURL } from './js/pyload-api.js';
import { sendTelegramNotification } from './js/telegram.js';
import { sendDiscordNotification } from './js/discord.js';
import { sendNtfyNotification } from './js/ntfy.js';
import { nameFromUrl } from './js/utils.js';
import { ALARM_PERIOD_MINUTES, INITIAL_RETRY_BACKOFF, MAX_RETRY_BACKOFF, MAX_RETRY_ATTEMPTS } from './js/constants.js';

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
    const { success, unauthorized } = await isLoggedIn();
    if (!success) {
        if (unauthorized) notify('Yapee', chrome.i18n.getMessage('bgInvalidCredentials'));
        else notify('Yapee', chrome.i18n.getMessage('bgServerUnreachable'));
        return;
    }
    const valid = await checkURL(info.linkUrl);
    if (!valid) {
        notify('Yapee', chrome.i18n.getMessage('bgCheckUrlError', ['unknown error']));
        return;
    }
    const safeName = nameFromUrl(info.linkUrl).replace(/[^a-z0-9._\-]/gi, '_');
    const { success: pkgSuccess, error } = await addPackage(safeName, info.linkUrl);
    if (!pkgSuccess) {
        notify('Yapee', chrome.i18n.getMessage('bgDownloadError', [error || 'unknown error']));
        return;
    }
    incrementStat('packagesAdded');
    notify('Yapee', chrome.i18n.getMessage('bgDownloadAdded'));
}

function extractHoster(url) {
    if (!url) return 'unknown';
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return 'unknown';
    }
}

// --- Hoster domain list for link extraction ---

function getHosterDomains() {
    const manifest = chrome.runtime.getManifest();
    const patterns = manifest.externally_connectable?.matches || [];
    const domains = new Set();
    patterns.forEach(p => {
        const match = p.match(/\*:\/\/\*?\.?([^/]+)\//);
        if (match) domains.add(match[1]);
    });
    return [...domains];
}

chrome.runtime.onInstalled.addListener( () => {
    chrome.contextMenus.create({
        id: 'yape',
        title: chrome.i18n.getMessage('bgContextMenu'),
        contexts:['link']
    });
    chrome.contextMenus.create({
        id: 'yape-extract',
        title: chrome.i18n.getMessage('bgExtractLinks'),
        contexts:['page']
    });
    chrome.alarms.create('checkDownloads', { periodInMinutes: ALARM_PERIOD_MINUTES });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'yape') {
        await pullStoredData();
        downloadLink(info, tab);
        return;
    }
    if (info.menuItemId === 'yape-extract') {
        const domains = getHosterDomains();
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (domainList) => {
                const links = new Set();
                document.querySelectorAll('a[href]').forEach(a => {
                    try {
                        const url = new URL(a.href);
                        if (domainList.some(d => url.hostname === d || url.hostname.endsWith('.' + d))) {
                            links.add(a.href);
                        }
                    } catch {}
                });
                return [...links];
            },
            args: [domains]
        }).then(results => {
            const links = results[0]?.result || [];
            if (links.length > 0) {
                chrome.storage.session.set({ extractedLinks: links });
                notify('Yapee', chrome.i18n.getMessage('bgLinksFound', [String(links.length)]), {
                    id: 'linksExtracted'
                });
            } else {
                notify('Yapee', chrome.i18n.getMessage('bgNoLinksFound'), {
                    id: 'linksExtracted'
                });
            }
        }).catch(() => {
            notify('Yapee', chrome.i18n.getMessage('bgNoLinksFound'), {
                id: 'linksExtracted'
            });
        });
        return;
    }
});

async function handleAddPackage(msg, sendResponse) {
    if (msg.action !== 'addPackage' || !msg.url) return false;
    await pullStoredData();
    const { success, error } = await addPackage(msg.name || msg.url, msg.url);
    if (success) incrementStat('packagesAdded');
    sendResponse({ success, error: error || null });
    return true;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (msg.type === 'notification') {
        notify(msg.title, msg.message);
        return false;
    }
    if (msg.action === 'addPackage' && msg.url) {
        handleAddPackage(msg, sendResponse);
        return true;
    }
    return false;
});

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
    if (msg.action !== 'addPackage' || !msg.url) return false;
    try {
        const senderHost = new URL(sender.url).hostname;
        const msgHost = new URL(msg.url).hostname;
        const domains = getHosterDomains();
        const isAllowed = domains.some(d => senderHost === d || senderHost.endsWith('.' + d));
        const urlMatchesSender = domains.some(d => msgHost === d || msgHost.endsWith('.' + d));
        if (!isAllowed || !urlMatchesSender) return false;
    } catch { return false; }
    handleAddPackage(msg, sendResponse);
    return true;
});

// --- Badge + Enhanced Notifications ---

// Processes per-package completions (packages present last tick but gone now).
// Returns analytics data to be batched.
function processCompletions(lastPackages, currentPackages) {
    const historyBatch = [];
    const statIncrements = {};
    const hosterUpdates = [];

    for (const pid of Object.keys(lastPackages)) {
        if (!currentPackages[pid]) {
            const pkg = lastPackages[pid];
            const hoster = extractHoster(pkg.url);
            notify('Yapee', chrome.i18n.getMessage('bgPackageComplete', [pkg.name]), {
                id: `complete-${pid}`
            });
            sendTelegramNotification(pkg.name, chrome.i18n.getMessage('bgPackageComplete', [pkg.name]), 'packageComplete');
            sendDiscordNotification(pkg.name, chrome.i18n.getMessage('bgPackageComplete', [pkg.name]), 'packageComplete');
            sendNtfyNotification(pkg.name, chrome.i18n.getMessage('bgPackageComplete', [pkg.name]), 'packageComplete');
            historyBatch.push({
                timestamp: Date.now(),
                name: pkg.name,
                packageID: pid,
                status: 'completed',
                speed: pkg.speed,
                hoster
            });
            statIncrements.totalDownloads = (statIncrements.totalDownloads || 0) + 1;
            hosterUpdates.push({ hoster, success: true });
        }
    }

    return { historyBatch, statIncrements, hosterUpdates };
}

// Processes error-state files: fires notifications for newly-seen errors and
// prunes fids that are no longer in the active download list.
// Returns analytics data and the updated notifiedErrors set.
function processErrors(errorFids, notifiedErrors, downloads) {
    const historyBatch = [];
    const statIncrements = {};
    const hosterUpdates = [];

    for (const [fid, info] of Object.entries(errorFids)) {
        if (!notifiedErrors.has(fid)) {
            notifiedErrors.add(fid);
            const hoster = extractHoster(info.url);
            notify('Yapee', chrome.i18n.getMessage('bgDownloadFailed', [info.name]), {
                id: `error-${fid}`
            });
            sendTelegramNotification(info.name, chrome.i18n.getMessage('bgDownloadFailed', [info.name]), 'failed');
            sendDiscordNotification(info.name, chrome.i18n.getMessage('bgDownloadFailed', [info.name]), 'failed');
            sendNtfyNotification(info.name, chrome.i18n.getMessage('bgDownloadFailed', [info.name]), 'failed');
            historyBatch.push({
                timestamp: Date.now(),
                name: info.name,
                fid,
                status: 'failed',
                hoster
            });
            statIncrements.totalFailures = (statIncrements.totalFailures || 0) + 1;
            hosterUpdates.push({ hoster, success: false });
        }
    }

    // Prune notifiedErrors: remove fids no longer in active downloads
    const activeFids = new Set(downloads.map(d => String(d.fid)));
    for (const fid of notifiedErrors) {
        if (!activeFids.has(String(fid))) notifiedErrors.delete(fid);
    }

    return { historyBatch, statIncrements, hosterUpdates, updatedNotifiedErrors: notifiedErrors };
}

// Handles exponential-backoff auto-retry for failed downloads.
async function processRetries(errorFids, activeFids) {
    const retryEnabled = await isAutoRetryEnabled();
    if (!retryEnabled) return;

    const retryQueue = await getRetryQueue();
    let changed = false;

    for (const [fid, info] of Object.entries(errorFids)) {
        const entry = retryQueue[fid] || { attempts: 0, nextRetry: 0, backoffMs: INITIAL_RETRY_BACKOFF, name: info.name };
        if (entry.attempts >= MAX_RETRY_ATTEMPTS) continue;
        if (Date.now() < entry.nextRetry) continue;
        const restarted = await restartFile(parseInt(fid, 10));
        if (!restarted) continue;
        entry.attempts++;
        entry.backoffMs = Math.min(entry.backoffMs * 2, MAX_RETRY_BACKOFF);
        entry.nextRetry = Date.now() + entry.backoffMs;
        entry.name = info.name;
        retryQueue[fid] = entry;
        changed = true;
        notify('Yapee', chrome.i18n.getMessage('bgAutoRetried', [info.name]), {
            id: `retry-${fid}`
        });
        sendTelegramNotification(info.name, chrome.i18n.getMessage('bgAutoRetried', [info.name]), 'autoRetry');
        sendDiscordNotification(info.name, chrome.i18n.getMessage('bgAutoRetried', [info.name]), 'autoRetry');
        sendNtfyNotification(info.name, chrome.i18n.getMessage('bgAutoRetried', [info.name]), 'autoRetry');
    }

    for (const fid of Object.keys(retryQueue)) {
        if (!activeFids.has(fid)) {
            delete retryQueue[fid];
            changed = true;
        }
    }

    if (changed) void setRetryQueue(retryQueue);
}

// Updates the extension badge and fires captcha / progress notifications.
async function updateBadgeAndCaptcha(currentCount, downloads, lastCaptcha) {
    const hasCaptcha = await isCaptchaWaiting();

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
        sendTelegramNotification('', chrome.i18n.getMessage('bgCaptchaWaiting'), 'captcha');
        sendDiscordNotification('', chrome.i18n.getMessage('bgCaptchaWaiting'), 'captcha');
        sendNtfyNotification('', chrome.i18n.getMessage('bgCaptchaWaiting'), 'captcha');
    }

    // Progress notification for top 3 active downloads
    if (currentCount > 0) {
        const sorted = downloads.slice().sort((a, b) => (b.speed || 0) - (a.speed || 0));
        const top3 = sorted.slice(0, 3);
        const lines = top3.map(d => {
            const pct = Math.min(100, Math.max(0, Math.round(parseFloat(d.percent) || 0)));
            const speedStr = d.speed > 0 ? ` ${(d.speed / (1000 * 1000)).toFixed(1)} MB/s` : '';
            return `${d.name} — ${pct}%${speedStr}`;
        });
        const message = lines.join('\n');
        const topPct = Math.min(100, Math.max(0, Math.round(parseFloat(top3[0].percent) || 0)));
        const progressOpts = {
            type: 'progress',
            title: 'Yapee',
            message,
            iconUrl: './images/icon.png',
            progress: topPct
        };
        if (typeof chrome.notifications.update === 'function') {
            chrome.notifications.update('downloadProgress', { progress: topPct, message }, (updated) => {
                if (!updated) chrome.notifications.create('downloadProgress', progressOpts);
            });
        } else {
            chrome.notifications.create('downloadProgress', progressOpts);
        }
    } else {
        chrome.notifications.clear('downloadProgress');
    }

    return hasCaptcha;
}

// Main orchestrator for the periodic alarm: fetches download state, fires all
// notifications, updates analytics, and persists session state in one write.
let checkInProgress = false;
async function checkDownloads() {
    if (checkInProgress) return;
    checkInProgress = true;
    try { await doCheckDownloads(); } catch (err) { console.error('checkDownloads:', err); }
    finally { checkInProgress = false; }
}

async function doCheckDownloads() {
    await pullStoredData();

    const downloads = await getStatusDownloads();
    const currentCount = downloads.length;

    // Build current packages map: { pid: { name, percent, speed, url } }
    const currentPackages = {};
    downloads.forEach(d => {
        if (!currentPackages[d.packageID]) {
            currentPackages[d.packageID] = { name: d.name, percent: 0, speed: 0, url: d.url || '' };
        }
        const pkg = currentPackages[d.packageID];
        pkg.percent = Math.max(pkg.percent, parseFloat(d.percent) || 0);
        pkg.speed = Math.max(pkg.speed, d.speed || 0);
        if (!pkg.url && d.url) pkg.url = d.url;
    });

    // Collect fids with error status: { fid: { name, url } }
    const errorFids = {};
    downloads.forEach(d => {
        const s = (d.statusmsg || '').toLowerCase();
        if (s === 'failed' || s === 'aborted' || s === 'offline') {
            errorFids[d.fid] = { name: d.name, url: d.url || '' };
        }
    });

    const data = await chrome.storage.session.get(
        ['lastDownloadCount', 'lastActivePackages', 'lastCaptchaState', 'notifiedErrors']
    );
    const lastCount = data.lastDownloadCount ?? 0;
    const lastPackages = data.lastActivePackages ?? {};
    const lastCaptcha = data.lastCaptchaState ?? false;
    const notifiedErrors = new Set(data.notifiedErrors || []);

    // Feature 1: Per-package completion + history tracking
    const completionResult = processCompletions(lastPackages, currentPackages);

    // "All downloads complete" with clear button (existing)
    if (lastCount > 0 && currentCount === 0) {
        notify('Yapee', chrome.i18n.getMessage('bgDownloadsComplete'), {
            id: 'downloadsComplete',
            buttons: [{ title: chrome.i18n.getMessage('bgClearFinished') || 'Clear finished' }]
        });
        sendTelegramNotification('', chrome.i18n.getMessage('bgDownloadsComplete'), 'allComplete');
        sendDiscordNotification('', chrome.i18n.getMessage('bgDownloadsComplete'), 'allComplete');
        sendNtfyNotification('', chrome.i18n.getMessage('bgDownloadsComplete'), 'allComplete');
    }

    // Feature 2: Error notifications + history tracking
    const errorResult = processErrors(errorFids, notifiedErrors, downloads);

    // Merge analytics from completions and errors
    const historyBatch = [...completionResult.historyBatch, ...errorResult.historyBatch];
    const statIncrements = { ...completionResult.statIncrements };
    for (const [k, v] of Object.entries(errorResult.statIncrements)) {
        statIncrements[k] = (statIncrements[k] ?? 0) + v;
    }
    const hosterUpdates = [...completionResult.hosterUpdates, ...errorResult.hosterUpdates];

    // Track peak speed
    let peakSpeed = 0;
    downloads.forEach(d => {
        if (d.speed > peakSpeed) peakSpeed = d.speed;
    });

    // Single batched write for history + stats (no race conditions)
    addHistoryEntries(historyBatch);
    if (Object.keys(statIncrements).length > 0 || hosterUpdates.length > 0 || peakSpeed > 0) {
        batchUpdateStats(statIncrements, hosterUpdates, peakSpeed);
    }

    // Feature 3: Smart retry — auto-retry failed downloads with exponential backoff
    const activeFids = new Set(downloads.map(d => String(d.fid)));
    await processRetries(errorFids, activeFids);

    // Feature 4: Captcha notification + Badge + Progress notification
    const hasCaptcha = await updateBadgeAndCaptcha(currentCount, downloads, lastCaptcha);

    // Save state (single write)
    await chrome.storage.session.set({
        lastDownloadCount: currentCount,
        lastActivePackages: currentPackages,
        lastCaptchaState: hasCaptcha,
        notifiedErrors: [...errorResult.updatedNotifiedErrors]
    });
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== 'checkDownloads') return;
    checkDownloads();
});

// --- Notification button handler ---

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    if (notificationId === 'downloadsComplete' && buttonIndex === 0) {
        await pullStoredData();
        await deleteFinished();
        chrome.notifications.clear(notificationId);
    }
});

// --- Keyboard shortcuts ---

chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-pause') {
        await pullStoredData();
        togglePause();
    }
});

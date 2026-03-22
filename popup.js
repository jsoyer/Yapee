import { pullStoredData, origin, servers, activeServerId, setActiveServer, getStats, incrementStat } from './js/storage.js';
import {
    isLoggedIn, getLimitSpeedStatus, setLimitSpeedStatus, getMaxSpeed, setMaxSpeed,
    addPackage,
    togglePause, freeSpace, deleteFinished, restartFailed, stopAllDownloads,
    getProxyStatus, toggleProxy, getServerVersion,
    getEvents, addFiles,
    getCaptchaTask, setCaptchaResult,
    uploadContainer
} from './js/pyload-api.js';
import { initLocale, applyI18n, msg } from './js/i18n.js';
import { nameFromUrl, setIcon, formatBytes } from './js/utils.js';
import { POLL_FALLBACK_INTERVAL, MAX_SPEED_INPUT, MAX_CONTAINER_SIZE, SEARCH_DEBOUNCE_MS, CAPTCHA_DANGER_THRESHOLD, FEEDBACK_TIMEOUT } from './js/constants.js';
import { init as initDownloads, updateStatusDownloads } from './js/views/downloads.js';
import { init as initQueue, updateQueueView } from './js/views/queue.js';
import { init as initCollector, updateCollectorView } from './js/views/collector.js';
import { init as initHistory, updateHistoryView, updateStatsDashboard } from './js/views/history.js';

const statusDiv = document.getElementById('status');
const errorLabel = document.getElementById('error');
const successLabel = document.getElementById('success');
const pageDownloadDiv = document.getElementById('pageDownloadDiv');
const optionsButton = document.getElementById('optionsButton');
const limitSpeedButton = document.getElementById('limitSpeedButton');
const proxyButton = document.getElementById('proxyButton');
const externalLinkButton = document.getElementById('externalLinkButton');
const pauseButton = document.getElementById('pauseButton');
const pauseIcon = document.getElementById('pauseIcon');
const captchaAlert = document.getElementById('captchaAlert');
const captchaLink = document.getElementById('captchaLink');
const captchaImage = document.getElementById('captchaImage');
const captchaForm = document.getElementById('captchaForm');
const captchaInput = document.getElementById('captchaInput');
const captchaSubmit = document.getElementById('captchaSubmit');
const multiUrlDiv = document.getElementById('multiUrlDiv');
const multiUrlInput = document.getElementById('multiUrlInput');
const multiUrlButton = document.getElementById('multiUrlButton');
const containerUploadDiv = document.getElementById('containerUploadDiv');
const containerFileInput = document.getElementById('containerFileInput');
const containerUploadButton = document.getElementById('containerUploadButton');
const freeSpaceDiv = document.getElementById('freeSpaceDiv');
const actionButtons = document.getElementById('actionButtons');
const stopAllButton = document.getElementById('stopAllButton');
const restartFailedButton = document.getElementById('restartFailedButton');
const deleteFinishedButton = document.getElementById('deleteFinishedButton');
const viewTabs = document.getElementById('viewTabs');
const downloadsTab = document.getElementById('downloadsTab');
const queueTab = document.getElementById('queueTab');
const collectorTab = document.getElementById('collectorTab');
const serverVersionDiv = document.getElementById('serverVersionDiv');
const serverSelect = document.getElementById('serverSelect');
const searchInput = document.getElementById('searchInput');
const statsDiv = document.getElementById('statsDiv');
const queueEtaSpan = document.getElementById('queueEta');
const maxSpeedInput = document.getElementById('maxSpeedInput');
const batchBar = document.getElementById('batchBar');
const existingPackageSelect = document.getElementById('existingPackageSelect');
const packageNameInput = document.getElementById('packageNameInput');
const historyTab = document.getElementById('historyTab');
const historyDiv = document.getElementById('historyDiv');
const statusFilter = document.getElementById('statusFilter');
const filterBar = document.getElementById('filterBar');
const statsDashboard = document.getElementById('statsDashboard');

let limitSpeedStatus = true;
let proxyStatus = false;
let isPaused = false;
let pollTimeout = null;
let activeView = 'downloads';
let currentCaptchaTask = null;
let searchTerm = '';
let selectedPids = new Set();
let statusFilterValue = '';
let captchaSeenAt = null;
let captchaElapsedTimer = null;
const pollUuid = crypto.randomUUID();

// --- Utility ---

function setButtonLoading(btn, loading) {
    if (loading) {
        btn.dataset.originalText = btn.textContent;
        const spinner = document.createElement('span');
        spinner.className = 'spinner-border spinner-border-sm';
        spinner.setAttribute('role', 'status');
        btn.replaceChildren(spinner);
        btn.disabled = true;
    } else {
        btn.replaceChildren();
        btn.textContent = btn.dataset.originalText || '';
        btn.disabled = false;
    }
}

function setErrorMessage(message) {
    if (!message) { errorLabel.hidden = true; return; }
    errorLabel.innerText = message;
    errorLabel.hidden = false;
}

function setSuccessMessage(message, timeout = FEEDBACK_TIMEOUT) {
    if (!message) { successLabel.hidden = true; return; }
    successLabel.innerText = message;
    successLabel.hidden = false;
    if (timeout > 0) setTimeout(() => setSuccessMessage(''), timeout);
}

// --- Shared UI helpers ---

function updatePauseButton(paused) {
    isPaused = !!paused;
    pauseIcon.className = isPaused ? 'fa fa-play small' : 'fa fa-pause small';
    pauseButton.style.color = isPaused ? 'var(--bs-success)' : '';
    pauseButton.setAttribute('aria-label', isPaused ? msg('ariaResume') : msg('ariaPause'));
    pauseButton.disabled = false;
}

async function updateLimitSpeedStatus() {
    const status = await getLimitSpeedStatus();
    limitSpeedStatus = status;
    limitSpeedButton.style.color = limitSpeedStatus ? '' : 'var(--bs-primary)';
    limitSpeedButton.disabled = false;
    if (limitSpeedStatus) {
        maxSpeedInput.hidden = false;
        const speed = await getMaxSpeed();
        maxSpeedInput.value = speed > 0 ? speed : '';
    } else {
        maxSpeedInput.hidden = true;
    }
}

async function updateProxyStatus() {
    const status = await getProxyStatus();
    proxyStatus = status;
    proxyButton.style.color = proxyStatus ? 'var(--bs-primary)' : '';
    proxyButton.disabled = false;
}

function formatCaptchaElapsed(ms) {
    const totalSec = Math.floor(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}min${sec > 0 ? String(sec).padStart(2, '0') : ''}`;
}

async function updateCaptchaAlert() {
    const task = await getCaptchaTask();
    currentCaptchaTask = task;
    if (!task) {
        captchaAlert.hidden = true;
        captchaImage.hidden = true;
        captchaForm.hidden = true;
        captchaInput.value = '';
        captchaSeenAt = null;
        if (captchaElapsedTimer) { clearInterval(captchaElapsedTimer); captchaElapsedTimer = null; }
        return;
    }
    captchaAlert.hidden = false;
    if (!captchaSeenAt) captchaSeenAt = Date.now();
    if (task.src) {
        captchaImage.src = task.src;
        captchaImage.hidden = false;
        captchaForm.hidden = false;
    }
    if (!captchaElapsedTimer) {
        const timerSpan = document.getElementById('captchaTimer');
        captchaElapsedTimer = setInterval(function() {
            if (!captchaSeenAt) return;
            const elapsed = Date.now() - captchaSeenAt;
            if (timerSpan) timerSpan.textContent = elapsed >= 30000 ? msg('popupCaptchaTimeout', [formatCaptchaElapsed(elapsed)]) : '';
            if (elapsed >= CAPTCHA_DANGER_THRESHOLD) timerSpan.className = 'small text-danger fw-bold';
            else timerSpan.className = 'small text-warning';
        }, 1000);
    }
}

async function updateFreeSpace() {
    const bytes = await freeSpace();
    if (bytes === null || bytes === undefined) return;
    freeSpaceDiv.textContent = msg('popupFreeSpace', [formatBytes(bytes)]);
    freeSpaceDiv.hidden = false;
}

async function updateServerVersion() {
    const version = await getServerVersion();
    if (version === null || version === undefined) return;
    serverVersionDiv.textContent = `PyLoad ${version}`;
    serverVersionDiv.hidden = false;
}

async function updateStats() {
    const stats = await getStats();
    if (!stats.packagesAdded && !stats.totalDownloads) return;
    const parts = [];
    if (stats.packagesAdded) parts.push(msg('popupStats', [String(stats.packagesAdded)]));
    if (stats.totalDownloads) parts.push(msg('popupStatsTotal', [String(stats.totalDownloads), String(stats.totalFailures ?? 0)]));
    statsDiv.textContent = parts.join(' | ');
    statsDiv.hidden = false;
}

// --- View refresh ---

function refreshCurrentView() {
    if (activeView === 'downloads') updateStatusDownloads(searchTerm, statusFilterValue);
    else if (activeView === 'queue') updateQueueView(searchTerm);
    else if (activeView === 'collector') updateCollectorView(searchTerm);
    else if (activeView === 'history') updateHistoryView(searchTerm);
}

// --- Search ---

let searchDebounceTimer = null;
searchInput.oninput = function() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(function() {
        searchTerm = searchInput.value.toLowerCase();
        refreshCurrentView();
    }, SEARCH_DEBOUNCE_MS);
};

statusFilter.onchange = function() {
    statusFilterValue = statusFilter.value;
    if (activeView === 'downloads') updateStatusDownloads(searchTerm, statusFilterValue);
};

// --- Event-driven polling ---

async function startEventLoop() {
    const events = await getEvents(pollUuid);
    if (events === null) {
        pollTimeout = setTimeout(function() {
            if (activeView === 'downloads') updateStatusDownloads(searchTerm, statusFilterValue);
            else if (activeView === 'queue') updateQueueView(searchTerm);
            startEventLoop();
        }, POLL_FALLBACK_INTERVAL);
        return;
    }

    const hasQueueEvent = events.some(e =>
        e.destination === 'queue' || e.event === 'reload'
    );
    const hasCollectorEvent = events.some(e =>
        e.destination === 'collector'
    );

    if (activeView === 'downloads') updateStatusDownloads(searchTerm, statusFilterValue);
    else if (activeView === 'queue' && hasQueueEvent) updateQueueView(searchTerm);
    if (hasCollectorEvent && activeView === 'collector') {
        updateCollectorView(searchTerm);
    }

    pollTimeout = setTimeout(startEventLoop, 1000);
}

// --- Tab switching ---

function switchTab(tab) {
    activeView = tab;
    clearTimeout(pollTimeout);
    pollTimeout = null;
    setErrorMessage('');
    setSuccessMessage('');

    downloadsTab.className = tab === 'downloads' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary';
    queueTab.className = tab === 'queue' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary';
    collectorTab.className = tab === 'collector' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary';
    historyTab.className = tab === 'history' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary';

    statusDiv.hidden = tab !== 'downloads';
    document.getElementById('queueDiv').hidden = tab !== 'queue';
    const queueFilterBar = document.getElementById('queueFilterBar');
    if (queueFilterBar) queueFilterBar.hidden = tab !== 'queue';
    batchBar.hidden = tab !== 'queue';
    document.getElementById('collectorDiv').hidden = tab !== 'collector';
    historyDiv.hidden = tab !== 'history';
    statsDashboard.hidden = tab !== 'history';
    statusFilter.hidden = tab !== 'downloads';
    actionButtons.hidden = (tab !== 'downloads');
    multiUrlDiv.hidden = (tab !== 'downloads' && tab !== 'collector');
    containerUploadDiv.hidden = (tab !== 'collector');
    pageDownloadDiv.hidden = true;
    packageNameInput.hidden = (tab !== 'collector');
    existingPackageSelect.hidden = (tab !== 'collector');
    multiUrlButton.textContent = (tab === 'collector') ? msg('popupAddToCollector') : msg('popupAddAll');
    if (tab !== 'queue') { selectedPids.clear(); }

    if (tab === 'downloads') {
        updateStatusDownloads(searchTerm, statusFilterValue);
        startEventLoop();
    } else if (tab === 'queue') {
        updateQueueView(searchTerm);
        startEventLoop();
    } else if (tab === 'collector') {
        updateCollectorView(searchTerm);
        startEventLoop();
    } else if (tab === 'history') {
        updateHistoryView(searchTerm);
        updateStatsDashboard();
    }
}

// --- Button handlers ---

optionsButton.onclick = () => chrome.tabs.create({ url: '/options.html' });

limitSpeedButton.onclick = async function() {
    limitSpeedStatus = !limitSpeedStatus;
    limitSpeedButton.disabled = true;
    await setLimitSpeedStatus(limitSpeedStatus);
    updateLimitSpeedStatus();
};

maxSpeedInput.onchange = async function() {
    let val = parseInt(maxSpeedInput.value, 10);
    if (isNaN(val)) return;
    val = Math.max(0, Math.min(val, MAX_SPEED_INPUT));
    maxSpeedInput.value = val || '';
    await setMaxSpeed(val);
};

proxyButton.onclick = async function() {
    proxyButton.disabled = true;
    const active = await toggleProxy();
    if (active !== null) {
        proxyStatus = active;
        proxyButton.style.color = proxyStatus ? 'var(--bs-primary)' : '';
    }
    proxyButton.disabled = false;
};

pauseButton.onclick = async function() {
    pauseButton.disabled = true;
    const paused = await togglePause();
    if (paused !== null) updatePauseButton(paused);
    else pauseButton.disabled = false;
};

stopAllButton.onclick = async function() {
    setButtonLoading(stopAllButton, true);
    await stopAllDownloads();
    updateStatusDownloads(searchTerm, statusFilterValue);
    setButtonLoading(stopAllButton, false);
};

restartFailedButton.onclick = async function() {
    setButtonLoading(restartFailedButton, true);
    await restartFailed();
    setSuccessMessage(msg('popupFailedRestarted'));
    setButtonLoading(restartFailedButton, false);
};

deleteFinishedButton.onclick = async function() {
    setButtonLoading(deleteFinishedButton, true);
    const success = await deleteFinished();
    if (success) setSuccessMessage(msg('popupFinishedCleared'));
    updateStatusDownloads(searchTerm, statusFilterValue);
    setButtonLoading(deleteFinishedButton, false);
};

downloadsTab.onclick = () => switchTab('downloads');
queueTab.onclick = () => switchTab('queue');
collectorTab.onclick = () => switchTab('collector');
historyTab.onclick = () => switchTab('history');

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        if (e.key === 'Escape') {
            e.target.blur();
            searchInput.value = '';
            searchTerm = '';
            refreshCurrentView();
        }
        return;
    }
    switch (e.key) {
        case '1': switchTab('downloads'); break;
        case '2': switchTab('queue'); break;
        case '3': switchTab('collector'); break;
        case '4': switchTab('history'); break;
        case '/': e.preventDefault(); searchInput.focus(); break;
    }
});

captchaInput.onkeydown = function(e) {
    if (e.key === 'Enter') captchaSubmit.click();
};

captchaSubmit.onclick = async function() {
    if (!currentCaptchaTask) return;
    const result = captchaInput.value.trim();
    if (!result) return;
    captchaSubmit.disabled = true;
    await setCaptchaResult(currentCaptchaTask.tid, result);
    captchaInput.value = '';
    captchaSubmit.disabled = false;
    currentCaptchaTask = null;
    updateCaptchaAlert();
};

async function handleMultiUrlAdd() {
    const lines = multiUrlInput.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (!lines.length) return;
    setButtonLoading(multiUrlButton, true);

    const targetPid = existingPackageSelect.value;

    // Add to existing package
    if (targetPid !== '') {
        const ok = await addFiles(parseInt(targetPid, 10), lines);
        setButtonLoading(multiUrlButton, false);
        if (ok) {
            multiUrlInput.value = '';
            incrementStat('packagesAdded');
            setSuccessMessage(msg('popupUrlsAdded', [String(lines.length)]));
        } else {
            setErrorMessage(msg('popupUrlsFailed', [String(lines.length)]));
        }
        refreshCurrentView();
        updateStats();
        return;
    }

    // Create new packages (dest=0 for collector, dest=1 for queue)
    const dest = activeView === 'collector' ? 0 : 1;
    const customName = packageNameInput.value.trim();

    function onComplete(success, errorCount) {
        setButtonLoading(multiUrlButton, false);
        if (success) {
            multiUrlInput.value = '';
            packageNameInput.value = '';
            incrementStat('packagesAdded');
            setSuccessMessage(msg('popupUrlsAdded', [String(lines.length)]));
        } else {
            setErrorMessage(msg('popupUrlsFailed', [String(errorCount)]));
        }
        refreshCurrentView();
        updateStats();
    }

    // Custom name: group all URLs into one package
    if (customName) {
        const { success } = await addPackage(customName, lines, dest);
        onComplete(success, success ? 0 : lines.length);
        return;
    }

    // No name: one package per URL with auto-generated name (parallel)
    const results = await Promise.all(lines.map(async function(url) {
        const name = nameFromUrl(url);
        const { success } = await addPackage(name, url, dest);
        return success;
    }));
    const errors = results.filter(function(s) { return !s; }).length;
    onComplete(errors === 0, errors);
}

multiUrlButton.onclick = handleMultiUrlAdd;

containerUploadButton.onclick = async function() {
    const file = containerFileInput.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['dlc', 'ccf', 'rsdf'].includes(ext)) {
        setErrorMessage(msg('popupInvalidFileType'));
        return;
    }
    if (file.size > MAX_CONTAINER_SIZE) {
        setErrorMessage(msg('popupFileTooLarge'));
        return;
    }
    setButtonLoading(containerUploadButton, true);
    const { success, error } = await uploadContainer(file);
    setButtonLoading(containerUploadButton, false);
    if (success) {
        containerFileInput.value = '';
        incrementStat('packagesAdded');
        setSuccessMessage(msg('popupUploadSuccess'));
        refreshCurrentView();
        updateStats();
    } else {
        setErrorMessage(msg('popupUploadError', [error || 'Unknown error']));
    }
};

// --- Init view modules (after switchTab is defined) ---

initDownloads(updateCaptchaAlert);
initQueue(selectedPids, setButtonLoading, setErrorMessage);
initCollector(switchTab);
initHistory();

// --- Init ---

(async function() {
    await pullStoredData();
    await initLocale();
    applyI18n();
    externalLinkButton.onclick = () => chrome.tabs.create({ url: `${origin}/home` });
    captchaLink.onclick = () => chrome.tabs.create({ url: `${origin}/home` });

    const { success: loggedIn, unauthorized, error, response } = await isLoggedIn();
    if (!loggedIn) {
        statusDiv.replaceChildren();
        const wrapper = document.createElement('div');
        wrapper.className = 'text-center m-3';
        const msgDiv = document.createElement('div');
        msgDiv.className = 'text-muted mb-2';
        msgDiv.textContent = error || msg('popupNotLoggedIn');
        wrapper.appendChild(msgDiv);
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-primary';
        btn.textContent = msg('popupGoToOptions');
        btn.onclick = () => chrome.runtime.openOptionsPage();
        wrapper.appendChild(btn);
        statusDiv.appendChild(wrapper);
        return;
    }

    updatePauseButton(response && response.paused);
    updateStatusDownloads(searchTerm, statusFilterValue);
    startEventLoop();
    updateLimitSpeedStatus();
    updateProxyStatus();
    updateFreeSpace();
    updateServerVersion();
    updateStats();
    viewTabs.hidden = false;
    multiUrlDiv.hidden = false;
    filterBar.hidden = false;

    if (servers.length > 1) {
        serverSelect.replaceChildren();
        servers.forEach(function(s) {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            opt.selected = s.id === activeServerId;
            serverSelect.appendChild(opt);
        });
        serverSelect.hidden = false;
        serverSelect.onchange = async function() {
            await setActiveServer(serverSelect.value);
            location.reload();
        };
    }

    const data = await chrome.storage.session.get(['extractedLinks']);
    if (data.extractedLinks?.length > 0) {
        multiUrlInput.value = data.extractedLinks.join('\n');
        chrome.storage.session.remove('extractedLinks');
        setSuccessMessage(msg('popupLinksExtracted', [String(data.extractedLinks.length)]));
    }
})();

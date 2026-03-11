import { pullStoredData, origin } from './js/storage.js';
import {
    isLoggedIn, getStatusDownloads, getLimitSpeedStatus, setLimitSpeedStatus,
    addPackage, checkURL, getQueueData,
    togglePause, freeSpace, deleteFinished, restartFailed, stopAllDownloads, isCaptchaWaiting,
    stopDownload, restartFile, deletePackage, getCollectorData, pushToQueue,
    getProxyStatus, toggleProxy, getServerVersion
} from './js/pyload-api.js';

let statusDiv = document.getElementById('status');
let errorLabel = document.getElementById('error');
let successLabel = document.getElementById('success');
let pageDownloadDiv = document.getElementById('pageDownloadDiv');
let downloadButton = document.getElementById('download');
let downloadLabel = document.getElementById('downloadLabel');
let downloadDiv = document.getElementById('downloadDiv');
let optionsButton = document.getElementById('optionsButton');
let limitSpeedButton = document.getElementById('limitSpeedButton');
let proxyButton = document.getElementById('proxyButton');
let externalLinkButton = document.getElementById('externalLinkButton');
let totalSpeedDiv = document.getElementById('totalSpeed');
let pauseButton = document.getElementById('pauseButton');
let pauseIcon = document.getElementById('pauseIcon');
let captchaAlert = document.getElementById('captchaAlert');
let captchaLink = document.getElementById('captchaLink');
let freeSpaceDiv = document.getElementById('freeSpaceDiv');
let actionButtons = document.getElementById('actionButtons');
let stopAllButton = document.getElementById('stopAllButton');
let restartFailedButton = document.getElementById('restartFailedButton');
let deleteFinishedButton = document.getElementById('deleteFinishedButton');
let viewTabs = document.getElementById('viewTabs');
let downloadsTab = document.getElementById('downloadsTab');
let collectorTab = document.getElementById('collectorTab');
let collectorDiv = document.getElementById('collectorDiv');
let serverVersionDiv = document.getElementById('serverVersionDiv');

let limitSpeedStatus = true;
let proxyStatus = false;
let isPaused = false;
let statusPollTimeout = null;
let activeView = 'downloads';

function formatBytes(bytes) {
    if (bytes == null) return '';
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
    return `${(bytes / 1e3).toFixed(0)} KB`;
}

function updatePauseButton(paused) {
    isPaused = !!paused;
    pauseIcon.className = isPaused ? 'fa fa-play small' : 'fa fa-pause small';
    pauseButton.style.color = isPaused ? '#28a745' : '';
    pauseButton.setAttribute('aria-label', isPaused ? 'Resume downloads' : 'Pause downloads');
    pauseButton.disabled = false;
}

function updateLimitSpeedStatus() {
    getLimitSpeedStatus(function(status) {
        limitSpeedStatus = status;
        limitSpeedButton.style.color = limitSpeedStatus ? 'black' : '#007bff';
        limitSpeedButton.disabled = false;
    });
}

function updateProxyStatus() {
    getProxyStatus(function(status) {
        proxyStatus = status;
        proxyButton.style.color = proxyStatus ? '#007bff' : '';
        proxyButton.disabled = false;
    });
}

function updateCaptchaAlert() {
    isCaptchaWaiting(function(waiting) {
        captchaAlert.hidden = !waiting;
    });
}

function updateFreeSpace() {
    freeSpace(function(bytes) {
        if (bytes == null) return;
        freeSpaceDiv.textContent = `Free space: ${formatBytes(bytes)}`;
        freeSpaceDiv.hidden = false;
    });
}

function updateServerVersion() {
    getServerVersion(function(version) {
        if (version == null) return;
        serverVersionDiv.textContent = `PyLoad ${version}`;
        serverVersionDiv.hidden = false;
    });
}

function buildDownloadItem(download) {
    const pct = Math.min(100, Math.max(0, parseFloat(download.percent) || 0));

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-bottom: 12px; font-size: small';

    const row = document.createElement('div');
    row.className = 'd-flex align-items-center gap-1';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'ellipsis flex-grow-1';
    nameDiv.textContent = download.name;

    const rightDiv = document.createElement('div');
    rightDiv.className = 'd-flex align-items-center gap-1';
    rightDiv.style.whiteSpace = 'nowrap';

    const eta = download.format_eta || '00:00:00';
    const etaSpan = document.createElement('span');
    etaSpan.textContent = `${eta.slice(0, 2)}h${eta.slice(3, 5)}m${eta.slice(6, 8)}`;

    const stopBtn = document.createElement('button');
    stopBtn.className = 'btn btn-sm btn-outline-danger py-0 px-1';
    stopBtn.title = 'Stop';
    stopBtn.innerHTML = '<i class="fa fa-stop"></i>';
    stopBtn.onclick = function() {
        stopBtn.disabled = true;
        stopDownload(download.fid, function() {
            clearTimeout(statusPollTimeout);
            updateStatusDownloads(true);
        });
    };

    const restartBtn = document.createElement('button');
    restartBtn.className = 'btn btn-sm btn-outline-secondary py-0 px-1';
    restartBtn.title = 'Restart';
    restartBtn.innerHTML = '<i class="fa fa-redo"></i>';
    restartBtn.onclick = function() {
        restartBtn.disabled = true;
        restartFile(download.fid, function() {
            clearTimeout(statusPollTimeout);
            updateStatusDownloads(true);
        });
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-outline-danger py-0 px-1';
    delBtn.title = 'Delete package';
    delBtn.innerHTML = '<i class="fa fa-trash"></i>';
    delBtn.onclick = function() {
        delBtn.disabled = true;
        deletePackage(download.packageID, function() {
            clearTimeout(statusPollTimeout);
            updateStatusDownloads(true);
        });
    };

    rightDiv.appendChild(etaSpan);
    rightDiv.appendChild(stopBtn);
    rightDiv.appendChild(restartBtn);
    rightDiv.appendChild(delBtn);
    row.appendChild(nameDiv);
    row.appendChild(rightDiv);

    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress';
    progressContainer.style.cssText = 'margin: 2px 0; height: 16px';

    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar progress-bar-striped progress-bar-animated';
    progressBar.setAttribute('role', 'progressbar');
    progressBar.setAttribute('aria-valuenow', pct);
    progressBar.setAttribute('aria-valuemin', '0');
    progressBar.setAttribute('aria-valuemax', '100');
    progressBar.style.width = `${pct}%`;
    progressBar.textContent = `${pct}%`;

    progressContainer.appendChild(progressBar);
    wrapper.appendChild(row);
    wrapper.appendChild(progressContainer);
    return wrapper;
}

function updateStatusDownloads(loop) {
    getStatusDownloads(function(status) {
        let totalSpeed = 0;
        statusDiv.textContent = '';

        if (status.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'text-center m-4';
            empty.style.color = 'gray';
            empty.textContent = 'No active downloads';
            statusDiv.appendChild(empty);
        } else {
            status.forEach(function(download) {
                totalSpeed += download.speed;
                statusDiv.appendChild(buildDownloadItem(download));
            });
        }

        totalSpeedDiv.textContent = totalSpeed > 0
            ? `- ${(totalSpeed / (1000 * 1000)).toFixed(2)} MB/s`
            : '';
        actionButtons.hidden = false;
        updateCaptchaAlert();
        if (loop) {
            clearTimeout(statusPollTimeout);
            statusPollTimeout = setTimeout(updateStatusDownloads, 3000, true);
        }
    });
}

function updateCollectorView() {
    getCollectorData(function(packages) {
        collectorDiv.textContent = '';

        if (!packages.length) {
            const empty = document.createElement('div');
            empty.className = 'text-center m-4';
            empty.style.color = 'gray';
            empty.textContent = 'Collector is empty';
            collectorDiv.appendChild(empty);
            return;
        }

        packages.forEach(function(pkg) {
            const row = document.createElement('div');
            row.className = 'd-flex align-items-center gap-1';
            row.style.cssText = 'margin-bottom: 8px; font-size: small';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'ellipsis flex-grow-1';
            nameDiv.textContent = pkg.name;

            const countSpan = document.createElement('span');
            countSpan.className = 'text-muted';
            countSpan.style.whiteSpace = 'nowrap';
            const linkCount = pkg.links ? pkg.links.length : 0;
            countSpan.textContent = `${linkCount} link${linkCount !== 1 ? 's' : ''}`;

            const queueBtn = document.createElement('button');
            queueBtn.className = 'btn btn-sm btn-outline-primary py-0 px-1';
            queueBtn.title = 'Add to queue';
            queueBtn.innerHTML = '<i class="fa fa-play"></i>';
            queueBtn.onclick = function() {
                queueBtn.disabled = true;
                pushToQueue(pkg.pid, function() {
                    switchTab('downloads');
                });
            };

            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-sm btn-outline-danger py-0 px-1';
            delBtn.title = 'Delete';
            delBtn.innerHTML = '<i class="fa fa-trash"></i>';
            delBtn.onclick = function() {
                delBtn.disabled = true;
                deletePackage(pkg.pid, function() {
                    updateCollectorView();
                });
            };

            row.appendChild(nameDiv);
            row.appendChild(countSpan);
            row.appendChild(queueBtn);
            row.appendChild(delBtn);
            collectorDiv.appendChild(row);
        });
    });
}

function switchTab(tab) {
    activeView = tab;
    if (tab === 'downloads') {
        downloadsTab.className = 'btn btn-sm btn-primary';
        collectorTab.className = 'btn btn-sm btn-outline-secondary';
        statusDiv.hidden = false;
        collectorDiv.hidden = true;
        clearTimeout(statusPollTimeout);
        updateStatusDownloads(true);
    } else {
        downloadsTab.className = 'btn btn-sm btn-outline-secondary';
        collectorTab.className = 'btn btn-sm btn-primary';
        statusDiv.hidden = true;
        collectorDiv.hidden = false;
        clearTimeout(statusPollTimeout);
        updateCollectorView();
    }
}

function setErrorMessage(message) {
    if (!message) { errorLabel.hidden = true; return; }
    errorLabel.innerText = message;
    errorLabel.hidden = false;
}

function setSuccessMessage(message, timeout = 3000) {
    if (!message) { successLabel.hidden = true; return; }
    successLabel.innerText = message;
    successLabel.hidden = false;
    if (timeout > 0) setTimeout(() => setSuccessMessage(''), timeout);
}

downloadButton.onclick = function() {
    downloadButton.disabled = true;
    chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
        const url = tabs[0].url;
        const name = tabs[0].title;
        addPackage(name, url, function(success, errorMessage) {
            if (!success) {
                setErrorMessage(`Error downloading package: ${errorMessage}`);
                downloadButton.disabled = false;
                return;
            }
            downloadDiv.hidden = true;
            setSuccessMessage('Download added');
            updateStatusDownloads(false);
        });
    });
};

optionsButton.onclick = () => chrome.tabs.create({ url: '/options.html' });

limitSpeedButton.onclick = function() {
    limitSpeedStatus = !limitSpeedStatus;
    limitSpeedButton.disabled = true;
    setLimitSpeedStatus(limitSpeedStatus, () => updateLimitSpeedStatus());
};

proxyButton.onclick = function() {
    proxyButton.disabled = true;
    toggleProxy(function(active) {
        if (active !== null) {
            proxyStatus = active;
            proxyButton.style.color = proxyStatus ? '#007bff' : '';
        }
        proxyButton.disabled = false;
    });
};

pauseButton.onclick = function() {
    pauseButton.disabled = true;
    togglePause(function(paused) {
        if (paused !== null) updatePauseButton(paused);
        else pauseButton.disabled = false;
    });
};

stopAllButton.onclick = function() {
    stopAllButton.disabled = true;
    stopAllDownloads(function() {
        clearTimeout(statusPollTimeout);
        updateStatusDownloads(true);
        stopAllButton.disabled = false;
    });
};

restartFailedButton.onclick = function() {
    restartFailedButton.disabled = true;
    restartFailed(function() {
        setSuccessMessage('Failed downloads restarted');
        restartFailedButton.disabled = false;
    });
};

deleteFinishedButton.onclick = function() {
    deleteFinishedButton.disabled = true;
    deleteFinished(function(success) {
        if (success) setSuccessMessage('Finished downloads cleared');
        clearTimeout(statusPollTimeout);
        updateStatusDownloads(true);
        deleteFinishedButton.disabled = false;
    });
};

downloadsTab.onclick = () => switchTab('downloads');
collectorTab.onclick = () => switchTab('collector');

pullStoredData(function() {
    externalLinkButton.onclick = () => chrome.tabs.create({ url: `${origin}/home` });
    captchaLink.onclick = () => chrome.tabs.create({ url: `${origin}/home` });

    isLoggedIn(function(loggedIn, unauthorized, error, response) {
        if (!loggedIn) {
            setErrorMessage(`You are not logged in, please go to the extension's option page`);
            statusDiv.textContent = '';
            return;
        }

        updatePauseButton(response && response.paused);
        updateStatusDownloads(true);
        updateLimitSpeedStatus();
        updateProxyStatus();
        updateFreeSpace();
        updateServerVersion();
        viewTabs.hidden = false;

        chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
            const url = tabs[0].url;
            const name = tabs[0].title;
            downloadLabel.innerText = name;
            checkURL(url, function(success) {
                if (!success) return;
                getQueueData(function(urls) {
                    pageDownloadDiv.hidden = false;
                    if (urls.includes(url)) {
                        setErrorMessage('Download already in queue');
                        return;
                    }
                    downloadDiv.hidden = false;
                });
            });
        });
    });
});

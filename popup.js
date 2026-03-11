import { pullStoredData, origin } from './js/storage.js';
import {
    isLoggedIn, getStatusDownloads, getLimitSpeedStatus, setLimitSpeedStatus,
    addPackage, checkURL, getQueueData,
    togglePause, freeSpace, deleteFinished, restartFailed, stopAllDownloads, isCaptchaWaiting
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

let limitSpeedStatus = true;
let isPaused = false;
let statusPollTimeout = null;

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
    pauseButton.disabled = false;
}

function updateLimitSpeedStatus() {
    getLimitSpeedStatus(function(status) {
        limitSpeedStatus = status;
        limitSpeedButton.style.color = limitSpeedStatus ? 'black' : '#007bff';
        limitSpeedButton.disabled = false;
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

function updateStatusDownloads(loop) {
    getStatusDownloads(function(status) {
        let html = '';
        let totalSpeed = 0;
        status.forEach(function(download) {
            totalSpeed += download.speed;
            const pct = Math.min(100, Math.max(0, parseFloat(download.percent) || 0));
            html += `
                  <div style="margin-bottom: 12px; font-size: small">
                    <div class="d-flex">
                      <div class="ellipsis" style="padding-right: 24px">
                        ${download.name}
                      </div>
                      <div class="ms-auto">
                        ${download.format_eta.slice(0, 2)}h${download.format_eta.slice(3, 5)}m${download.format_eta.slice(6, 8)}
                      </div>
                    </div>
                    <div class="progress" style="margin: 2px 0 2px 0; height: 16px">
                      <div role="progressbar" class="progress-bar progress-bar-striped progress-bar-animated"
                        aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
                        style="width: ${pct}%;">
                        ${pct}%
                      </div>
                    </div>
                  </div>
                `;
        });
        if (!html) {
            html = `
              <div class="text-center m-4" style="margin-bottom: 12px; color: gray">
                No active downloads
              </div>
            `;
        }
        statusDiv.innerHTML = DOMPurify.sanitize(html);
        totalSpeedDiv.innerHTML = totalSpeed > 0
            ? DOMPurify.sanitize(`- ${(totalSpeed / (1000 * 1000)).toFixed(2)} MB/s`)
            : '';
        actionButtons.hidden = false;
        updateCaptchaAlert();
        if (loop) {
            statusPollTimeout = setTimeout(updateStatusDownloads, 3000, true);
        }
    });
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
        updateFreeSpace();

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

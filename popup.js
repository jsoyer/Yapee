import { pullStoredData, origin, servers, activeServerId, setActiveServer, getStats, incrementStat, getHistory, clearHistory } from './js/storage.js';
import {
    isLoggedIn, getStatusDownloads, getLimitSpeedStatus, setLimitSpeedStatus, getMaxSpeed, setMaxSpeed,
    addPackage, checkURL, getQueueData,
    togglePause, freeSpace, deleteFinished, restartFailed, stopAllDownloads,
    stopDownload, restartFile, restartPackage, deletePackage, deletePackages, getCollectorData, pushToQueue,
    getProxyStatus, toggleProxy, getServerVersion,
    getEvents, getQueuePackages, orderPackage, setPackageData, addFiles,
    getCaptchaTask, setCaptchaResult,
    uploadContainer
} from './js/pyload-api.js';
import { applyI18n, msg } from './js/i18n.js';

function nameFromUrl(url) {
    try {
        const pathname = new URL(url).pathname;
        const segment = decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '');
        const name = segment.replace(/\.[^.]+$/, '');
        if (name.length > 2) return name;
    } catch {}
    return url.split('/').pop() || url;
}

applyI18n();

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
let captchaImage = document.getElementById('captchaImage');
let captchaForm = document.getElementById('captchaForm');
let captchaInput = document.getElementById('captchaInput');
let captchaSubmit = document.getElementById('captchaSubmit');
let multiUrlDiv = document.getElementById('multiUrlDiv');
let multiUrlInput = document.getElementById('multiUrlInput');
let multiUrlButton = document.getElementById('multiUrlButton');
let containerUploadDiv = document.getElementById('containerUploadDiv');
let containerFileInput = document.getElementById('containerFileInput');
let containerUploadButton = document.getElementById('containerUploadButton');
let freeSpaceDiv = document.getElementById('freeSpaceDiv');
let actionButtons = document.getElementById('actionButtons');
let stopAllButton = document.getElementById('stopAllButton');
let restartFailedButton = document.getElementById('restartFailedButton');
let deleteFinishedButton = document.getElementById('deleteFinishedButton');
let viewTabs = document.getElementById('viewTabs');
let downloadsTab = document.getElementById('downloadsTab');
let queueTab = document.getElementById('queueTab');
let collectorTab = document.getElementById('collectorTab');
let queueDiv = document.getElementById('queueDiv');
let collectorDiv = document.getElementById('collectorDiv');
let serverVersionDiv = document.getElementById('serverVersionDiv');
let serverSelect = document.getElementById('serverSelect');
let searchInput = document.getElementById('searchInput');
let statsDiv = document.getElementById('statsDiv');
let queueEtaSpan = document.getElementById('queueEta');
let maxSpeedInput = document.getElementById('maxSpeedInput');
let batchBar = document.getElementById('batchBar');
let selectAllQueue = document.getElementById('selectAllQueue');
let batchCount = document.getElementById('batchCount');
let batchDeleteBtn = document.getElementById('batchDeleteBtn');
let existingPackageSelect = document.getElementById('existingPackageSelect');
let packageNameInput = document.getElementById('packageNameInput');
let historyTab = document.getElementById('historyTab');
let historyDiv = document.getElementById('historyDiv');
let statusFilter = document.getElementById('statusFilter');
let filterBar = document.getElementById('filterBar');
let statsDashboard = document.getElementById('statsDashboard');
let statsSummary = document.getElementById('statsSummary');
let statsHosterTable = document.getElementById('statsHosterTable');
let clearHistoryBtn = document.getElementById('clearHistoryBtn');

let limitSpeedStatus = true;
let proxyStatus = false;
let isPaused = false;
let pollTimeout = null;
let activeView = 'downloads';
let currentCaptchaTask = null;
let searchTerm = '';
let dragSrcIndex = null;
let selectedPids = new Set();
let statusFilterValue = '';
const eventUuid = crypto.randomUUID();

function formatBytes(bytes) {
    if (bytes == null) return '';
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
    return `${(bytes / 1e3).toFixed(0)} KB`;
}

function parseEtaSeconds(eta) {
    if (!eta || eta === '00:00:00') return 0;
    const parts = eta.split(':');
    if (parts.length !== 3) return 0;
    return (parseInt(parts[0], 10) || 0) * 3600
         + (parseInt(parts[1], 10) || 0) * 60
         + (parseInt(parts[2], 10) || 0);
}

function formatEta(totalSeconds) {
    if (!totalSeconds || !isFinite(totalSeconds) || totalSeconds <= 0) return '';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    let label;
    if (hours > 0) label = `${hours}h${String(minutes).padStart(2, '0')}`;
    else if (minutes > 0) label = `${minutes}min`;
    else label = '<1min';
    return msg('popupQueueEta', [label]);
}

function updatePauseButton(paused) {
    isPaused = !!paused;
    pauseIcon.className = isPaused ? 'fa fa-play small' : 'fa fa-pause small';
    pauseButton.style.color = isPaused ? 'var(--bs-success)' : '';
    pauseButton.setAttribute('aria-label', isPaused ? msg('ariaResume') : msg('ariaPause'));
    pauseButton.disabled = false;
}

function updateLimitSpeedStatus() {
    getLimitSpeedStatus(function(status) {
        limitSpeedStatus = status;
        limitSpeedButton.style.color = limitSpeedStatus ? '' : 'var(--bs-primary)';
        limitSpeedButton.disabled = false;
        if (limitSpeedStatus) {
            maxSpeedInput.hidden = false;
            getMaxSpeed(function(speed) {
                maxSpeedInput.value = speed > 0 ? speed : '';
            });
        } else {
            maxSpeedInput.hidden = true;
        }
    });
}

function updateProxyStatus() {
    getProxyStatus(function(status) {
        proxyStatus = status;
        proxyButton.style.color = proxyStatus ? 'var(--bs-primary)' : '';
        proxyButton.disabled = false;
    });
}

function updateCaptchaAlert() {
    getCaptchaTask(function(task) {
        currentCaptchaTask = task;
        if (!task) {
            captchaAlert.hidden = true;
            captchaImage.hidden = true;
            captchaForm.hidden = true;
            captchaInput.value = '';
            return;
        }
        captchaAlert.hidden = false;
        if (task.src) {
            captchaImage.src = task.src;
            captchaImage.hidden = false;
            captchaForm.hidden = false;
        }
    });
}

function updateFreeSpace() {
    freeSpace(function(bytes) {
        if (bytes == null) return;
        freeSpaceDiv.textContent = msg('popupFreeSpace', [formatBytes(bytes)]);
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

function updateStats() {
    getStats(function(stats) {
        if (!stats.packagesAdded && !stats.totalDownloads) return;
        const parts = [];
        if (stats.packagesAdded) parts.push(msg('popupStats', [String(stats.packagesAdded)]));
        if (stats.totalDownloads) parts.push(msg('popupStatsTotal', [String(stats.totalDownloads), String(stats.totalFailures || 0)]));
        statsDiv.textContent = parts.join(' | ');
        statsDiv.hidden = false;
    });
}

// --- Search ---

let searchDebounceTimer = null;
searchInput.oninput = function() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(function() {
        searchTerm = searchInput.value.toLowerCase();
        if (activeView === 'downloads') updateStatusDownloads();
        else if (activeView === 'queue') updateQueueView();
        else if (activeView === 'collector') updateCollectorView();
        else if (activeView === 'history') updateHistoryView();
    }, 300);
};

statusFilter.onchange = function() {
    statusFilterValue = statusFilter.value;
    if (activeView === 'downloads') updateStatusDownloads();
};

// --- Event-driven polling ---

function startEventLoop() {
    getEvents(eventUuid, function(events) {
        if (events === null) {
            pollTimeout = setTimeout(function() {
                if (activeView === 'downloads') updateStatusDownloads();
                else if (activeView === 'queue') updateQueueView();
                startEventLoop();
            }, 3000);
            return;
        }

        const hasQueueEvent = events.some(e =>
            e.destination === 'queue' || e.event === 'reload'
        );
        const hasCollectorEvent = events.some(e =>
            e.destination === 'collector'
        );

        if (activeView === 'downloads') updateStatusDownloads();
        else if (activeView === 'queue' && hasQueueEvent) updateQueueView();
        if (hasCollectorEvent && activeView === 'collector') {
            updateCollectorView();
        }

        pollTimeout = setTimeout(startEventLoop, 1000);
    });
}

// --- Downloads view ---

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
    stopBtn.title = msg('ariaStop');
    stopBtn.setAttribute('aria-label', msg('ariaStop'));
    stopBtn.innerHTML = '<i class="fa fa-stop"></i>';
    stopBtn.onclick = function() {
        stopBtn.disabled = true;
        stopDownload(download.fid, function() { updateStatusDownloads(); });
    };

    const restartBtn = document.createElement('button');
    restartBtn.className = 'btn btn-sm btn-outline-secondary py-0 px-1';
    restartBtn.title = msg('ariaRestart');
    restartBtn.setAttribute('aria-label', msg('ariaRestart'));
    restartBtn.innerHTML = '<i class="fa fa-redo"></i>';
    restartBtn.onclick = function() {
        restartBtn.disabled = true;
        restartFile(download.fid, function() { updateStatusDownloads(); });
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-outline-danger py-0 px-1';
    delBtn.title = msg('ariaDeletePackage');
    delBtn.setAttribute('aria-label', msg('ariaDeletePackage'));
    delBtn.innerHTML = '<i class="fa fa-trash"></i>';
    delBtn.onclick = function() {
        delBtn.disabled = true;
        deletePackage(download.packageID, function() { updateStatusDownloads(); });
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

function updateStatusDownloads() {
    getStatusDownloads(function(status) {
        let totalSpeed = 0;
        statusDiv.textContent = '';

        let filtered = searchTerm
            ? status.filter(d => d.name.toLowerCase().includes(searchTerm))
            : status;
        if (statusFilterValue) {
            filtered = filtered.filter(d => (d.statusmsg || '').toLowerCase() === statusFilterValue);
        }

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'text-center m-4 text-muted';
            empty.textContent = msg('popupNoActiveDownloads');
            statusDiv.appendChild(empty);
        } else {
            filtered.forEach(function(download) {
                totalSpeed += download.speed;
                statusDiv.appendChild(buildDownloadItem(download));
            });
        }

        totalSpeedDiv.textContent = totalSpeed > 0
            ? `- ${(totalSpeed / (1000 * 1000)).toFixed(2)} MB/s`
            : '';

        // Global queue ETA: max of all individual ETAs
        let maxEta = 0;
        status.forEach(function(download) {
            const s = parseEtaSeconds(download.format_eta);
            if (s > maxEta) maxEta = s;
        });
        queueEtaSpan.textContent = totalSpeed > 0 ? formatEta(maxEta) : '';

        if (activeView === 'downloads') actionButtons.hidden = false;
        updateCaptchaAlert();
    });
}

// --- Queue view with drag & drop ---

function buildQueueItem(pkg, index, total) {
    const row = document.createElement('div');
    row.className = 'd-flex align-items-center gap-1';
    row.style.cssText = 'margin-bottom: 8px; font-size: small';
    row.draggable = true;
    row.dataset.index = index;
    row.dataset.pid = pkg.pid;

    row.ondragstart = function(e) {
        dragSrcIndex = index;
        row.classList.add('yape-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    };
    row.ondragend = function() {
        row.classList.remove('yape-dragging');
        dragSrcIndex = null;
        queueDiv.querySelectorAll('.yape-drag-over').forEach(el => el.classList.remove('yape-drag-over'));
    };
    row.ondragover = function(e) {
        e.preventDefault();
        e.dataTransfer.dropMode = 'move';
        queueDiv.querySelectorAll('.yape-drag-over').forEach(el => el.classList.remove('yape-drag-over'));
        if (dragSrcIndex !== index) row.classList.add('yape-drag-over');
    };
    row.ondragleave = function() {
        row.classList.remove('yape-drag-over');
    };
    row.ondrop = function(e) {
        e.preventDefault();
        row.classList.remove('yape-drag-over');
        if (dragSrcIndex === null || dragSrcIndex === index) return;
        orderPackage(pkg.pid, index, function() { updateQueueView(); });
    };

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'form-check-input me-1 flex-shrink-0';
    checkbox.checked = selectedPids.has(pkg.pid);
    checkbox.onchange = function() {
        if (checkbox.checked) selectedPids.add(pkg.pid);
        else selectedPids.delete(pkg.pid);
        updateBatchBar();
    };
    checkbox.onclick = function(e) { e.stopPropagation(); };

    const nameDiv = document.createElement('div');
    nameDiv.className = 'ellipsis flex-grow-1 queue-name';
    nameDiv.textContent = pkg.name;
    nameDiv.title = msg('ariaRenamePackage');

    const editHint = document.createElement('i');
    editHint.className = 'fa fa-pencil-alt edit-hint';
    nameDiv.appendChild(editHint);

    nameDiv.ondblclick = function(e) {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control form-control-sm';
        input.value = pkg.name;
        input.style.cssText = 'font-size: inherit';
        nameDiv.replaceWith(input);
        input.focus();
        input.select();

        const save = function() {
            const newName = input.value.trim();
            if (newName && newName !== pkg.name) {
                setPackageData(pkg.pid, { name: newName }, function(ok) {
                    if (ok) updateQueueView();
                    else { input.replaceWith(nameDiv); setErrorMessage(msg('popupRenameFailed')); }
                });
            } else {
                input.replaceWith(nameDiv);
            }
        };
        input.onblur = save;
        input.onkeydown = function(ev) {
            if (ev.key === 'Enter') { ev.preventDefault(); save(); }
            if (ev.key === 'Escape') input.replaceWith(nameDiv);
        };
    };

    const countSpan = document.createElement('span');
    countSpan.className = 'text-muted';
    countSpan.style.whiteSpace = 'nowrap';
    const linkCount = pkg.links ? pkg.links.length : 0;
    countSpan.textContent = msg('popupLink', [String(linkCount)]);

    const upBtn = document.createElement('button');
    upBtn.className = 'btn btn-sm btn-outline-secondary py-0 px-1';
    upBtn.title = msg('ariaMoveUp');
    upBtn.setAttribute('aria-label', msg('ariaMoveUp'));
    upBtn.innerHTML = '<i class="fa fa-arrow-up"></i>';
    upBtn.disabled = index === 0;
    upBtn.onclick = function() {
        upBtn.disabled = true;
        orderPackage(pkg.pid, index - 1, function() { updateQueueView(); });
    };

    const downBtn = document.createElement('button');
    downBtn.className = 'btn btn-sm btn-outline-secondary py-0 px-1';
    downBtn.title = msg('ariaMoveDown');
    downBtn.setAttribute('aria-label', msg('ariaMoveDown'));
    downBtn.innerHTML = '<i class="fa fa-arrow-down"></i>';
    downBtn.disabled = index === total - 1;
    downBtn.onclick = function() {
        downBtn.disabled = true;
        orderPackage(pkg.pid, index + 1, function() { updateQueueView(); });
    };

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-sm btn-outline-warning py-0 px-1';
    retryBtn.title = msg('ariaRetryPackage');
    retryBtn.setAttribute('aria-label', msg('ariaRetryPackage'));
    retryBtn.innerHTML = '<i class="fa fa-redo"></i>';
    retryBtn.onclick = function() {
        retryBtn.disabled = true;
        restartPackage(pkg.pid, function() { updateQueueView(); });
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-outline-danger py-0 px-1';
    delBtn.title = msg('ariaDeletePackage');
    delBtn.setAttribute('aria-label', msg('ariaDeletePackage'));
    delBtn.innerHTML = '<i class="fa fa-trash"></i>';
    delBtn.onclick = function() {
        delBtn.disabled = true;
        deletePackage(pkg.pid, function() { updateQueueView(); });
    };

    row.appendChild(checkbox);
    row.appendChild(nameDiv);
    row.appendChild(countSpan);
    row.appendChild(upBtn);
    row.appendChild(downBtn);
    row.appendChild(retryBtn);
    row.appendChild(delBtn);
    return row;
}

function updateBatchBar() {
    const count = selectedPids.size;
    batchDeleteBtn.hidden = count === 0;
    batchCount.textContent = count > 0 ? msg('popupBatchSelected', [String(count)]) : '';
    selectAllQueue.indeterminate = false;
    const checkboxes = queueDiv.querySelectorAll('input[type="checkbox"]');
    if (checkboxes.length > 0 && count === checkboxes.length) selectAllQueue.checked = true;
    else if (count === 0) selectAllQueue.checked = false;
    else selectAllQueue.indeterminate = true;
}

selectAllQueue.onchange = function() {
    const checkboxes = queueDiv.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(function(cb) {
        cb.checked = selectAllQueue.checked;
        const pid = parseInt(cb.closest('[data-pid]').dataset.pid, 10);
        if (selectAllQueue.checked) selectedPids.add(pid);
        else selectedPids.delete(pid);
    });
    updateBatchBar();
};

batchDeleteBtn.onclick = function() {
    if (selectedPids.size === 0) return;
    setButtonLoading(batchDeleteBtn, true);
    deletePackages([...selectedPids], function() {
        selectedPids.clear();
        setButtonLoading(batchDeleteBtn, false);
        updateQueueView();
    });
};

function updateQueueView() {
    getQueuePackages(function(packages) {
        queueDiv.textContent = '';

        const filtered = searchTerm
            ? packages.filter(p => p.name.toLowerCase().includes(searchTerm))
            : packages;

        if (!filtered.length) {
            const empty = document.createElement('div');
            empty.className = 'text-center m-4 text-muted';
            empty.textContent = msg('popupQueueEmpty');
            queueDiv.appendChild(empty);
            batchBar.hidden = true;
            return;
        }

        // Prune selectedPids to only include visible packages
        const visiblePids = new Set(filtered.map(p => p.pid));
        for (const pid of selectedPids) {
            if (!visiblePids.has(pid)) selectedPids.delete(pid);
        }

        filtered.forEach(function(pkg, index) {
            queueDiv.appendChild(buildQueueItem(pkg, index, filtered.length));
        });

        batchBar.hidden = false;
        updateBatchBar();

        // Populate existing-package dropdown for add-to-existing feature
        existingPackageSelect.hidden = false;
        const currentVal = existingPackageSelect.value;
        while (existingPackageSelect.options.length > 1) existingPackageSelect.remove(1);
        packages.forEach(function(pkg) {
            const opt = document.createElement('option');
            opt.value = pkg.pid;
            opt.textContent = pkg.name;
            existingPackageSelect.appendChild(opt);
        });
        existingPackageSelect.value = currentVal;
    });
}

// --- Collector view ---

function updateCollectorView() {
    getCollectorData(function(packages) {
        collectorDiv.textContent = '';

        const filtered = searchTerm
            ? packages.filter(p => p.name.toLowerCase().includes(searchTerm))
            : packages;

        if (!filtered.length) {
            const empty = document.createElement('div');
            empty.className = 'text-center m-4 text-muted';
            empty.textContent = msg('popupCollectorEmpty');
            collectorDiv.appendChild(empty);
            return;
        }

        filtered.forEach(function(pkg) {
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
            countSpan.textContent = msg('popupLink', [String(linkCount)]);

            const queueBtn = document.createElement('button');
            queueBtn.className = 'btn btn-sm btn-outline-primary py-0 px-1';
            queueBtn.title = msg('ariaAddToQueue');
            queueBtn.setAttribute('aria-label', msg('ariaAddToQueue'));
            queueBtn.innerHTML = '<i class="fa fa-play"></i>';
            queueBtn.onclick = function() {
                queueBtn.disabled = true;
                pushToQueue(pkg.pid, function() { updateCollectorView(); });
            };

            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-sm btn-outline-danger py-0 px-1';
            delBtn.title = msg('ariaDelete');
            delBtn.setAttribute('aria-label', msg('ariaDelete'));
            delBtn.innerHTML = '<i class="fa fa-trash"></i>';
            delBtn.onclick = function() {
                delBtn.disabled = true;
                deletePackage(pkg.pid, function() { updateCollectorView(); });
            };

            row.appendChild(nameDiv);
            row.appendChild(countSpan);
            row.appendChild(queueBtn);
            row.appendChild(delBtn);
            collectorDiv.appendChild(row);
        });

        if (filtered.length > 1) {
            const btnRow = document.createElement('div');
            btnRow.className = 'd-flex justify-content-center mt-2';
            const pushAllBtn = document.createElement('button');
            pushAllBtn.className = 'btn btn-sm btn-primary';
            pushAllBtn.textContent = msg('popupPushAllToQueue');
            pushAllBtn.onclick = function() {
                pushAllBtn.disabled = true;
                let done = 0;
                filtered.forEach(function(pkg) {
                    pushToQueue(pkg.pid, function() {
                        done++;
                        if (done === filtered.length) switchTab('downloads');
                    });
                });
            };
            btnRow.appendChild(pushAllBtn);
            collectorDiv.appendChild(btnRow);
        }
    });
}

// --- History view ---

function updateHistoryView() {
    getHistory(function(entries) {
        historyDiv.textContent = '';
        const reversed = entries.slice().reverse();
        const filtered = searchTerm
            ? reversed.filter(e => e.name.toLowerCase().includes(searchTerm))
            : reversed;

        if (!filtered.length) {
            const empty = document.createElement('div');
            empty.className = 'text-center m-4 text-muted';
            empty.textContent = msg('popupHistoryEmpty');
            historyDiv.appendChild(empty);
            return;
        }

        filtered.slice(0, 100).forEach(function(entry) {
            const row = document.createElement('div');
            row.className = 'd-flex align-items-center gap-1';
            row.style.cssText = 'margin-bottom: 6px; font-size: small';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'ellipsis flex-grow-1';
            nameDiv.textContent = entry.name;

            const badge = document.createElement('span');
            badge.className = entry.status === 'completed'
                ? 'badge bg-success'
                : 'badge bg-danger';
            badge.textContent = entry.status === 'completed'
                ? msg('popupHistoryCompleted')
                : msg('popupHistoryFailed');

            const speedSpan = document.createElement('span');
            speedSpan.className = 'text-muted';
            speedSpan.style.whiteSpace = 'nowrap';
            if (entry.speedAvg && entry.speedAvg > 0) {
                speedSpan.textContent = `${(entry.speedAvg / (1000 * 1000)).toFixed(1)} MB/s`;
            }

            const timeSpan = document.createElement('span');
            timeSpan.className = 'text-muted';
            timeSpan.style.cssText = 'white-space: nowrap; font-size: 10px';
            if (entry.timestamp) {
                const d = new Date(entry.timestamp);
                timeSpan.textContent = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            }

            row.appendChild(nameDiv);
            row.appendChild(speedSpan);
            row.appendChild(badge);
            row.appendChild(timeSpan);
            historyDiv.appendChild(row);
        });
    });
}

function updateStatsDashboard() {
    getStats(function(stats) {
        const total = stats.totalDownloads || 0;
        const failures = stats.totalFailures || 0;
        const rate = total > 0 ? Math.round(((total - failures) / total) * 100) : 100;
        const peak = stats.peakSpeed || 0;
        const peakStr = peak > 0 ? `${(peak / (1000 * 1000)).toFixed(1)} MB/s` : '-';

        let summary = msg('popupStatsTotal', [String(total), String(failures)]);
        summary += ` (${msg('popupStatsRate', [String(rate)])})`;
        summary += ` | ${msg('popupStatsPeakSpeed', [peakStr])}`;
        statsSummary.textContent = summary;

        const byHoster = stats.byHoster || {};
        const hosters = Object.entries(byHoster).sort((a, b) => b[1].count - a[1].count);
        statsHosterTable.textContent = '';

        if (hosters.length > 0) {
            const table = document.createElement('table');
            table.className = 'table table-sm table-striped mb-0';
            table.style.fontSize = '11px';
            const thead = document.createElement('thead');
            thead.innerHTML = '<tr><th>Hoster</th><th class="text-end">OK</th><th class="text-end">Fail</th></tr>';
            table.appendChild(thead);
            const tbody = document.createElement('tbody');
            hosters.slice(0, 10).forEach(function([hoster, data]) {
                const tr = document.createElement('tr');
                const ok = data.count - data.failures;
                tr.innerHTML = `<td class="ellipsis" style="max-width:180px">${DOMPurify.sanitize(hoster)}</td><td class="text-end">${ok}</td><td class="text-end">${data.failures}</td>`;
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            statsHosterTable.appendChild(table);
        }

        statsDashboard.hidden = false;
    });
}

clearHistoryBtn.onclick = function() {
    clearHistory(function() {
        updateHistoryView();
        updateStatsDashboard();
    });
};

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
    queueDiv.hidden = tab !== 'queue';
    batchBar.hidden = tab !== 'queue';
    collectorDiv.hidden = tab !== 'collector';
    historyDiv.hidden = tab !== 'history';
    statsDashboard.hidden = tab !== 'history';
    statusFilter.hidden = tab !== 'downloads';
    actionButtons.hidden = (tab !== 'downloads');
    multiUrlDiv.hidden = (tab !== 'downloads' && tab !== 'collector');
    containerUploadDiv.hidden = (tab !== 'downloads' && tab !== 'collector');
    pageDownloadDiv.hidden = (tab !== 'downloads');
    existingPackageSelect.hidden = (tab === 'collector') || (tab === 'history');
    multiUrlButton.textContent = (tab === 'collector') ? msg('popupAddToCollector') : msg('popupAddAll');
    if (tab !== 'queue') { selectedPids.clear(); }

    if (tab === 'downloads') {
        updateStatusDownloads();
        startEventLoop();
    } else if (tab === 'queue') {
        updateQueueView();
        startEventLoop();
    } else if (tab === 'collector') {
        updateCollectorView();
        startEventLoop();
    } else if (tab === 'history') {
        updateHistoryView();
        updateStatsDashboard();
    }
}

// --- Utility ---

function setButtonLoading(btn, loading) {
    if (loading) {
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
        btn.disabled = true;
    } else {
        btn.innerHTML = btn.dataset.originalHtml || '';
        btn.disabled = false;
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

// --- Button handlers ---

downloadButton.onclick = function() {
    downloadButton.disabled = true;
    chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
        const url = tabs[0].url;
        const name = tabs[0].title;
        addPackage(name, url, function(success, errorMessage) {
            if (!success) {
                setErrorMessage(msg('popupDownloadError', [errorMessage]));
                downloadButton.disabled = false;
                return;
            }
            downloadDiv.hidden = true;
            incrementStat('packagesAdded');
            setSuccessMessage(msg('popupDownloadAdded'));
            updateStatusDownloads();
            updateStats();
        });
    });
};

optionsButton.onclick = () => chrome.tabs.create({ url: '/options.html' });

limitSpeedButton.onclick = function() {
    limitSpeedStatus = !limitSpeedStatus;
    limitSpeedButton.disabled = true;
    setLimitSpeedStatus(limitSpeedStatus, () => updateLimitSpeedStatus());
};

maxSpeedInput.onchange = function() {
    const val = parseInt(maxSpeedInput.value, 10);
    if (isNaN(val) || val < 0) return;
    setMaxSpeed(val, function() {});
};

proxyButton.onclick = function() {
    proxyButton.disabled = true;
    toggleProxy(function(active) {
        if (active !== null) {
            proxyStatus = active;
            proxyButton.style.color = proxyStatus ? 'var(--bs-primary)' : '';
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
    setButtonLoading(stopAllButton, true);
    stopAllDownloads(function() {
        updateStatusDownloads();
        setButtonLoading(stopAllButton, false);
    });
};

restartFailedButton.onclick = function() {
    setButtonLoading(restartFailedButton, true);
    restartFailed(function() {
        setSuccessMessage(msg('popupFailedRestarted'));
        setButtonLoading(restartFailedButton, false);
    });
};

deleteFinishedButton.onclick = function() {
    setButtonLoading(deleteFinishedButton, true);
    deleteFinished(function(success) {
        if (success) setSuccessMessage(msg('popupFinishedCleared'));
        updateStatusDownloads();
        setButtonLoading(deleteFinishedButton, false);
    });
};

downloadsTab.onclick = () => switchTab('downloads');
queueTab.onclick = () => switchTab('queue');
collectorTab.onclick = () => switchTab('collector');
historyTab.onclick = () => switchTab('history');

captchaInput.onkeydown = function(e) {
    if (e.key === 'Enter') captchaSubmit.click();
};

captchaSubmit.onclick = function() {
    if (!currentCaptchaTask) return;
    const result = captchaInput.value.trim();
    if (!result) return;
    captchaSubmit.disabled = true;
    setCaptchaResult(currentCaptchaTask.tid, result, function() {
        captchaInput.value = '';
        captchaSubmit.disabled = false;
        currentCaptchaTask = null;
        updateCaptchaAlert();
    });
};

multiUrlButton.onclick = function() {
    const lines = multiUrlInput.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (!lines.length) return;
    setButtonLoading(multiUrlButton, true);

    const targetPid = existingPackageSelect.value;

    // Add to existing package
    if (targetPid) {
        addFiles(parseInt(targetPid, 10), lines, function(ok) {
            setButtonLoading(multiUrlButton, false);
            if (ok) {
                multiUrlInput.value = '';
                incrementStat('packagesAdded');
                setSuccessMessage(msg('popupUrlsAdded', [String(lines.length)]));
            } else {
                setErrorMessage(msg('popupUrlsFailed', [String(lines.length)]));
            }
            updateStatusDownloads();
            updateStats();
        });
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
        if (activeView === 'collector') updateCollectorView();
        else { updateStatusDownloads(); }
        updateStats();
    }

    // Custom name: group all URLs into one package
    if (customName) {
        addPackage(customName, lines, function(success) {
            onComplete(success, success ? 0 : lines.length);
        }, dest);
        return;
    }

    // No name: one package per URL with auto-generated name
    let done = 0;
    let errors = 0;
    lines.forEach(function(url) {
        const name = nameFromUrl(url);
        addPackage(name, url, function(success) {
            done++;
            if (!success) errors++;
            if (done === lines.length) {
                onComplete(errors === 0, errors);
            }
        }, dest);
    });
};

containerUploadButton.onclick = function() {
    const file = containerFileInput.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['dlc', 'ccf', 'rsdf'].includes(ext)) {
        setErrorMessage(msg('popupInvalidFileType'));
        return;
    }
    setButtonLoading(containerUploadButton, true);
    uploadContainer(file, function(success, error) {
        setButtonLoading(containerUploadButton, false);
        if (success) {
            containerFileInput.value = '';
            incrementStat('packagesAdded');
            setSuccessMessage(msg('popupUploadSuccess'));
            updateStatusDownloads();
            updateStats();
        } else {
            setErrorMessage(msg('popupUploadError', [error || 'Unknown error']));
        }
    });
};

// --- Init ---

pullStoredData(function() {
    applyI18n();
    externalLinkButton.onclick = () => chrome.tabs.create({ url: `${origin}/home` });
    captchaLink.onclick = () => chrome.tabs.create({ url: `${origin}/home` });

    isLoggedIn(function(loggedIn, unauthorized, error, response) {
        if (!loggedIn) {
            statusDiv.textContent = '';
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
        updateStatusDownloads();
        startEventLoop();
        updateLimitSpeedStatus();
        updateProxyStatus();
        updateFreeSpace();
        updateServerVersion();
        updateStats();
        viewTabs.hidden = false;
        multiUrlDiv.hidden = false;
        containerUploadDiv.hidden = false;
        filterBar.hidden = false;

        if (servers.length > 1) {
            serverSelect.textContent = '';
            servers.forEach(function(s) {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.name;
                opt.selected = s.id === activeServerId;
                serverSelect.appendChild(opt);
            });
            serverSelect.hidden = false;
            serverSelect.onchange = function() {
                setActiveServer(serverSelect.value, () => location.reload());
            };
        }

        // Check for extracted links from link extractor
        chrome.storage.session.get(['extractedLinks'], function(data) {
            if (data.extractedLinks && data.extractedLinks.length > 0) {
                multiUrlInput.value = data.extractedLinks.join('\n');
                chrome.storage.session.remove('extractedLinks');
                setSuccessMessage(msg('popupLinksExtracted', [String(data.extractedLinks.length)]));
            }
        });

        chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
            const url = tabs[0].url;
            const name = tabs[0].title || '';
            downloadLabel.innerText = name;
            checkURL(url, function(success) {
                if (!success) return;
                getQueueData(function(urls) {
                    if (activeView !== 'downloads') return;
                    pageDownloadDiv.hidden = false;
                    if (urls.includes(url)) {
                        setErrorMessage(msg('popupAlreadyInQueue'));
                        return;
                    }
                    downloadDiv.hidden = false;
                });
            });
        });
    });
});

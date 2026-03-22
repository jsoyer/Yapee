import { getStatusDownloads, stopDownload, restartFile, deletePackage } from '../pyload-api.js';
import { msg } from '../i18n.js';
import { setIcon, parseEtaSeconds, formatEta } from '../utils.js';

const statusDiv = document.getElementById('status');
const totalSpeedDiv = document.getElementById('totalSpeed');
const queueEtaSpan = document.getElementById('queueEta');
const actionButtons = document.getElementById('actionButtons');

// Wired via init() — called after each refresh to check for pending captchas
let onCaptchaUpdate = null;

export function init(captchaUpdateCallback) {
    onCaptchaUpdate = captchaUpdateCallback;
}

function buildDownloadItem(download, onRefresh) {
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
    setIcon(stopBtn, 'fa fa-stop');
    stopBtn.onclick = async function() {
        stopBtn.disabled = true;
        await stopDownload(download.fid);
        onRefresh();
    };

    const restartBtn = document.createElement('button');
    restartBtn.className = 'btn btn-sm btn-outline-secondary py-0 px-1';
    restartBtn.title = msg('ariaRestart');
    restartBtn.setAttribute('aria-label', msg('ariaRestart'));
    setIcon(restartBtn, 'fa fa-redo');
    restartBtn.onclick = async function() {
        restartBtn.disabled = true;
        await restartFile(download.fid);
        onRefresh();
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-outline-danger py-0 px-1';
    delBtn.title = msg('ariaDeletePackage');
    delBtn.setAttribute('aria-label', msg('ariaDeletePackage'));
    setIcon(delBtn, 'fa fa-trash');
    delBtn.onclick = async function() {
        delBtn.disabled = true;
        await deletePackage(download.packageID);
        onRefresh();
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

export async function updateStatusDownloads(searchTerm, statusFilterValue) {
    const status = await getStatusDownloads();
    let totalSpeed = 0;
    statusDiv.replaceChildren();

    let filtered = searchTerm
        ? status.filter(d => d.name?.toLowerCase().includes(searchTerm))
        : status;
    if (statusFilterValue) {
        filtered = filtered.filter(d => (d.statusmsg ?? '').toLowerCase() === statusFilterValue);
    }

    if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'text-center m-4 text-muted';
        empty.textContent = msg('popupNoActiveDownloads');
        statusDiv.appendChild(empty);
    } else {
        filtered.forEach(function(download) {
            totalSpeed += download.speed;
            statusDiv.appendChild(buildDownloadItem(download, function() {
                updateStatusDownloads(searchTerm, statusFilterValue);
            }));
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
    queueEtaSpan.textContent = totalSpeed > 0 ? formatEta(maxEta, msg) : '';

    actionButtons.hidden = false;
    if (onCaptchaUpdate) onCaptchaUpdate();
}

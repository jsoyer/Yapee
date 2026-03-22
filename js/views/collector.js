import { getCollectorData, pushToQueue, deletePackage } from '../pyload-api.js';
import { msg } from '../i18n.js';
import { setIcon } from '../utils.js';

const collectorDiv = document.getElementById('collectorDiv');

// switchTab is wired in by popup.js after init
let _switchTab = null;

export function init(switchTab) {
    _switchTab = switchTab;
}

export async function updateCollectorView(searchTerm) {
    const packages = await getCollectorData();
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
        const linkCount = pkg.links?.length ?? 0;
        countSpan.textContent = msg('popupLink', [String(linkCount)]);

        const queueBtn = document.createElement('button');
        queueBtn.className = 'btn btn-sm btn-outline-primary py-0 px-1';
        queueBtn.title = msg('ariaAddToQueue');
        queueBtn.setAttribute('aria-label', msg('ariaAddToQueue'));
        setIcon(queueBtn, 'fa fa-play');
        queueBtn.onclick = async function() {
            queueBtn.disabled = true;
            await pushToQueue(pkg.pid);
            updateCollectorView(searchTerm);
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-sm btn-outline-danger py-0 px-1';
        delBtn.title = msg('ariaDelete');
        delBtn.setAttribute('aria-label', msg('ariaDelete'));
        setIcon(delBtn, 'fa fa-trash');
        delBtn.onclick = async function() {
            delBtn.disabled = true;
            await deletePackage(pkg.pid);
            updateCollectorView(searchTerm);
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
        pushAllBtn.onclick = async function() {
            pushAllBtn.disabled = true;
            await Promise.all(filtered.map(pkg => pushToQueue(pkg.pid)));
            _switchTab('downloads');
        };
        btnRow.appendChild(pushAllBtn);
        collectorDiv.appendChild(btnRow);
    }
}

import { getQueuePackages, orderPackage, setPackageData, restartPackage, restartFile, deletePackage, deletePackages } from '../pyload-api.js';
import { msg } from '../i18n.js';
import { setIcon } from '../utils.js';

const queueDiv = document.getElementById('queueDiv');
const batchBar = document.getElementById('batchBar');
const batchCount = document.getElementById('batchCount');
const batchDeleteBtn = document.getElementById('batchDeleteBtn');
const selectAllQueue = document.getElementById('selectAllQueue');
const existingPackageSelect = document.getElementById('existingPackageSelect');
const queueEtaSpan = document.getElementById('queueEta');

// Module-local drag state
let dragSrcIndex = null;

// Queue status filter: 'all' | 'errors' | 'aborted'
let queueFilter = 'all';

// selectedPids is owned by popup.js; we receive it by reference and mutate it in place
let selectedPids = null;
let setButtonLoading = null;
let setErrorMessage = null;

export function init(pids, buttonLoadingFn, errorMessageFn) {
    selectedPids = pids;
    setButtonLoading = buttonLoadingFn;
    setErrorMessage = errorMessageFn;

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

    batchDeleteBtn.onclick = async function() {
        if (selectedPids.size === 0) return;
        setButtonLoading(batchDeleteBtn, true);
        await deletePackages([...selectedPids]);
        selectedPids.clear();
        setButtonLoading(batchDeleteBtn, false);
        updateQueueView();
    };
}

function statusBadgeClass(status) {
    switch (status) {
        case 'finished': return 'bg-success';
        case 'downloading': return 'bg-primary';
        case 'waiting': case 'queued': return 'bg-secondary';
        case 'failed': case 'offline': return 'bg-danger';
        case 'aborted': return 'bg-warning text-dark';
        default: return 'bg-secondary';
    }
}

function statusLabel(status) {
    const key = {
        finished: 'fileStatusFinished',
        downloading: 'fileStatusDownloading',
        waiting: 'fileStatusWaiting',
        queued: 'fileStatusWaiting',
        failed: 'fileStatusFailed',
        aborted: 'fileStatusAborted',
        offline: 'fileStatusOffline'
    }[status];
    return key ? msg(key) : msg('fileStatusUnknown');
}

function buildFileList(pkg) {
    const container = document.createElement('div');
    container.className = 'queue-file-list';

    const links = pkg.links || [];

    if (!links.length) {
        const empty = document.createElement('div');
        empty.className = 'text-muted';
        empty.style.cssText = 'padding: 4px 0 4px 28px; font-size: 11px';
        empty.textContent = msg('popupNoFiles');
        container.appendChild(empty);
        return container;
    }

    links.forEach(function(link) {
        const row = document.createElement('div');
        row.className = 'd-flex align-items-center gap-1';
        row.style.cssText = 'padding: 2px 0 2px 28px; font-size: 11px';

        const badge = document.createElement('span');
        const status = (link.statusmsg ?? link.status ?? 'unknown').toString().toLowerCase();
        badge.className = 'badge ' + statusBadgeClass(status);
        badge.textContent = statusLabel(status);

        const name = document.createElement('span');
        name.className = 'ellipsis flex-grow-1';
        name.textContent = link.name || 'unknown';

        const size = document.createElement('span');
        size.className = 'text-muted';
        size.style.whiteSpace = 'nowrap';
        if (link.format_size) size.textContent = link.format_size;

        row.appendChild(badge);
        row.appendChild(name);
        row.appendChild(size);

        if (status === 'failed' || status === 'aborted' || status === 'offline') {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'btn btn-sm btn-outline-warning py-0 px-1';
            retryBtn.style.fontSize = '10px';
            setIcon(retryBtn, 'fa fa-redo');
            retryBtn.onclick = async function(e) {
                e.stopPropagation();
                retryBtn.disabled = true;
                await restartFile(link.fid);
                updateQueueView();
            };
            row.appendChild(retryBtn);
        }

        container.appendChild(row);
    });

    return container;
}

function toggleFileList(row, pkg, chevron) {
    const existing = row.nextElementSibling;
    if (existing && existing.classList.contains('queue-file-list')) {
        existing.remove();
        chevron.classList.remove('queue-chevron-open');
        return;
    }
    chevron.classList.add('queue-chevron-open');
    const fileList = buildFileList(pkg);
    row.after(fileList);
}

function clearDragOverStates() {
    queueDiv.querySelectorAll('.yape-drag-over').forEach(el => el.classList.remove('yape-drag-over'));
}

function attachDragHandlers(row, index, pkg) {
    row.ondragstart = function(e) {
        dragSrcIndex = index;
        row.classList.add('yape-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    };
    row.ondragend = function() {
        row.classList.remove('yape-dragging');
        dragSrcIndex = null;
        clearDragOverStates();
    };
    row.ondragover = function(e) {
        e.preventDefault();
        e.dataTransfer.dropMode = 'move';
        clearDragOverStates();
        if (dragSrcIndex !== index) row.classList.add('yape-drag-over');
    };
    row.ondragleave = function() {
        row.classList.remove('yape-drag-over');
    };
    row.ondrop = async function(e) {
        e.preventDefault();
        row.classList.remove('yape-drag-over');
        if (dragSrcIndex === null || dragSrcIndex === index) return;
        await orderPackage(pkg.pid, index);
        updateQueueView();
    };
}

function createRenameableNameDiv(pkg) {
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

        const save = async function() {
            const newName = input.value.trim();
            if (newName && newName !== pkg.name) {
                const ok = await setPackageData(pkg.pid, { name: newName });
                if (ok) updateQueueView();
                else { input.replaceWith(nameDiv); setErrorMessage(msg('popupRenameFailed')); }
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

    return nameDiv;
}

function buildQueueItem(pkg, index, total) {
    const row = document.createElement('div');
    row.className = 'd-flex align-items-center gap-1';
    row.style.cssText = 'margin-bottom: 8px; font-size: small';
    row.draggable = true;
    row.dataset.index = index;
    row.dataset.pid = pkg.pid;

    attachDragHandlers(row, index, pkg);

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

    const chevron = document.createElement('i');
    chevron.className = 'fa fa-chevron-right queue-chevron';

    row.onclick = function(e) {
        if (e.target.closest('button, input, .queue-name')) return;
        toggleFileList(row, pkg, chevron);
    };

    const nameDiv = createRenameableNameDiv(pkg);

    const countSpan = document.createElement('span');
    countSpan.className = 'text-muted';
    countSpan.style.whiteSpace = 'nowrap';
    const linkCount = pkg.links?.length ?? 0;
    countSpan.textContent = msg('popupLink', [String(linkCount)]);

    const upBtn = document.createElement('button');
    upBtn.className = 'btn btn-sm btn-outline-secondary py-0 px-1';
    upBtn.title = msg('ariaMoveUp');
    upBtn.setAttribute('aria-label', msg('ariaMoveUp'));
    setIcon(upBtn, 'fa fa-arrow-up');
    upBtn.disabled = index === 0;
    upBtn.onclick = async function() {
        upBtn.disabled = true;
        await orderPackage(pkg.pid, index - 1);
        updateQueueView();
    };

    const downBtn = document.createElement('button');
    downBtn.className = 'btn btn-sm btn-outline-secondary py-0 px-1';
    downBtn.title = msg('ariaMoveDown');
    downBtn.setAttribute('aria-label', msg('ariaMoveDown'));
    setIcon(downBtn, 'fa fa-arrow-down');
    downBtn.disabled = index === total - 1;
    downBtn.onclick = async function() {
        downBtn.disabled = true;
        await orderPackage(pkg.pid, index + 1);
        updateQueueView();
    };

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-sm btn-outline-warning py-0 px-1';
    retryBtn.title = msg('ariaRetryPackage');
    retryBtn.setAttribute('aria-label', msg('ariaRetryPackage'));
    setIcon(retryBtn, 'fa fa-redo');
    retryBtn.onclick = async function() {
        retryBtn.disabled = true;
        await restartPackage(pkg.pid);
        const aborted = (pkg.links || []).filter(function(link) {
            const s = (link.statusmsg ?? link.status ?? '').toString().toLowerCase();
            return s === 'aborted' || s === '10';
        });
        if (!aborted.length) { updateQueueView(); return; }
        await Promise.all(aborted.map(link => restartFile(link.fid)));
        updateQueueView();
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-outline-danger py-0 px-1';
    delBtn.title = msg('ariaDeletePackage');
    delBtn.setAttribute('aria-label', msg('ariaDeletePackage'));
    setIcon(delBtn, 'fa fa-trash');
    delBtn.onclick = async function() {
        delBtn.disabled = true;
        await deletePackage(pkg.pid);
        updateQueueView();
    };

    row.appendChild(checkbox);
    row.appendChild(chevron);
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

function renderQueueFilterBar() {
    const existing = document.getElementById('queueFilterBar');
    if (existing) {
        // Update active state only
        existing.querySelectorAll('button[data-filter]').forEach(function(btn) {
            btn.className = btn.dataset.filter === queueFilter
                ? 'btn btn-sm btn-primary'
                : 'btn btn-sm btn-outline-secondary';
        });
        return;
    }

    const bar = document.createElement('div');
    bar.id = 'queueFilterBar';
    bar.className = 'd-flex gap-1 mb-2';
    bar.style.fontSize = 'small';

    [
        { key: 'all', label: msg('queueFilterAll') },
        { key: 'errors', label: msg('queueFilterErrors') },
        { key: 'aborted', label: msg('queueFilterAborted') }
    ].forEach(function({ key, label }) {
        const btn = document.createElement('button');
        btn.className = key === queueFilter ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary';
        btn.dataset.filter = key;
        btn.textContent = label;
        btn.onclick = function() {
            queueFilter = key;
            updateQueueView();
        };
        bar.appendChild(btn);
    });

    // Insert the filter bar before queueDiv
    queueDiv.before(bar);
}

export async function updateQueueView(searchTerm) {
    const packages = await getQueuePackages();
    queueDiv.replaceChildren();

    renderQueueFilterBar();

    let filtered = searchTerm
        ? packages.filter(p => p.name.toLowerCase().includes(searchTerm))
        : packages;

    // Apply status filter
    if (queueFilter === 'errors') {
        filtered = filtered.filter(function(pkg) {
            return (pkg.links || []).some(function(link) {
                const s = (link.statusmsg ?? link.status ?? '').toString().toLowerCase();
                return s === 'failed' || s === 'offline';
            });
        });
    } else if (queueFilter === 'aborted') {
        filtered = filtered.filter(function(pkg) {
            return (pkg.links || []).some(function(link) {
                const s = (link.statusmsg ?? link.status ?? '').toString().toLowerCase();
                return s === 'aborted';
            });
        });
    }

    if (!filtered.length) {
        const empty = document.createElement('div');
        empty.className = 'text-center m-4 text-muted';
        empty.textContent = msg('popupQueueEmpty');
        queueDiv.appendChild(empty);
        batchBar.hidden = true;
        if (queueEtaSpan) queueEtaSpan.textContent = '';
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

    // Update queue ETA span with total file count
    if (queueEtaSpan) {
        const totalFiles = filtered.reduce(function(sum, pkg) { return sum + (pkg.links?.length ?? 0); }, 0);
        queueEtaSpan.textContent = totalFiles > 0 ? `${totalFiles} file${totalFiles === 1 ? '' : 's'}` : '';
    }

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
}

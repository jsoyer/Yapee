export function formatBytes(bytes) {
    if (bytes == null) return '';
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
    return `${(bytes / 1e3).toFixed(0)} KB`;
}

export function parseEtaSeconds(eta) {
    if (!eta || eta === '00:00:00') return 0;
    const parts = eta.split(':');
    if (parts.length !== 3) return 0;
    return (parseInt(parts[0], 10) || 0) * 3600
         + (parseInt(parts[1], 10) || 0) * 60
         + (parseInt(parts[2], 10) || 0);
}

export function formatEta(totalSeconds, msgFn) {
    if (!totalSeconds || !isFinite(totalSeconds) || totalSeconds <= 0) return '';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    let label;
    if (hours > 0) label = `${hours}h${String(minutes).padStart(2, '0')}`;
    else if (minutes > 0) label = `${minutes}min`;
    else label = '<1min';
    return msgFn('popupQueueEta', [label]);
}

export function nameFromUrl(url) {
    try {
        const pathname = new URL(url).pathname;
        const segment = decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '');
        const name = segment.replace(/\.[^.]+$/, '');
        if (name.length > 2) return name;
    } catch {}
    return url.split('/').pop() || url;
}

export function setIcon(el, iconClass) {
    el.textContent = '';
    const icon = document.createElement('i');
    icon.className = iconClass;
    el.appendChild(icon);
}

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

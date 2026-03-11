import { origin, setCredentials, getAuthHeaders } from './storage.js';

let serverStatusController = null;

export function abortServerStatus() {
    if (serverStatusController) {
        serverStatusController.abort();
        serverStatusController = null;
    }
}

export async function getServerStatus(callback) {
    serverStatusController = new AbortController();
    const timeoutId = setTimeout(() => serverStatusController.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/statusServer`, {
            method: 'GET',
            redirect: 'error',
            headers: { ...getAuthHeaders() },
            signal: serverStatusController.signal
        });
        clearTimeout(timeoutId);
        serverStatusController = null;
        try {
            if (res.status === 404) { if (callback) callback(false, false, 'Server not found'); return; }
            const response = await res.json();
            if (res.status === 200) { if (callback) callback(true, false, null, response); }
            else if (res.status === 401 || res.status === 403) { if (callback) callback(false, true, 'Unauthorized', response); }
            else if (Object.hasOwn(response, 'error')) { if (callback) callback(false, false, response.error); }
            else { if (callback) callback(false, false, null, response); }
        } catch { if (callback) callback(false, false, 'Server unreachable'); }
    } catch {
        clearTimeout(timeoutId);
        serverStatusController = null;
        if (callback) callback(false, false, 'Server unreachable');
    }
}

export function login(u, p, remember, callback) {
    setCredentials(u, p, remember, () => {
        getServerStatus(function(success, unauthorized, error) {
            if (success) {
                if (callback) callback(true);
            } else if (unauthorized) {
                setCredentials('', '', false, () => {});
                if (callback) callback(false, 'Login failed, invalid credentials');
            } else {
                setCredentials('', '', false, () => {});
                if (callback) callback(false, error || 'Login failed, server unreachable');
            }
        });
    });
}

export async function getStatusDownloads(callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/statusDownloads`, {
            method: 'GET',
            redirect: 'error',
            headers: { ...getAuthHeaders() },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        try {
            const status = await res.json();
            if (callback) callback(status);
        } catch {
            if (callback) callback([]);
        }
    } catch {
        clearTimeout(timeoutId);
        if (callback) callback([]);
    }
}

export async function getQueueData(callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/getQueueData`, {
            method: 'GET',
            redirect: 'error',
            headers: { ...getAuthHeaders() },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        try {
            const queueData = await res.json();
            const urls = [];
            queueData.forEach(pack => {
                pack.links.forEach(link => {
                    urls.push(link.url);
                });
            });
            if (callback) callback(urls);
        } catch {
            if (callback) callback([]);
        }
    } catch {
        clearTimeout(timeoutId);
        if (callback) callback([]);
    }
}

export async function getLimitSpeedStatus(callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/getConfigValue?category="download"&option="limit_speed"`, {
            method: 'GET',
            redirect: 'error',
            headers: { ...getAuthHeaders() },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        try {
            const limitSpeed = (await res.json()).toLowerCase() === 'true';
            if (callback) callback(limitSpeed);
        } catch {
            if (callback) callback(false);
        }
    } catch {
        clearTimeout(timeoutId);
        if (callback) callback(false);
    }
}

export async function setLimitSpeedStatus(limitSpeed, callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/setConfigValue?category="download"&option="limit_speed"&value="${limitSpeed}"`, {
            method: 'GET',
            redirect: 'error',
            headers: { ...getAuthHeaders() },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        try {
            const success = await res.json();
            if (callback) callback(success);
        } catch {
            if (callback) callback(false);
        }
    } catch {
        clearTimeout(timeoutId);
        if (callback) callback(false);
    }
}

export async function addPackage(name, url, callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const safeName = name.replace(/[^a-z0-9._\-]/gi, '_');
    try {
        const res = await fetch(`${origin}/api/addPackage?name="${encodeURIComponent(safeName)}"&links=["${encodeURIComponent(url)}"]`, {
            method: 'GET',
            redirect: 'error',
            headers: { ...getAuthHeaders() },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        try {
            const response = await res.json();
            if (Object.hasOwn(response, 'error')) {
                if (callback) callback(false, response.error);
            } else {
                if (callback) callback(true);
            }
        } catch {
            if (callback) callback(false, 'Invalid server response');
        }
    } catch {
        clearTimeout(timeoutId);
        if (callback) callback(false, 'Invalid server response');
    }
}

export async function togglePause(callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/togglePause`, {
            method: 'GET', redirect: 'error', headers: { ...getAuthHeaders() }, signal: controller.signal
        });
        clearTimeout(timeoutId);
        try { if (callback) callback(await res.json()); } catch { if (callback) callback(null); }
    } catch { clearTimeout(timeoutId); if (callback) callback(null); }
}

export async function freeSpace(callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/freeSpace`, {
            method: 'GET', redirect: 'error', headers: { ...getAuthHeaders() }, signal: controller.signal
        });
        clearTimeout(timeoutId);
        try { if (callback) callback(await res.json()); } catch { if (callback) callback(null); }
    } catch { clearTimeout(timeoutId); if (callback) callback(null); }
}

export async function deleteFinished(callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/deleteFinished`, {
            method: 'GET', redirect: 'error', headers: { ...getAuthHeaders() }, signal: controller.signal
        });
        clearTimeout(timeoutId);
        try { if (callback) callback(true, await res.json()); } catch { if (callback) callback(false); }
    } catch { clearTimeout(timeoutId); if (callback) callback(false); }
}

export async function restartFailed(callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/restartFailed`, {
            method: 'GET', redirect: 'error', headers: { ...getAuthHeaders() }, signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (callback) callback(res.ok);
    } catch { clearTimeout(timeoutId); if (callback) callback(false); }
}

export async function stopAllDownloads(callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/stopAllDownloads`, {
            method: 'GET', redirect: 'error', headers: { ...getAuthHeaders() }, signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (callback) callback(res.ok);
    } catch { clearTimeout(timeoutId); if (callback) callback(false); }
}

export async function isCaptchaWaiting(callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/isCaptchaWaiting`, {
            method: 'GET', redirect: 'error', headers: { ...getAuthHeaders() }, signal: controller.signal
        });
        clearTimeout(timeoutId);
        try { if (callback) callback(!!(await res.json())); } catch { if (callback) callback(false); }
    } catch { clearTimeout(timeoutId); if (callback) callback(false); }
}

export function isLoggedIn(callback) {
    getServerStatus(function(success, unauthorized, error, response) {
        if (callback) callback(success, unauthorized, error, response);
    });
}

export async function checkURL(url, callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/checkURLs?urls=["${encodeURIComponent(url)}"]`, {
            method: 'GET',
            redirect: 'error',
            headers: { ...getAuthHeaders() },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        try {
            const response = await res.json();
            if (callback) callback(!Object.hasOwn(response, 'BasePlugin') && !Object.hasOwn(response, 'error'));
        } catch {
            if (callback) callback(false);
        }
    } catch {
        clearTimeout(timeoutId);
        if (callback) callback(false);
    }
}

export async function stopDownload(fid, callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/stopDownloads?fids=[${fid}]`, {
            method: 'GET', redirect: 'error', headers: { ...getAuthHeaders() }, signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (callback) callback(res.ok);
    } catch { clearTimeout(timeoutId); if (callback) callback(false); }
}

export async function restartFile(fid, callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/restartFile?fid=${fid}`, {
            method: 'GET', redirect: 'error', headers: { ...getAuthHeaders() }, signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (callback) callback(res.ok);
    } catch { clearTimeout(timeoutId); if (callback) callback(false); }
}

export async function deletePackage(pid, callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/deletePackages?pids=[${pid}]`, {
            method: 'GET', redirect: 'error', headers: { ...getAuthHeaders() }, signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (callback) callback(res.ok);
    } catch { clearTimeout(timeoutId); if (callback) callback(false); }
}

export async function getCollectorData(callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/getCollectorData`, {
            method: 'GET', redirect: 'error', headers: { ...getAuthHeaders() }, signal: controller.signal
        });
        clearTimeout(timeoutId);
        try { if (callback) callback(await res.json()); } catch { if (callback) callback([]); }
    } catch { clearTimeout(timeoutId); if (callback) callback([]); }
}

export async function pushToQueue(pid, callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/pushToQueue?package=${pid}`, {
            method: 'GET', redirect: 'error', headers: { ...getAuthHeaders() }, signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (callback) callback(res.ok);
    } catch { clearTimeout(timeoutId); if (callback) callback(false); }
}

export async function getProxyStatus(callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/getConfigValue?category="reconnect"&option="use_proxy"`, {
            method: 'GET', redirect: 'error', headers: { ...getAuthHeaders() }, signal: controller.signal
        });
        clearTimeout(timeoutId);
        try {
            const val = await res.json();
            if (callback) callback(String(val).toLowerCase() === 'true');
        } catch { if (callback) callback(false); }
    } catch { clearTimeout(timeoutId); if (callback) callback(false); }
}

export async function toggleProxy(callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}/api/toggleProxy`, {
            method: 'GET', redirect: 'error', headers: { ...getAuthHeaders() }, signal: controller.signal
        });
        clearTimeout(timeoutId);
        try { if (callback) callback(!!(await res.json())); } catch { if (callback) callback(null); }
    } catch { clearTimeout(timeoutId); if (callback) callback(null); }
}

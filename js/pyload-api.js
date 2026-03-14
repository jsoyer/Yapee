import { origin, setCredentials, getAuthHeaders } from './storage.js';

let serverStatusController = null;

export function abortServerStatus() {
    if (serverStatusController) {
        serverStatusController.abort();
        serverStatusController = null;
    }
}

async function apiFetch(path, onSuccess, onError, method = 'GET') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`${origin}${path}`, {
            method, redirect: 'error', headers: { ...getAuthHeaders() }, signal: controller.signal, credentials: 'omit'
        });
        clearTimeout(timeoutId);
        await onSuccess(res);
    } catch {
        clearTimeout(timeoutId);
        if (onError) onError();
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
            signal: serverStatusController.signal,
            credentials: 'omit'
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
    apiFetch('/api/statusDownloads',
        async res => { callback(await res.json()); },
        () => callback([])
    );
}

export async function getQueueData(callback) {
    apiFetch('/api/getQueueData',
        async res => {
            const queueData = await res.json();
            const urls = [];
            queueData.forEach(pack => {
                pack.links.forEach(link => { urls.push(link.url); });
            });
            callback(urls);
        },
        () => callback([])
    );
}

export async function getLimitSpeedStatus(callback) {
    apiFetch('/api/getConfigValue?category="download"&option="limit_speed"',
        async res => { callback((await res.json()).toLowerCase() === 'true'); },
        () => callback(false)
    );
}

export async function setLimitSpeedStatus(limitSpeed, callback) {
    apiFetch(`/api/setConfigValue?category="download"&option="limit_speed"&value="${limitSpeed}"`,
        async res => { callback(await res.json()); },
        () => callback(false)
    );
}

export async function addPackage(name, url, callback) {
    const safeName = name.replace(/[^a-z0-9._\-]/gi, '_');
    apiFetch(`/api/addPackage?name="${encodeURIComponent(safeName)}"&links=["${encodeURIComponent(url)}"]`,
        async res => {
            const response = await res.json();
            if (Object.hasOwn(response, 'error')) {
                callback(false, response.error);
            } else {
                callback(true);
            }
        },
        () => callback(false, 'Invalid server response')
    );
}

export async function togglePause(callback) {
    apiFetch('/api/togglePause',
        async res => { callback(await res.json()); },
        () => callback(null)
    );
}

export async function freeSpace(callback) {
    apiFetch('/api/freeSpace',
        async res => { callback(await res.json()); },
        () => callback(null)
    );
}

export async function deleteFinished(callback) {
    apiFetch('/api/deleteFinished',
        async res => { callback(true, await res.json()); },
        () => callback(false)
    );
}

export async function restartFailed(callback) {
    apiFetch('/api/restartFailed',
        res => callback(res.ok),
        () => callback(false)
    );
}

export async function stopAllDownloads(callback) {
    apiFetch('/api/stopAllDownloads',
        res => callback(res.ok),
        () => callback(false)
    );
}

export async function isCaptchaWaiting(callback) {
    apiFetch('/api/isCaptchaWaiting',
        async res => { callback(!!(await res.json())); },
        () => callback(false)
    );
}

export function isLoggedIn(callback) {
    getServerStatus(function(success, unauthorized, error, response) {
        if (callback) callback(success, unauthorized, error, response);
    });
}

export async function checkURL(url, callback) {
    apiFetch(`/api/checkURLs?urls=["${encodeURIComponent(url)}"]`,
        async res => {
            const response = await res.json();
            callback(!Object.hasOwn(response, 'BasePlugin') && !Object.hasOwn(response, 'error'));
        },
        () => callback(false),
        'POST'
    );
}

export async function stopDownload(fid, callback) {
    apiFetch(`/api/stopDownloads?fids=[${fid}]`,
        res => callback(res.ok),
        () => callback(false)
    );
}

export async function restartFile(fid, callback) {
    apiFetch(`/api/restartFile?fid=${fid}`,
        res => callback(res.ok),
        () => callback(false)
    );
}

export async function deletePackage(pid, callback) {
    apiFetch(`/api/deletePackages?pids=[${pid}]`,
        res => callback(res.ok),
        () => callback(false)
    );
}

export async function getCollectorData(callback) {
    apiFetch('/api/getCollectorData',
        async res => { callback(await res.json()); },
        () => callback([])
    );
}

export async function pushToQueue(pid, callback) {
    apiFetch(`/api/pushToQueue?package=${pid}`,
        res => callback(res.ok),
        () => callback(false)
    );
}

export async function getProxyStatus(callback) {
    apiFetch('/api/getConfigValue?category="reconnect"&option="use_proxy"',
        async res => {
            const val = await res.json();
            callback(String(val).toLowerCase() === 'true');
        },
        () => callback(false)
    );
}

export async function toggleProxy(callback) {
    apiFetch('/api/toggleProxy',
        async res => { callback(!!(await res.json())); },
        () => callback(null)
    );
}

export async function getServerVersion(callback) {
    apiFetch('/api/getServerVersion',
        async res => { callback(await res.json()); },
        () => callback(null)
    );
}

export async function getEvents(uuid, callback) {
    apiFetch(`/api/getEvents?uuid="${encodeURIComponent(uuid)}"`,
        async res => { callback(await res.json()); },
        () => callback(null)
    );
}

export async function getQueuePackages(callback) {
    apiFetch('/api/getQueueData',
        async res => { callback(await res.json()); },
        () => callback([])
    );
}

export async function orderPackage(pid, position, callback) {
    apiFetch(`/api/orderPackage?pid=${pid}&position=${position}`,
        res => callback(res.ok),
        () => callback(false)
    );
}

export async function getCaptchaTask(callback) {
    apiFetch('/api/getCaptchaTask?exclusive=true',
        async res => {
            const task = await res.json();
            callback(task && task.tid !== -1 ? task : null);
        },
        () => callback(null)
    );
}

export async function setCaptchaResult(tid, result, callback) {
    apiFetch(`/api/setCaptchaResult?tid=${tid}&result="${encodeURIComponent(result)}"`,
        res => callback(res.ok),
        () => callback(false)
    );
}

export async function getAccounts(callback) {
    apiFetch('/api/getAccounts?refresh=false',
        async res => { callback(await res.json()); },
        () => callback({})
    );
}

export async function updateAccount(plugin, login, password, callback) {
    apiFetch(`/api/updateAccount?plugin="${encodeURIComponent(plugin)}"&account="${encodeURIComponent(login)}"&password="${encodeURIComponent(password)}"`,
        res => callback(res.ok),
        () => callback(false)
    );
}

export async function removeAccount(plugin, login, callback) {
    apiFetch(`/api/removeAccount?plugin="${encodeURIComponent(plugin)}"&account="${encodeURIComponent(login)}"`,
        res => callback(res.ok),
        () => callback(false)
    );
}

export async function getLog(offset, callback) {
    apiFetch(`/api/getLog?offset=${offset}`,
        async res => { callback(await res.json()); },
        () => callback([])
    );
}

export async function uploadContainer(file, callback) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
        const content = await file.text();
        const params = new URLSearchParams();
        params.set('filename', file.name);
        params.set('data', content);
        const res = await fetch(`${origin}/api/uploadContainer`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
            signal: controller.signal,
            credentials: 'omit'
        });
        clearTimeout(timeoutId);
        if (res.ok) {
            callback(true);
        } else {
            const text = await res.text().catch(() => 'Server error');
            callback(false, text);
        }
    } catch {
        clearTimeout(timeoutId);
        callback(false, 'Upload failed');
    }
}

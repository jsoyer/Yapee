// Error return convention:
//   list-returning functions  → []
//   object-returning functions → null
//   boolean/success functions  → false
import { origin, setCredentials, getAuthHeaders } from './storage.js';
import { API_TIMEOUT, UPLOAD_TIMEOUT } from './constants.js';

let serverStatusController = null;

export function abortServerStatus() {
    if (serverStatusController) {
        serverStatusController.abort();
        serverStatusController = null;
    }
}

async function apiFetch(path, method = 'GET') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    try {
        const res = await fetch(`${origin}${path}`, {
            method, redirect: 'error', headers: { ...getAuthHeaders() }, signal: controller.signal, credentials: 'omit'
        });
        clearTimeout(timeoutId);
        if (!res.ok) return null;
        return res;
    } catch {
        clearTimeout(timeoutId);
        return null;
    }
}

export async function getServerStatus() {
    serverStatusController = new AbortController();
    const timeoutId = setTimeout(() => serverStatusController.abort(), API_TIMEOUT);
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
            if (res.status === 404) return { success: false, unauthorized: false, error: 'Server not found' };
            const response = await res.json();
            if (res.status === 200) return { success: true, unauthorized: false, error: null, response };
            if (res.status === 401 || res.status === 403) return { success: false, unauthorized: true, error: 'Unauthorized', response };
            if (Object.hasOwn(response, 'error')) return { success: false, unauthorized: false, error: response.error };
            return { success: false, unauthorized: false, error: null, response };
        } catch {
            return { success: false, unauthorized: false, error: 'Server unreachable' };
        }
    } catch {
        clearTimeout(timeoutId);
        serverStatusController = null;
        return { success: false, unauthorized: false, error: 'Server unreachable' };
    }
}

export async function login(u, p, remember) {
    await setCredentials(u, p, remember);
    const result = await getServerStatus();
    if (result.success) {
        return { success: true };
    } else if (result.unauthorized) {
        await setCredentials('', '', false);
        return { success: false, error: 'Login failed, invalid credentials' };
    } else {
        await setCredentials('', '', false);
        return { success: false, error: result.error || 'Login failed, server unreachable' };
    }
}

export async function getStatusDownloads() {
    try {
        const res = await apiFetch('/api/statusDownloads');
        return res ? await res.json() : [];
    } catch {
        return [];
    }
}

export async function getQueueData() {
    try {
        const res = await apiFetch('/api/getQueueData');
        if (!res) return [];
        const queueData = await res.json();
        const urls = [];
        queueData.forEach(pack => {
            pack.links.forEach(link => { urls.push(link.url); });
        });
        return urls;
    } catch {
        return [];
    }
}

export async function getLimitSpeedStatus() {
    try {
        const res = await apiFetch('/api/getConfigValue?category="download"&option="limit_speed"');
        return res ? (await res.json()).toLowerCase() === 'true' : false;
    } catch {
        return false;
    }
}

export async function setLimitSpeedStatus(limitSpeed) {
    try {
        const res = await apiFetch(`/api/setConfigValue?category="download"&option="limit_speed"&value="${limitSpeed}"`);
        return res ? await res.json() : false;
    } catch {
        return false;
    }
}

export async function getMaxSpeed() {
    try {
        const res = await apiFetch('/api/getConfigValue?category="download"&option="max_speed"');
        return res ? (parseInt(await res.json(), 10) || 0) : 0;
    } catch {
        return 0;
    }
}

export async function setMaxSpeed(speed) {
    try {
        const res = await apiFetch(`/api/setConfigValue?category="download"&option="max_speed"&value="${speed}"`);
        return res ? await res.json() : false;
    } catch {
        return false;
    }
}

export async function addPackage(name, urls, dest = 1) {
    const safeName = name.replace(/[^a-z0-9._\-]/gi, '_');
    const linksArray = Array.isArray(urls) ? urls : [urls];
    const linksParam = '[' + linksArray.map(u => `"${encodeURIComponent(u)}"`).join(',') + ']';
    const destParam = dest !== 1 ? `&dest=${dest}` : '';
    try {
        const res = await apiFetch(`/api/addPackage?name="${encodeURIComponent(safeName)}"&links=${linksParam}${destParam}`, 'POST');
        if (!res) return { success: false, error: 'Invalid server response' };
        const response = await res.json();
        if (Object.hasOwn(response, 'error')) {
            return { success: false, error: response.error };
        }
        return { success: true };
    } catch {
        return { success: false, error: 'Invalid server response' };
    }
}

export async function togglePause() {
    try {
        const res = await apiFetch('/api/togglePause');
        return res ? await res.json() : null;
    } catch {
        return null;
    }
}

export async function freeSpace() {
    try {
        const res = await apiFetch('/api/freeSpace');
        return res ? await res.json() : null;
    } catch {
        return null;
    }
}

export async function deleteFinished() {
    try {
        const res = await apiFetch('/api/deleteFinished');
        return !!res;
    } catch {
        return false;
    }
}

export async function restartFailed() {
    try {
        const res = await apiFetch('/api/restartFailed');
        return res ? res.ok : false;
    } catch {
        return false;
    }
}

export async function stopAllDownloads() {
    try {
        const res = await apiFetch('/api/stopAllDownloads');
        return res ? res.ok : false;
    } catch {
        return false;
    }
}

export async function isCaptchaWaiting() {
    try {
        const res = await apiFetch('/api/isCaptchaWaiting');
        return res ? !!(await res.json()) : false;
    } catch {
        return false;
    }
}

export async function isLoggedIn() {
    return await getServerStatus();
}

export async function checkURL(url) {
    try {
        const res = await apiFetch(`/api/checkURLs?urls=["${encodeURIComponent(url)}"]`, 'POST');
        if (!res) return false;
        const response = await res.json();
        return !Object.hasOwn(response, 'BasePlugin') && !Object.hasOwn(response, 'error');
    } catch {
        return false;
    }
}

function safeInt(value) {
    const n = parseInt(value, 10);
    return isNaN(n) ? null : n;
}

export async function stopDownload(fid) {
    const id = safeInt(fid);
    if (id === null) return false;
    try {
        const res = await apiFetch(`/api/stopDownloads?file_ids=[${id}]`, 'POST');
        return res ? res.ok : false;
    } catch {
        return false;
    }
}

export async function restartFile(fid) {
    const id = safeInt(fid);
    if (id === null) return false;
    try {
        const res = await apiFetch(`/api/restartFile?file_id=${id}`);
        return res ? res.ok : false;
    } catch {
        return false;
    }
}

export async function deletePackage(pid) {
    const id = safeInt(pid);
    if (id === null) return false;
    try {
        const res = await apiFetch(`/api/deletePackages?package_ids=[${id}]`, 'POST');
        return res ? res.ok : false;
    } catch {
        return false;
    }
}

export async function deletePackages(pids) {
    const ids = pids.map(safeInt).filter(n => n !== null);
    if (!ids.length) return false;
    try {
        const res = await apiFetch(`/api/deletePackages?package_ids=[${ids.join(',')}]`, 'POST');
        return res ? res.ok : false;
    } catch {
        return false;
    }
}

export async function setPackageData(pid, data) {
    const id = safeInt(pid);
    if (id === null) return false;
    try {
        const res = await apiFetch(`/api/setPackageData?pid=${id}&data=${encodeURIComponent(JSON.stringify(data))}`, 'POST');
        return res ? res.ok : false;
    } catch {
        return false;
    }
}

export async function addFiles(pid, links) {
    const id = safeInt(pid);
    if (id === null) return false;
    try {
        const res = await apiFetch(`/api/addFiles?pid=${id}&links=${encodeURIComponent(JSON.stringify(links))}`, 'POST');
        return res ? res.ok : false;
    } catch {
        return false;
    }
}

export async function restartPackage(pid) {
    const id = safeInt(pid);
    if (id === null) return false;
    try {
        const res = await apiFetch(`/api/restartPackage?pid=${id}`);
        return res ? res.ok : false;
    } catch {
        return false;
    }
}

export async function getCollectorData() {
    try {
        const res = await apiFetch('/api/getCollectorData');
        return res ? await res.json() : [];
    } catch {
        return [];
    }
}

export async function pushToQueue(pid) {
    const id = safeInt(pid);
    if (id === null) return false;
    try {
        const res = await apiFetch(`/api/pushToQueue?package_id=${id}`, 'POST');
        return res ? res.ok : false;
    } catch {
        return false;
    }
}

export async function getProxyStatus() {
    try {
        const res = await apiFetch('/api/getConfigValue?category="reconnect"&option="use_proxy"');
        if (!res) return false;
        const val = await res.json();
        return String(val).toLowerCase() === 'true';
    } catch {
        return false;
    }
}

export async function toggleProxy() {
    try {
        const res = await apiFetch('/api/toggleProxy');
        return res ? !!(await res.json()) : null;
    } catch {
        return null;
    }
}

export async function getServerVersion() {
    try {
        const res = await apiFetch('/api/getServerVersion');
        return res ? await res.json() : null;
    } catch {
        return null;
    }
}

export async function getEvents(uuid) {
    try {
        const res = await apiFetch(`/api/getEvents?uuid="${encodeURIComponent(uuid)}"`);
        return res ? await res.json() : null;
    } catch {
        return null;
    }
}

export async function getQueuePackages() {
    try {
        const res = await apiFetch('/api/getQueueData');
        return res ? await res.json() : [];
    } catch {
        return [];
    }
}

export async function orderPackage(pid, position) {
    const id = safeInt(pid);
    const pos = safeInt(position);
    if (id === null || pos === null) return false;
    try {
        const res = await apiFetch(`/api/orderPackage?package_id=${id}&position=${pos}`);
        return res ? res.ok : false;
    } catch {
        return false;
    }
}

export async function getCaptchaTask() {
    try {
        const res = await apiFetch('/api/getCaptchaTask?exclusive=true');
        if (!res) return null;
        const task = await res.json();
        return task && task.tid !== -1 ? task : null;
    } catch {
        return null;
    }
}

export async function setCaptchaResult(tid, result) {
    const id = safeInt(tid);
    if (id === null) return false;
    try {
        const res = await apiFetch(`/api/setCaptchaResult?tid=${id}&result="${encodeURIComponent(result)}"`);
        return res ? res.ok : false;
    } catch {
        return false;
    }
}

export async function getAccounts(refresh = false) {
    try {
        const res = await apiFetch(`/api/getAccounts?refresh=${refresh}`);
        return res ? await res.json() : {};
    } catch {
        return {};
    }
}

export async function updateAccount(plugin, login, password) {
    try {
        const res = await apiFetch(`/api/updateAccount?plugin="${encodeURIComponent(plugin)}"&account="${encodeURIComponent(login)}"&password="${encodeURIComponent(password)}"`);
        return res ? res.ok : false;
    } catch {
        return false;
    }
}

export async function removeAccount(plugin, login) {
    try {
        const res = await apiFetch(`/api/removeAccount?plugin="${encodeURIComponent(plugin)}"&account="${encodeURIComponent(login)}"`);
        return res ? res.ok : false;
    } catch {
        return false;
    }
}

export async function getLog(offset) {
    const off = safeInt(offset);
    if (off === null) return [];
    try {
        const res = await apiFetch(`/api/getLog?offset=${off}`);
        return res ? await res.json() : [];
    } catch {
        return [];
    }
}

export async function uploadContainer(file) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);
    try {
        // Try the direct API endpoint with Basic Auth
        const formData = new FormData();
        formData.append('filename', file.name);
        formData.append('data', file, file.name);
        const res = await fetch(`${origin}/api/uploadContainer`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData,
            signal: controller.signal,
            credentials: 'omit'
        });
        clearTimeout(timeoutId);
        if (res.ok && !res.redirected) {
            return { success: true };
        }
        const text = await res.text().catch(() => 'Server error');
        return { success: false, error: text || `HTTP ${res.status}` };
    } catch {
        clearTimeout(timeoutId);
        return { success: false, error: 'Upload failed' };
    }
}

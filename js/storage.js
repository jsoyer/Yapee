import { HISTORY_MAX } from './constants.js';

export function buildOrigin(protocol, ip, port, path) {
    const host = ip.includes(':') ? `[${ip}]` : ip;
    let o = `${protocol}://${host}:${port}${path}`;
    return o.endsWith('/') ? o.slice(0, -1) : o;
}

export let serverPort, serverIp, serverProtocol, serverPath, origin;
export let servers = [];
export let activeServerId = null;
let username = '', password = '';

async function getOrCreateCredKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['credKey'], async function(data) {
            if (data.credKey) {
                const raw = Uint8Array.from(atob(data.credKey), c => c.charCodeAt(0));
                const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
                resolve(key);
            } else {
                const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
                const exported = await crypto.subtle.exportKey('raw', key);
                const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
                chrome.storage.local.set({ credKey: b64 }, () => resolve(key));
            }
        });
    });
}

async function encryptCredential(value, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(value);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return btoa(String.fromCharCode(...combined));
}

async function decryptCredential(b64, key) {
    try {
        const combined = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);
        const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return new TextDecoder().decode(plaintext);
    } catch {
        return '';
    }
}

function applyActiveServer() {
    const active = servers.find(s => s.id === activeServerId) || servers[0] || null;
    if (active) {
        serverIp = active.serverIp;
        serverPort = active.serverPort;
        serverProtocol = active.serverProtocol;
        serverPath = active.serverPath;
        origin = buildOrigin(serverProtocol, serverIp, serverPort, serverPath);
    } else {
        serverIp = 'localhost';
        serverPort = 8000;
        serverProtocol = 'http';
        serverPath = '/';
        origin = buildOrigin(serverProtocol, serverIp, serverPort, serverPath);
    }
}

export function pullStoredData(callback) {
    chrome.storage.local.get(['servers', 'activeServerId', 'serverIp', 'serverPort', 'serverPath', 'serverProtocol'], function(data) {
        if (data.servers && data.servers.length > 0) {
            servers = data.servers;
            activeServerId = data.activeServerId || servers[0].id;
        } else if (data.serverIp) {
            const id = crypto.randomUUID();
            servers = [{ id, name: 'Default', serverIp: data.serverIp, serverPort: data.serverPort || 8000, serverProtocol: data.serverProtocol || 'http', serverPath: data.serverPath || '/' }];
            activeServerId = id;
            chrome.storage.local.set({ servers, activeServerId });
        } else {
            servers = [];
            activeServerId = null;
        }

        applyActiveServer();

        const credPrefix = activeServerId ? `creds_${activeServerId}` : 'creds_default';
        chrome.storage.session.get([`${credPrefix}_user`, `${credPrefix}_pass`], function(session) {
            if (session[`${credPrefix}_user`]) {
                username = session[`${credPrefix}_user`];
                password = session[`${credPrefix}_pass`] || '';
                if (callback) callback();
            } else {
                chrome.storage.local.get([`${credPrefix}_user`, `${credPrefix}_pass`, `${credPrefix}_enc`, 'credKey', 'username', 'password', 'credentialsEncrypted'], async function(local) {
                    if (local[`${credPrefix}_enc`] && local[`${credPrefix}_user`]) {
                        const key = await getOrCreateCredKey();
                        username = await decryptCredential(local[`${credPrefix}_user`], key);
                        password = await decryptCredential(local[`${credPrefix}_pass`] || '', key);
                    } else if (local.credentialsEncrypted && local.username) {
                        const key = await getOrCreateCredKey();
                        username = await decryptCredential(local.username, key);
                        password = await decryptCredential(local.password || '', key);
                    } else {
                        username = local.username || '';
                        password = local.password || '';
                    }
                    if (callback) callback();
                });
            }
        });
    });
}

export function setCredentials(u, p, remember, callback) {
    username = u;
    password = p;
    const credPrefix = activeServerId ? `creds_${activeServerId}` : 'creds_default';
    const sessionData = {};
    sessionData[`${credPrefix}_user`] = u;
    sessionData[`${credPrefix}_pass`] = p;
    chrome.storage.session.set(sessionData, async function() {
        if (remember) {
            const key = await getOrCreateCredKey();
            const encUser = await encryptCredential(u, key);
            const encPass = await encryptCredential(p, key);
            const localData = {};
            localData[`${credPrefix}_user`] = encUser;
            localData[`${credPrefix}_pass`] = encPass;
            localData[`${credPrefix}_enc`] = true;
            chrome.storage.local.set(localData, function() {
                if (callback) callback();
            });
        } else {
            chrome.storage.local.remove([`${credPrefix}_user`, `${credPrefix}_pass`, `${credPrefix}_enc`], function() {
                if (callback) callback();
            });
        }
    });
}

export function setOrigin(ip, port, protocol, path, name, callback) {
    const candidate = buildOrigin(protocol, ip, port, path);
    try { new URL(candidate); } catch { if (callback) callback(); return; }
    serverIp = ip;
    serverPort = port;
    serverProtocol = protocol;
    serverPath = path;
    origin = candidate;

    if (activeServerId) {
        const idx = servers.findIndex(s => s.id === activeServerId);
        if (idx !== -1) {
            servers[idx] = { ...servers[idx], serverIp: ip, serverPort: port, serverProtocol: protocol, serverPath: path, name: name || servers[idx].name };
        }
    } else {
        const id = crypto.randomUUID();
        const server = { id, name: name || 'Default', serverIp: ip, serverPort: port, serverProtocol: protocol, serverPath: path };
        servers.push(server);
        activeServerId = id;
    }
    chrome.storage.local.set({ servers, activeServerId }, function() {
        if (callback) callback();
    });
}

export function addServer(config, callback) {
    const id = crypto.randomUUID();
    const server = {
        id,
        name: config.name || 'New server',
        serverIp: config.serverIp || 'localhost',
        serverPort: config.serverPort || 8000,
        serverProtocol: config.serverProtocol || 'http',
        serverPath: config.serverPath || '/'
    };
    servers.push(server);
    chrome.storage.local.set({ servers }, function() {
        if (callback) callback(server);
    });
}

export function removeServer(id, callback) {
    servers = servers.filter(s => s.id !== id);
    if (activeServerId === id) {
        activeServerId = servers[0]?.id || null;
        applyActiveServer();
    }
    chrome.storage.local.set({ servers, activeServerId }, function() {
        if (callback) callback();
    });
}

export function setActiveServer(id, callback) {
    activeServerId = id;
    applyActiveServer();
    chrome.storage.local.set({ activeServerId }, function() {
        if (callback) callback();
    });
}

export function getAuthHeaders() {
    if (!username || !password) return {};
    try {
        return { 'Authorization': 'Basic ' + btoa(`${username}:${password}`) };
    } catch {
        return {};
    }
}

export function incrementStat(key) {
    chrome.storage.local.get(['downloadStats'], function(data) {
        const stats = data.downloadStats || {};
        stats[key] = (stats[key] || 0) + 1;
        chrome.storage.local.set({ downloadStats: stats });
    });
}

export function getStats(callback) {
    chrome.storage.local.get(['downloadStats'], function(data) {
        callback(data.downloadStats || {});
    });
}

// --- Analytics: Download History (circular buffer, max 1000) ---

export function addHistoryEntries(entries, callback) {
    if (!entries.length) { if (callback) callback(); return; }
    chrome.storage.local.get(['downloadHistory'], function(data) {
        const history = data.downloadHistory || [];
        entries.forEach(e => history.push(e));
        if (history.length > HISTORY_MAX) {
            history.splice(0, history.length - HISTORY_MAX);
        }
        chrome.storage.local.set({ downloadHistory: history }, callback);
    });
}

export function getHistory(callback) {
    chrome.storage.local.get(['downloadHistory'], function(data) {
        callback(data.downloadHistory || []);
    });
}

export function clearHistory(callback) {
    chrome.storage.local.remove('downloadHistory', callback);
}

// --- Analytics: Batched Stats Update (single read-modify-write) ---

export function batchUpdateStats(increments, hosterUpdates, peakSpeed, callback) {
    chrome.storage.local.get(['downloadStats'], function(data) {
        const stats = data.downloadStats || {};
        for (const [key, value] of Object.entries(increments)) {
            stats[key] = (stats[key] || 0) + value;
        }
        if (hosterUpdates.length > 0) {
            const byHoster = stats.byHoster || {};
            hosterUpdates.forEach(({ hoster, success }) => {
                const entry = byHoster[hoster] || { count: 0, failures: 0 };
                entry.count++;
                if (!success) entry.failures++;
                byHoster[hoster] = entry;
            });
            stats.byHoster = byHoster;
        }
        if (peakSpeed > (stats.peakSpeed || 0)) {
            stats.peakSpeed = peakSpeed;
        }
        chrome.storage.local.set({ downloadStats: stats }, callback);
    });
}

// --- Analytics: Smart Retry Queue ---

export function getRetryQueue(callback) {
    chrome.storage.local.get(['retryQueue'], function(data) {
        callback(data.retryQueue || {});
    });
}

export function setRetryQueue(queue, callback) {
    chrome.storage.local.set({ retryQueue: queue }, callback);
}

export function isAutoRetryEnabled(callback) {
    chrome.storage.local.get(['autoRetryEnabled'], function(data) {
        callback(data.autoRetryEnabled !== false);
    });
}

export function setAutoRetryEnabled(enabled, callback) {
    chrome.storage.local.set({ autoRetryEnabled: enabled }, callback);
}

// --- Telegram Notification Config ---

const TELEGRAM_DEFAULTS = {
    enabled: false,
    chatId: '',
    events: {
        packageComplete: true,
        allComplete: true,
        failed: true,
        captcha: true,
        autoRetry: false
    }
};

export function getTelegramConfig(callback) {
    chrome.storage.local.get(['telegramConfig'], async function(data) {
        const raw = data.telegramConfig || {};
        let botToken = '';
        if (raw.botTokenEnc) {
            const key = await getOrCreateCredKey();
            botToken = await decryptCredential(raw.botTokenEnc, key);
        }
        callback({
            botToken,
            chatId: raw.chatId || '',
            enabled: raw.enabled || false,
            events: { ...TELEGRAM_DEFAULTS.events, ...raw.events }
        });
    });
}

export function setTelegramConfig(config, callback) {
    getOrCreateCredKey().then(async function(key) {
        const botTokenEnc = config.botToken ? await encryptCredential(config.botToken, key) : '';
        chrome.storage.local.set({
            telegramConfig: {
                botTokenEnc,
                chatId: config.chatId || '',
                enabled: !!config.enabled,
                events: { ...TELEGRAM_DEFAULTS.events, ...config.events }
            }
        }, callback);
    });
}

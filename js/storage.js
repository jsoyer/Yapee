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
    const data = await chrome.storage.local.get(['credKey']);
    if (data.credKey) {
        const raw = Uint8Array.from(atob(data.credKey), c => c.charCodeAt(0));
        return await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    }
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const exported = await crypto.subtle.exportKey('raw', key);
    const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
    await chrome.storage.local.set({ credKey: b64 });
    return key;
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

export async function pullStoredData() {
    const data = await chrome.storage.local.get(['servers', 'activeServerId', 'serverIp', 'serverPort', 'serverPath', 'serverProtocol']);
    if (data.servers && data.servers.length > 0) {
        servers = data.servers;
        activeServerId = data.activeServerId ?? servers[0].id;
    } else if (data.serverIp) {
        const id = crypto.randomUUID();
        servers = [{ id, name: 'Default', serverIp: data.serverIp, serverPort: data.serverPort ?? 8000, serverProtocol: data.serverProtocol ?? 'http', serverPath: data.serverPath ?? '/' }];
        activeServerId = id;
        chrome.storage.local.set({ servers, activeServerId });
    } else {
        servers = [];
        activeServerId = null;
    }

    applyActiveServer();

    const credPrefix = activeServerId ? `creds_${activeServerId}` : 'creds_default';
    const session = await chrome.storage.session.get([`${credPrefix}_user`, `${credPrefix}_pass`]);
    if (session[`${credPrefix}_user`]) {
        username = session[`${credPrefix}_user`];
        password = session[`${credPrefix}_pass`] ?? '';
    } else {
        const local = await chrome.storage.local.get([`${credPrefix}_user`, `${credPrefix}_pass`, `${credPrefix}_enc`, 'credKey', 'username', 'password', 'credentialsEncrypted']);
        if (local[`${credPrefix}_enc`] && local[`${credPrefix}_user`]) {
            const key = await getOrCreateCredKey();
            username = await decryptCredential(local[`${credPrefix}_user`], key);
            password = await decryptCredential(local[`${credPrefix}_pass`] ?? '', key);
        } else if (local.credentialsEncrypted && local.username) {
            const key = await getOrCreateCredKey();
            username = await decryptCredential(local.username, key);
            password = await decryptCredential(local.password ?? '', key);
        } else {
            username = local.username ?? '';
            password = local.password ?? '';
        }
    }
}

export async function setCredentials(u, p, remember) {
    username = u;
    password = p;
    const credPrefix = activeServerId ? `creds_${activeServerId}` : 'creds_default';
    const sessionData = {};
    sessionData[`${credPrefix}_user`] = u;
    sessionData[`${credPrefix}_pass`] = p;
    await chrome.storage.session.set(sessionData);
    if (remember) {
        const key = await getOrCreateCredKey();
        const encUser = await encryptCredential(u, key);
        const encPass = await encryptCredential(p, key);
        const localData = {};
        localData[`${credPrefix}_user`] = encUser;
        localData[`${credPrefix}_pass`] = encPass;
        localData[`${credPrefix}_enc`] = true;
        await chrome.storage.local.set(localData);
    } else {
        await chrome.storage.local.remove([`${credPrefix}_user`, `${credPrefix}_pass`, `${credPrefix}_enc`]);
    }
}

export async function setOrigin(ip, port, protocol, path, name) {
    const candidate = buildOrigin(protocol, ip, port, path);
    try { new URL(candidate); } catch { return; }
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
    await chrome.storage.local.set({ servers, activeServerId });
}

export async function addServer(config) {
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
    await chrome.storage.local.set({ servers });
    return server;
}

export async function removeServer(id) {
    servers = servers.filter(s => s.id !== id);
    if (activeServerId === id) {
        activeServerId = servers[0]?.id || null;
        applyActiveServer();
    }
    await chrome.storage.local.set({ servers, activeServerId });
}

export async function setActiveServer(id) {
    activeServerId = id;
    applyActiveServer();
    await chrome.storage.local.set({ activeServerId });
}

export function getAuthHeaders() {
    if (!username || !password) return {};
    try {
        return { 'Authorization': 'Basic ' + btoa(`${username}:${password}`) };
    } catch {
        return {};
    }
}

export async function incrementStat(key) {
    const data = await chrome.storage.local.get(['downloadStats']);
    const stats = data.downloadStats ?? {};
    stats[key] = (stats[key] ?? 0) + 1;
    await chrome.storage.local.set({ downloadStats: stats });
}

export async function getStats() {
    const data = await chrome.storage.local.get(['downloadStats']);
    return data.downloadStats ?? {};
}

// --- Analytics: Download History (circular buffer, max 1000) ---

export async function addHistoryEntries(entries) {
    if (!entries.length) return;
    const data = await chrome.storage.local.get(['downloadHistory']);
    const history = data.downloadHistory ?? [];
    entries.forEach(e => history.push(e));
    if (history.length > HISTORY_MAX) {
        history.splice(0, history.length - HISTORY_MAX);
    }
    await chrome.storage.local.set({ downloadHistory: history });
}

export async function getHistory() {
    const data = await chrome.storage.local.get(['downloadHistory']);
    return data.downloadHistory ?? [];
}

export async function clearHistory() {
    await chrome.storage.local.remove('downloadHistory');
}

// --- Analytics: Batched Stats Update (single read-modify-write) ---

export async function batchUpdateStats(increments, hosterUpdates, peakSpeed) {
    const data = await chrome.storage.local.get(['downloadStats']);
    const stats = data.downloadStats ?? {};
    for (const [key, value] of Object.entries(increments)) {
        stats[key] = (stats[key] ?? 0) + value;
    }
    if (hosterUpdates.length > 0) {
        const byHoster = stats.byHoster ?? {};
        hosterUpdates.forEach(({ hoster, success }) => {
            const entry = byHoster[hoster] ?? { count: 0, failures: 0 };
            entry.count++;
            if (!success) entry.failures++;
            byHoster[hoster] = entry;
        });
        stats.byHoster = byHoster;
    }
    if (peakSpeed > (stats.peakSpeed ?? 0)) {
        stats.peakSpeed = peakSpeed;
    }
    await chrome.storage.local.set({ downloadStats: stats });
}

// --- Analytics: Smart Retry Queue ---

export async function getRetryQueue() {
    const data = await chrome.storage.local.get(['retryQueue']);
    return data.retryQueue ?? {};
}

export async function setRetryQueue(queue) {
    await chrome.storage.local.set({ retryQueue: queue });
}

export async function isAutoRetryEnabled() {
    const data = await chrome.storage.local.get(['autoRetryEnabled']);
    return data.autoRetryEnabled !== false;
}

export async function setAutoRetryEnabled(enabled) {
    await chrome.storage.local.set({ autoRetryEnabled: enabled });
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

export async function getTelegramConfig() {
    const data = await chrome.storage.local.get(['telegramConfig']);
    const raw = data.telegramConfig ?? {};
    let botToken = '';
    if (raw.botTokenEnc) {
        const key = await getOrCreateCredKey();
        botToken = await decryptCredential(raw.botTokenEnc, key);
    }
    return {
        botToken,
        chatId: raw.chatId ?? '',
        enabled: raw.enabled ?? false,
        events: { ...TELEGRAM_DEFAULTS.events, ...raw.events }
    };
}

export async function setTelegramConfig(config) {
    const key = await getOrCreateCredKey();
    const botTokenEnc = config.botToken ? await encryptCredential(config.botToken, key) : '';
    await chrome.storage.local.set({
        telegramConfig: {
            botTokenEnc,
            chatId: config.chatId ?? '',
            enabled: !!config.enabled,
            events: { ...TELEGRAM_DEFAULTS.events, ...config.events }
        }
    });
}

// --- Discord Notification Config ---

const DISCORD_DEFAULTS = {
    enabled: false,
    webhookUrl: '',
    events: {
        packageComplete: true,
        allComplete: true,
        failed: true,
        captcha: true,
        autoRetry: false
    }
};

export async function getDiscordConfig() {
    const data = await chrome.storage.local.get(['discordConfig']);
    const raw = data.discordConfig ?? {};
    return {
        webhookUrl: raw.webhookUrl ?? '',
        enabled: raw.enabled ?? false,
        events: { ...DISCORD_DEFAULTS.events, ...raw.events }
    };
}

export async function setDiscordConfig(config) {
    await chrome.storage.local.set({
        discordConfig: {
            webhookUrl: config.webhookUrl ?? '',
            enabled: !!config.enabled,
            events: { ...DISCORD_DEFAULTS.events, ...config.events }
        }
    });
}

// --- ntfy Notification Config ---

const NTFY_DEFAULTS = {
    enabled: false,
    serverUrl: 'https://ntfy.sh',
    topic: '',
    events: {
        packageComplete: true,
        allComplete: true,
        failed: true,
        captcha: true,
        autoRetry: false
    }
};

export async function getNtfyConfig() {
    const data = await chrome.storage.local.get(['ntfyConfig']);
    const raw = data.ntfyConfig ?? {};
    return {
        serverUrl: raw.serverUrl ?? 'https://ntfy.sh',
        topic: raw.topic ?? '',
        enabled: raw.enabled ?? false,
        events: { ...NTFY_DEFAULTS.events, ...raw.events }
    };
}

export async function setNtfyConfig(config) {
    await chrome.storage.local.set({
        ntfyConfig: {
            serverUrl: config.serverUrl ?? 'https://ntfy.sh',
            topic: config.topic ?? '',
            enabled: !!config.enabled,
            events: { ...NTFY_DEFAULTS.events, ...config.events }
        }
    });
}

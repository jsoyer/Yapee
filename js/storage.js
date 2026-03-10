export function buildOrigin(protocol, ip, port, path) {
    const host = ip.includes(':') ? `[${ip}]` : ip;
    let o = `${protocol}://${host}:${port}${path}`;
    return o.endsWith('/') ? o.slice(0, -1) : o;
}

export let serverPort, serverIp, serverProtocol, serverPath, origin;
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

export function pullStoredData(callback) {
    chrome.storage.local.get(['serverIp', 'serverPort', 'serverPath', 'serverProtocol'], function(data) {
        serverIp = data.serverIp || '172.0.0.1';
        serverPort = data.serverPort || 8001;
        serverPath = data.serverPath || '/';
        serverProtocol = data.serverProtocol || 'https';
        origin = buildOrigin(serverProtocol, serverIp, serverPort, serverPath);
        chrome.storage.session.get(['username', 'password'], function(session) {
            if (session.username) {
                username = session.username;
                password = session.password;
                if (callback) callback(data);
            } else {
                chrome.storage.local.get(['username', 'password', 'credentialsEncrypted'], async function(local) {
                    if (local.credentialsEncrypted && local.username) {
                        const key = await getOrCreateCredKey();
                        username = await decryptCredential(local.username, key);
                        password = await decryptCredential(local.password || '', key);
                    } else {
                        username = local.username || '';
                        password = local.password || '';
                    }
                    if (callback) callback(data);
                });
            }
        });
    });
}

export function setCredentials(u, p, remember, callback) {
    username = u;
    password = p;
    chrome.storage.session.set({ username, password }, async function() {
        if (remember) {
            const key = await getOrCreateCredKey();
            const encUser = await encryptCredential(u, key);
            const encPass = await encryptCredential(p, key);
            chrome.storage.local.set({ username: encUser, password: encPass, credentialsEncrypted: true }, function() {
                if (callback) callback();
            });
        } else {
            chrome.storage.local.remove(['username', 'password', 'credentialsEncrypted'], function() {
                if (callback) callback();
            });
        }
    });
}

export function setOrigin(ip, port, protocol, path, callback) {
    const candidate = buildOrigin(protocol, ip, port, path);
    try { new URL(candidate); } catch { if (callback) callback(); return; }
    serverIp = ip;
    serverPort = port;
    serverProtocol = protocol;
    serverPath = path;
    origin = candidate;
    chrome.storage.local.set({
        serverIp: serverIp,
        serverPort: serverPort,
        serverProtocol: serverProtocol,
        serverPath: serverPath
    }, function () {
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

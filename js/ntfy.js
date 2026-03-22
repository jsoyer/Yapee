import { getNtfyConfig } from './storage.js';
import { TELEGRAM_TIMEOUT, MIN_SEND_INTERVAL } from './constants.js';

let lastSentTime = 0;
const sendQueue = [];
let processing = false;

async function doSend(serverUrl, topic, title, message) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT);
    try {
        const res = await fetch(`${serverUrl}/${topic}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, title, message, tags: ['package'] }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return res.ok;
    } catch {
        clearTimeout(timeoutId);
        return false;
    }
}

function processQueue() {
    if (processing || !sendQueue.length) return;
    processing = true;
    const now = Date.now();
    const wait = Math.max(0, MIN_SEND_INTERVAL - (now - lastSentTime));
    setTimeout(async () => {
        const item = sendQueue.shift();
        if (item) {
            lastSentTime = Date.now();
            await doSend(item.serverUrl, item.topic, item.title, item.message);
        }
        processing = false;
        if (sendQueue.length) processQueue();
    }, wait);
}

export async function sendNtfyNotification(title, message, eventType) {
    const config = await getNtfyConfig();
    if (!config.enabled || !config.topic) return;
    if (!config.events[eventType]) return;

    const serverUrl = config.serverUrl || 'https://ntfy.sh';
    const notifTitle = title && title !== 'Yapee' ? `Yapee — ${title}` : 'Yapee';

    if (sendQueue.length >= 50) sendQueue.shift();
    sendQueue.push({ serverUrl, topic: config.topic, title: notifTitle, message: message || '' });
    processQueue();
}

export async function testNtfyConfig(serverUrl, topic) {
    if (!topic) {
        return { ok: false, error: 'Missing topic' };
    }
    const url = serverUrl || 'https://ntfy.sh';
    try {
        new URL(`${url}/${topic}`);
    } catch {
        return { ok: false, error: 'Invalid server URL' };
    }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT);
        const res = await fetch(`${url}/${topic}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, title: 'Yapee', message: 'Test notification', tags: ['package'] }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
            return { ok: false, error: `HTTP ${res.status}` };
        }
        return { ok: true };
    } catch {
        return { ok: false, error: 'Network error' };
    }
}

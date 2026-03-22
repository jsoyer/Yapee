import { getDiscordConfig } from './storage.js';
import { TELEGRAM_TIMEOUT, MIN_SEND_INTERVAL } from './constants.js';

let lastSentTime = 0;
const sendQueue = [];
let processing = false;

async function doSend(webhookUrl, content) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT);
    try {
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
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
            await doSend(item.webhookUrl, item.content);
        }
        processing = false;
        if (sendQueue.length) processQueue();
    }, wait);
}

export async function sendDiscordNotification(title, message, eventType) {
    const config = await getDiscordConfig();
    if (!config.enabled || !config.webhookUrl) return;
    if (!config.events[eventType]) return;

    const parts = ['**Yapee**'];
    if (title && title !== 'Yapee') parts.push(title);
    if (message) parts.push(message);
    const content = parts.join('\n');

    if (sendQueue.length >= 50) sendQueue.shift();
    sendQueue.push({ webhookUrl: config.webhookUrl, content });
    processQueue();
}

export async function testDiscordWebhook(webhookUrl) {
    if (!webhookUrl) {
        return { ok: false, error: 'Missing webhook URL' };
    }
    try {
        new URL(webhookUrl);
    } catch {
        return { ok: false, error: 'Invalid webhook URL' };
    }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT);
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '**Yapee**\nTest notification' }),
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

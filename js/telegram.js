import { getTelegramConfig } from './storage.js';
import { TELEGRAM_TIMEOUT, MIN_SEND_INTERVAL } from './constants.js';

const TELEGRAM_API = 'https://api.telegram.org/bot';
let lastSentTime = 0;
const sendQueue = [];
let processing = false;

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function doSend(botToken, chatId, text) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT);
    try {
        const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML'
            }),
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
            await doSend(item.botToken, item.chatId, item.text);
        }
        processing = false;
        if (sendQueue.length) processQueue();
    }, wait);
}

export function sendTelegramNotification(title, message, eventType) {
    getTelegramConfig(function(config) {
        if (!config.enabled || !config.botToken || !config.chatId) return;
        if (!config.events[eventType]) return;

        const parts = [`<b>Yapee</b>`];
        if (title && title !== 'Yapee') parts.push(escapeHtml(title));
        if (message) parts.push(escapeHtml(message));
        const text = parts.join('\n');

        sendQueue.push({ botToken: config.botToken, chatId: config.chatId, text });
        processQueue();
    });
}

export async function testTelegramConfig(botToken, chatId) {
    if (!botToken || !chatId) {
        return { ok: false, error: 'Missing bot token or chat ID' };
    }
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) {
        return { ok: false, error: 'Invalid bot token format' };
    }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT);
        const meRes = await fetch(`${TELEGRAM_API}${botToken}/getMe`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!meRes.ok) {
            return { ok: false, error: 'Invalid bot token' };
        }
        const me = await meRes.json();
        const botName = me.result?.first_name || 'Yapee Bot';
        const ok = await doSend(botToken, chatId, `<b>Yapee</b>\nTest notification from ${escapeHtml(botName)}`);
        if (!ok) {
            return { ok: false, error: 'Failed to send message. Check your Chat ID.' };
        }
        return { ok: true };
    } catch {
        return { ok: false, error: 'Network error' };
    }
}

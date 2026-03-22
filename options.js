import { pullStoredData, setOrigin, origin, serverIp, serverPort, serverProtocol, serverPath, servers, activeServerId, addServer, removeServer, setActiveServer, isAutoRetryEnabled, setAutoRetryEnabled, getTelegramConfig, setTelegramConfig, getDiscordConfig, setDiscordConfig, getNtfyConfig, setNtfyConfig } from './js/storage.js';
import { getThemeMode, setThemeMode } from './js/theme-api.js';
import { FEEDBACK_TIMEOUT } from './js/constants.js';
import { login, isLoggedIn, abortServerStatus, getAccounts, updateAccount, removeAccount, getLog } from './js/pyload-api.js';
import { initLocale, setLocale, getLocale, applyI18n, msg } from './js/i18n.js';
import { testTelegramConfig } from './js/telegram.js';
import { testDiscordWebhook } from './js/discord.js';
import { testNtfyConfig } from './js/ntfy.js';

initLocale().then(function () { applyI18n(); });

const serverNameInput = document.getElementById('serverName');
const serverListDiv = document.getElementById('serverListDiv');
const addServerButton = document.getElementById('addServerButton');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const serverIpInput = document.getElementById('serverIp');
const serverPortInput = document.getElementById('serverPort');
const serverPathInput = document.getElementById('serverPath');
const useHTTPSInput = document.getElementById('useHTTPS');
const spinnerDiv = document.getElementById('spinnerDiv');
const loginStatusOKDiv = document.getElementById('loginStatusOK');
const loginStatusKODiv = document.getElementById('loginStatusKO');
const currentURL = document.getElementById('currentURL');

const saveButton = document.getElementById('saveButton');
const loginButton = document.getElementById('loginButton');
const loginButtonModal = document.getElementById('loginButtonModal');
const alertDanger = document.getElementById('alertDanger');
const rememberCredentials = document.getElementById('rememberCredentials');
const rememberWarning = document.getElementById('rememberWarning');
let loginModalInstance = null;
const httpWarning = document.getElementById('httpWarning');

let loginFailures = 0;
let loginLockedUntil = 0;

async function loadLoginRateLimit() {
    const data = await chrome.storage.session.get(['loginFailures', 'loginLockedUntil']);
    loginFailures = data.loginFailures ?? 0;
    loginLockedUntil = data.loginLockedUntil ?? 0;
}

function saveLoginRateLimit() {
    chrome.storage.session.set({ loginFailures, loginLockedUntil });
}


function enableSpinner() {
    const spinner = document.createElement('div');
    spinner.className = 'spinner-border text-primary m-3';
    const label = document.createElement('div');
    label.textContent = msg('optionsCheckingStatus');
    spinnerDiv.replaceChildren(spinner, label);
}

function disableSpinner() {
    spinnerDiv.replaceChildren();
}

function setDangerMessage(message, timeout=FEEDBACK_TIMEOUT) {
    if (!message) {
        alertDanger.hidden = true;
        return;
    }
    alertDanger.innerText = message;
    alertDanger.hidden = false;
    if (timeout > 0) {
        setTimeout(function() {
            alertDanger.hidden = true;
            alertDanger.innerText = '';
        }, timeout);
    }
}

function getProtocol() {
    return useHTTPSInput.checked ? 'https' : 'http';
}

async function updateLoggedInStatus(callback) {
    saveButton.disabled = true;
    loginStatusOKDiv.hidden = true;
    loginStatusKODiv.hidden = true;
    loginButton.hidden = true;
    enableSpinner();
    const { success: loggedIn, unauthorized, error } = await isLoggedIn();
    disableSpinner();
    loginStatusOKDiv.hidden = !loggedIn;
    loginStatusKODiv.hidden = loggedIn;
    loginStatusKODiv.replaceChildren();
    const errIcon = document.createElement('i');
    errIcon.className = 'fa fa-times small me-3';
    loginStatusKODiv.appendChild(errIcon);
    const msgSpan = document.createElement('span');
    if (!loggedIn && unauthorized) {
        msgSpan.textContent = msg('optionsPleaseLogIn');
    } else {
        msgSpan.textContent = error ? error : msg('optionsNotLoggedIn');
    }
    loginStatusKODiv.appendChild(msgSpan);
    loginButton.hidden = !unauthorized;
    saveButton.disabled = false;
    if (loggedIn) loadAccounts();
    if (callback) callback();
}

function requestPermission(callback) {
    chrome.permissions.contains({
        origins: [`${origin}/`]
    }, function(result) {
        if (!result) {
            chrome.permissions.request({
                origins: [`${origin}/`]
            }, function(granted) {
                if (callback) {
                    if (!granted) {
                        alert(msg('optionsPermissionWarning'));
                    }
                    callback(granted);
                }
            });
        } else if (callback) {
            callback(true);
        }
    });
}

function validHost(str) {
    if (!str) return false;
    if (str === 'localhost') return true;
    try {
        const url = new URL(`http://${str.includes(':') ? `[${str}]` : str}`);
        return !!url.hostname;
    } catch {
        return false;
    }
}

function validateForm() {
    // Host
    const value = serverIpInput.value;
    const isLocalhost = (value === 'localhost');
    const isServerIPValid = validHost(value) || isLocalhost;
    if (isServerIPValid) {
        serverIpInput.classList.remove('is-invalid');
    } else {
        serverIpInput.classList.add('is-invalid');
        saveButton.disabled = true;
    }
    // Port
    const portNum = parseInt(serverPortInput.value, 10);
    const isValidPort = /^\d{1,5}$/.test(serverPortInput.value) && portNum >= 1 && portNum <= 65535;
    if (isValidPort) {
        serverPortInput.classList.remove('is-invalid');
    } else {
        serverPortInput.classList.add('is-invalid');
        saveButton.disabled = true;
    }
    // Path
    const isValidPath = /^((\/[.\w-]+)*\/{0,1}|\/)$/.test(serverPathInput.value);
    if (isValidPath) {
        serverPathInput.classList.remove('is-invalid');
    } else {
        serverPathInput.classList.add('is-invalid');
        saveButton.disabled = true;
    }
}

function requireSaving() {
    updateCurrentURL();
    abortServerStatus();
    if (serverIpInput.value === serverIp &&
        parseInt(serverPortInput.value) === parseInt(serverPort) &&
        useHTTPSInput.checked === (serverProtocol === 'https') &&
        serverPathInput.value === serverPath) {
        updateLoggedInStatus();
    } else {
        saveButton.disabled = false;
        loginStatusOKDiv.hidden = true;
        loginStatusKODiv.hidden = true;
        loginButton.hidden = true;
    }
    validateForm();
}

function updateCurrentURL() {
    let portString = `:${serverPortInput.value}`;
    if ((useHTTPSInput.checked && serverPortInput.value === '443') || (!useHTTPSInput.checked && serverPortInput.value === '80')) {
        portString = '';
    }
    httpWarning.style.display = useHTTPSInput.checked ? 'none' : 'block';
    currentURL.textContent = `${useHTTPSInput.checked ? 'https' : 'http'}://${serverIpInput.value}${portString}${serverPathInput.value}`;
}

saveButton.onclick = async function(ev) {
    await setOrigin(serverIpInput.value, serverPortInput.value, getProtocol(), serverPathInput.value, serverNameInput.value.trim() || 'Default');
    requestPermission(function() {
        renderServerList();
        updateLoggedInStatus(function() {
            if (!loginButton.hidden) {
                loginButton.click();
            }
        });
    });
};

loginButton.onclick = function(ev) {
    rememberWarning.hidden = !rememberCredentials.checked;
    loginModalInstance = new bootstrap.Modal(document.getElementById('loginModal'));
    loginModalInstance.show();
}

rememberCredentials.onchange = function() {
    rememberWarning.hidden = !rememberCredentials.checked;
}

loginButtonModal.onclick = async function(ev) {
    const now = Date.now();
    if (now < loginLockedUntil) {
        const secs = Math.ceil((loginLockedUntil - now) / 1000);
        setDangerMessage(msg('optionsTooManyAttempts', [String(secs)]), 0);
        return;
    }
    setDangerMessage('');
    const { success, error: error_msg } = await login(usernameInput.value, passwordInput.value, rememberCredentials.checked);
    if (success) {
        loginFailures = 0;
        loginLockedUntil = 0;
        saveLoginRateLimit();
        if (loginModalInstance) loginModalInstance.hide();
        updateLoggedInStatus();
    } else {
        loginFailures++;
        if (loginFailures >= 3) {
            const lockSecs = Math.min(30 * Math.pow(2, loginFailures - 3), 300);
            loginLockedUntil = Date.now() + lockSecs * 1000;
            saveLoginRateLimit();
            setDangerMessage(msg('optionsTooManyAttempts', [String(lockSecs)]), 0);
        } else {
            saveLoginRateLimit();
            setDangerMessage(error_msg, 0);
        }
    }
}

// --- Server Management ---

function buildServerRow(s) {
    const row = document.createElement('div');
    row.className = 'd-flex align-items-center gap-2 mb-1';

    const badge = document.createElement('span');
    badge.className = `badge ${s.id === activeServerId ? 'bg-primary' : 'bg-secondary'}`;
    badge.textContent = s.id === activeServerId ? msg('optionsActive') : msg('optionsInactive');

    const label = document.createElement('span');
    label.className = 'flex-grow-1';
    label.textContent = `${s.name} — ${s.serverProtocol}://${s.serverIp}:${s.serverPort}${s.serverPath}`;

    const activateBtn = document.createElement('button');
    activateBtn.className = 'btn btn-sm btn-outline-primary py-0 px-1';
    activateBtn.textContent = msg('optionsActivate');
    activateBtn.hidden = s.id === activeServerId;
    activateBtn.onclick = async function() {
        await setActiveServer(s.id);
        await pullStoredData();
        renderServerList();
        updateForm();
        updateLoggedInStatus();
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-sm btn-outline-danger py-0 px-1';
    deleteBtn.textContent = msg('optionsDelete');
    deleteBtn.onclick = async function() {
        if (!confirm(msg('optionsConfirmDeleteServer'))) return;
        await removeServer(s.id);
        await pullStoredData();
        renderServerList();
        updateForm();
        updateLoggedInStatus();
    };

    row.appendChild(badge);
    row.appendChild(label);
    row.appendChild(activateBtn);
    row.appendChild(deleteBtn);
    return row;
}

function renderServerList() {
    if (!servers.length) {
        const noServers = document.createElement('span');
        noServers.className = 'text-muted';
        noServers.textContent = msg('optionsNoServers');
        serverListDiv.replaceChildren(noServers);
        return;
    }
    serverListDiv.replaceChildren(...servers.map(buildServerRow));
}

function updateForm() {
    serverNameInput.value = servers.find(s => s.id === activeServerId)?.name || '';
    serverIpInput.value = serverIp;
    serverPortInput.value = serverPort;
    serverPathInput.value = serverPath;
    useHTTPSInput.checked = serverProtocol === 'https';
    updateCurrentURL();
}

addServerButton.onclick = async function() {
    const config = {
        name: serverNameInput.value.trim() || msg('optionsNewServer'),
        serverIp: serverIpInput.value.trim() || 'localhost',
        serverPort: parseInt(serverPortInput.value, 10) || 8000,
        serverProtocol: getProtocol(),
        serverPath: serverPathInput.value || '/'
    };
    const s = await addServer(config);
    await setActiveServer(s.id);
    await pullStoredData();
    renderServerList();
    updateForm();
    updateLoggedInStatus();
};

// --- Hoster Accounts ---

const accountsDiv = document.getElementById('accountsDiv');
const accountPlugin = document.getElementById('accountPlugin');
const accountLogin = document.getElementById('accountLogin');
const accountPassword = document.getElementById('accountPassword');
const addAccountButton = document.getElementById('addAccountButton');
const accountFeedback = document.getElementById('accountFeedback');
const accountSuccess = document.getElementById('accountSuccess');

function buildAccountRow({ plugin, login: accLogin, valid }) {
    const row = document.createElement('div');
    row.className = 'd-flex align-items-center gap-2 mb-1';

    const badge = document.createElement('span');
    badge.className = `badge ${valid ? 'bg-success' : 'bg-danger'}`;
    badge.textContent = valid ? msg('optionsValid') : msg('optionsInvalid');

    const label = document.createElement('span');
    label.className = 'flex-grow-1';
    label.textContent = `${plugin} — ${accLogin}`;

    const testBtn = document.createElement('button');
    testBtn.className = 'btn btn-sm btn-outline-primary py-0 px-1';
    testBtn.textContent = msg('optionsTestAccount');
    testBtn.onclick = async function() {
        testBtn.disabled = true;
        const spin = document.createElement('span');
        spin.className = 'spinner-border spinner-border-sm';
        testBtn.replaceChildren(spin);
        const refreshed = await getAccounts(true);
        testBtn.disabled = false;
        testBtn.textContent = msg('optionsTestAccount');
        const list = refreshed[plugin] || [];
        const found = list.find(function(a) { return a.login === accLogin; });
        if (found && found.valid) {
            badge.className = 'badge bg-success';
            badge.textContent = msg('optionsValid');
            accountSuccess.textContent = msg('optionsAccountValid');
            accountSuccess.hidden = false;
            accountFeedback.hidden = true;
        } else {
            badge.className = 'badge bg-danger';
            badge.textContent = msg('optionsInvalid');
            accountFeedback.textContent = msg('optionsAccountInvalid');
            accountFeedback.hidden = false;
            accountSuccess.hidden = true;
        }
    };

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-sm btn-outline-danger py-0 px-1';
    removeBtn.textContent = msg('optionsRemove');
    removeBtn.onclick = async function() {
        if (!confirm(msg('optionsConfirmDeleteAccount'))) return;
        removeBtn.disabled = true;
        await removeAccount(plugin, accLogin);
        loadAccounts();
    };

    row.appendChild(badge);
    row.appendChild(label);
    row.appendChild(testBtn);
    row.appendChild(removeBtn);
    return row;
}

function renderAccounts(accounts) {
    const entries = [];
    for (const [plugin, list] of Object.entries(accounts)) {
        list.forEach(acc => entries.push({ plugin, login: acc.login, valid: acc.valid }));
    }
    if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'text-muted text-center';
        empty.textContent = msg('optionsNoAccounts');
        accountsDiv.replaceChildren(empty);
        return;
    }
    accountsDiv.replaceChildren(...entries.map(buildAccountRow));
}

async function loadAccounts() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'text-muted text-center';
    loadingDiv.textContent = msg('optionsLoading');
    accountsDiv.replaceChildren(loadingDiv);
    const accounts = await getAccounts();
    renderAccounts(accounts);
}

addAccountButton.onclick = async function() {
    const plugin = accountPlugin.value.trim();
    const login = accountLogin.value.trim();
    const password = accountPassword.value;
    accountFeedback.hidden = true;
    accountSuccess.hidden = true;
    if (!plugin || !login || !password) {
        accountFeedback.textContent = msg('optionsAllFieldsRequired');
        accountFeedback.hidden = false;
        return;
    }
    addAccountButton.disabled = true;
    const ok = await updateAccount(plugin, login, password);
    addAccountButton.disabled = false;
    if (ok) {
        accountPlugin.value = '';
        accountLogin.value = '';
        accountPassword.value = '';
        accountSuccess.textContent = msg('optionsAccountAdded');
        accountSuccess.hidden = false;
        loadAccounts();
    } else {
        accountFeedback.textContent = msg('optionsAccountFailed');
        accountFeedback.hidden = false;
    }
};

// --- Log Viewer ---

const loadLogButton = document.getElementById('loadLogButton');
const logOutput = document.getElementById('logOutput');
const logControls = document.getElementById('logControls');
const logSearchInput = document.getElementById('logSearchInput');
const logLevelFilter = document.getElementById('logLevelFilter');
const logPagination = document.getElementById('logPagination');
const logPrevBtn = document.getElementById('logPrevBtn');
const logNextBtn = document.getElementById('logNextBtn');
const logPageInfo = document.getElementById('logPageInfo');

let logAllLines = [];
let logPageSize = 100;
let logCurrentPage = 0;

function filterLogLines() {
    const search = logSearchInput.value.toLowerCase();
    const level = logLevelFilter.value;
    return logAllLines.filter(function(line) {
        if (level && !line.toUpperCase().includes(level)) return false;
        if (search && !line.toLowerCase().includes(search)) return false;
        return true;
    });
}

function renderLogPage() {
    const filtered = filterLogLines();
    const totalPages = Math.max(1, Math.ceil(filtered.length / logPageSize));
    logCurrentPage = Math.min(logCurrentPage, totalPages - 1);
    const start = logCurrentPage * logPageSize;
    const pageLines = filtered.slice(start, start + logPageSize);

    logOutput.textContent = pageLines.length ? pageLines.join('\n') : msg('optionsLogEmpty');
    logOutput.hidden = false;
    logOutput.scrollTop = logOutput.scrollHeight;

    logPrevBtn.disabled = logCurrentPage === 0;
    logNextBtn.disabled = logCurrentPage >= totalPages - 1;
    logPageInfo.textContent = `${logCurrentPage + 1} / ${totalPages}`;
    logPagination.hidden = totalPages <= 1;
}

loadLogButton.onclick = async function() {
    loadLogButton.disabled = true;
    const lines = await getLog(0);
    loadLogButton.disabled = false;
    logAllLines = lines || [];
    logCurrentPage = 0;
    logControls.hidden = false;
    renderLogPage();
};

logSearchInput.oninput = function() { logCurrentPage = 0; renderLogPage(); };
logLevelFilter.onchange = function() { logCurrentPage = 0; renderLogPage(); };
logPrevBtn.onclick = function() { if (logCurrentPage > 0) { logCurrentPage--; renderLogPage(); } };
logNextBtn.onclick = function() { logCurrentPage++; renderLogPage(); };

const autoRetryToggle = document.getElementById('autoRetryToggle');
autoRetryToggle.onchange = function() {
    setAutoRetryEnabled(autoRetryToggle.checked);
};

const localeSelect = document.getElementById('localeSelect');
localeSelect.value = getLocale();
localeSelect.onchange = function() {
    setLocale(localeSelect.value);
};

const themeSelect = document.getElementById('themeSelect');
themeSelect.onchange = function() {
    setThemeMode(themeSelect.value);
};

// --- Telegram Notifications ---

const telegramEnabled = document.getElementById('telegramEnabled');
const telegramBotToken = document.getElementById('telegramBotToken');
const telegramChatId = document.getElementById('telegramChatId');
const telegramSaveBtn = document.getElementById('telegramSaveBtn');
const telegramTestBtn = document.getElementById('telegramTestBtn');
const telegramFeedback = document.getElementById('telegramFeedback');
const telegramConfigFields = document.getElementById('telegramConfigFields');

function showTelegramFeedback(text, isError) {
    telegramFeedback.textContent = text;
    telegramFeedback.className = `mt-2 small ${isError ? 'text-danger' : 'text-success'}`;
    telegramFeedback.hidden = false;
    setTimeout(() => { telegramFeedback.hidden = true; }, 5000);
}

function readTelegramForm() {
    const events = {};
    document.querySelectorAll('.telegram-event').forEach(function(cb) {
        events[cb.dataset.event] = cb.checked;
    });
    return {
        enabled: telegramEnabled.checked,
        botToken: telegramBotToken.value,
        chatId: telegramChatId.value.trim(),
        events
    };
}

async function loadTelegramConfig() {
    const config = await getTelegramConfig();
    telegramEnabled.checked = config.enabled;
    telegramBotToken.value = config.botToken;
    telegramChatId.value = config.chatId;
    document.querySelectorAll('.telegram-event').forEach(function(cb) {
        if (Object.hasOwn(config.events, cb.dataset.event)) {
            cb.checked = config.events[cb.dataset.event];
        }
    });
}

telegramSaveBtn.onclick = async function() {
    telegramSaveBtn.disabled = true;
    await setTelegramConfig(readTelegramForm());
    telegramSaveBtn.disabled = false;
    showTelegramFeedback(msg('optionsTelegramSaved'), false);
};

telegramTestBtn.onclick = async function() {
    telegramTestBtn.disabled = true;
    const tgSpin = document.createElement('span');
    tgSpin.className = 'spinner-border spinner-border-sm';
    telegramTestBtn.replaceChildren(tgSpin);
    const form = readTelegramForm();
    const result = await testTelegramConfig(form.botToken, form.chatId);
    telegramTestBtn.disabled = false;
    telegramTestBtn.textContent = msg('optionsTelegramTest');
    if (result.ok) {
        showTelegramFeedback(msg('optionsTelegramTestSuccess'), false);
    } else {
        showTelegramFeedback(msg('optionsTelegramTestFailed', [result.error]), true);
    }
};

// --- Discord Notifications ---

const discordEnabled = document.getElementById('discordEnabled');
const discordWebhookUrl = document.getElementById('discordWebhookUrl');
const discordSaveBtn = document.getElementById('discordSaveBtn');
const discordTestBtn = document.getElementById('discordTestBtn');
const discordFeedback = document.getElementById('discordFeedback');

function showDiscordFeedback(text, isError) {
    discordFeedback.textContent = text;
    discordFeedback.className = `mt-2 small ${isError ? 'text-danger' : 'text-success'}`;
    discordFeedback.hidden = false;
    setTimeout(() => { discordFeedback.hidden = true; }, 5000);
}

function readDiscordForm() {
    const events = {};
    document.querySelectorAll('.discord-event').forEach(function(cb) {
        events[cb.dataset.event] = cb.checked;
    });
    return {
        enabled: discordEnabled.checked,
        webhookUrl: discordWebhookUrl.value.trim(),
        events
    };
}

async function loadDiscordConfig() {
    const config = await getDiscordConfig();
    discordEnabled.checked = config.enabled;
    discordWebhookUrl.value = config.webhookUrl;
    document.querySelectorAll('.discord-event').forEach(function(cb) {
        if (Object.hasOwn(config.events, cb.dataset.event)) {
            cb.checked = config.events[cb.dataset.event];
        }
    });
}

discordSaveBtn.onclick = async function() {
    discordSaveBtn.disabled = true;
    await setDiscordConfig(readDiscordForm());
    discordSaveBtn.disabled = false;
    showDiscordFeedback(msg('optionsDiscordSaved'), false);
};

discordTestBtn.onclick = async function() {
    discordTestBtn.disabled = true;
    const spin = document.createElement('span');
    spin.className = 'spinner-border spinner-border-sm';
    discordTestBtn.replaceChildren(spin);
    const form = readDiscordForm();
    const result = await testDiscordWebhook(form.webhookUrl);
    discordTestBtn.disabled = false;
    discordTestBtn.textContent = msg('optionsDiscordTest');
    if (result.ok) {
        showDiscordFeedback(msg('optionsDiscordTestSuccess'), false);
    } else {
        showDiscordFeedback(msg('optionsDiscordTestFailed', [result.error]), true);
    }
};

// --- ntfy Notifications ---

const ntfyEnabled = document.getElementById('ntfyEnabled');
const ntfyServerUrl = document.getElementById('ntfyServerUrl');
const ntfyTopic = document.getElementById('ntfyTopic');
const ntfySaveBtn = document.getElementById('ntfySaveBtn');
const ntfyTestBtn = document.getElementById('ntfyTestBtn');
const ntfyFeedback = document.getElementById('ntfyFeedback');

function showNtfyFeedback(text, isError) {
    ntfyFeedback.textContent = text;
    ntfyFeedback.className = `mt-2 small ${isError ? 'text-danger' : 'text-success'}`;
    ntfyFeedback.hidden = false;
    setTimeout(() => { ntfyFeedback.hidden = true; }, 5000);
}

function readNtfyForm() {
    const events = {};
    document.querySelectorAll('.ntfy-event').forEach(function(cb) {
        events[cb.dataset.event] = cb.checked;
    });
    return {
        enabled: ntfyEnabled.checked,
        serverUrl: ntfyServerUrl.value.trim() || 'https://ntfy.sh',
        topic: ntfyTopic.value.trim(),
        events
    };
}

async function loadNtfyConfig() {
    const config = await getNtfyConfig();
    ntfyEnabled.checked = config.enabled;
    ntfyServerUrl.value = config.serverUrl;
    ntfyTopic.value = config.topic;
    document.querySelectorAll('.ntfy-event').forEach(function(cb) {
        if (Object.hasOwn(config.events, cb.dataset.event)) {
            cb.checked = config.events[cb.dataset.event];
        }
    });
}

ntfySaveBtn.onclick = async function() {
    ntfySaveBtn.disabled = true;
    await setNtfyConfig(readNtfyForm());
    ntfySaveBtn.disabled = false;
    showNtfyFeedback(msg('optionsNtfySaved'), false);
};

ntfyTestBtn.onclick = async function() {
    ntfyTestBtn.disabled = true;
    const spin = document.createElement('span');
    spin.className = 'spinner-border spinner-border-sm';
    ntfyTestBtn.replaceChildren(spin);
    const form = readNtfyForm();
    const result = await testNtfyConfig(form.serverUrl, form.topic);
    ntfyTestBtn.disabled = false;
    ntfyTestBtn.textContent = msg('optionsNtfyTest');
    if (result.ok) {
        showNtfyFeedback(msg('optionsNtfyTestSuccess'), false);
    } else {
        showNtfyFeedback(msg('optionsNtfyTestFailed', [result.error]), true);
    }
};

(async function() {
    await loadLoginRateLimit();
    await pullStoredData();
    await initLocale();
    localeSelect.value = getLocale();
    themeSelect.value = await getThemeMode();
    applyI18n();
    renderServerList();
    updateForm();

    serverNameInput.oninput = requireSaving;
    serverIpInput.oninput = requireSaving;
    serverPortInput.oninput = requireSaving;
    useHTTPSInput.oninput = requireSaving;
    serverPathInput.oninput = requireSaving;

    const enabled = await isAutoRetryEnabled();
    autoRetryToggle.checked = enabled;

    await loadTelegramConfig();
    await loadDiscordConfig();
    await loadNtfyConfig();

    updateLoggedInStatus(function() {
        document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));
    });

    document.getElementById('username').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') document.getElementById('loginButtonModal').click();
    });
    document.getElementById('password').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') document.getElementById('loginButtonModal').click();
    });
})();

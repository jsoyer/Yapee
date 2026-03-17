import { pullStoredData, setOrigin, origin, serverIp, serverPort, serverProtocol, serverPath, servers, activeServerId, addServer, removeServer, setActiveServer, isAutoRetryEnabled, setAutoRetryEnabled } from './js/storage.js';
import { login, isLoggedIn, abortServerStatus, getAccounts, updateAccount, removeAccount, getLog } from './js/pyload-api.js';
import { initLocale, setLocale, getLocale, applyI18n, msg } from './js/i18n.js';

initLocale().then(function () { applyI18n(); });

let serverNameInput = document.getElementById('serverName');
let serverListDiv = document.getElementById('serverListDiv');
let addServerButton = document.getElementById('addServerButton');
let usernameInput = document.getElementById('username');
let passwordInput = document.getElementById('password');
let serverIpInput = document.getElementById('serverIp');
let serverPortInput = document.getElementById('serverPort');
let serverPathInput = document.getElementById('serverPath');
let useHTTPSInput = document.getElementById('useHTTPS');
let spinnerDiv = document.getElementById('spinnerDiv');
let loginStatusOKDiv = document.getElementById('loginStatusOK');
let loginStatusKODiv = document.getElementById('loginStatusKO');
let currentURL = document.getElementById('currentURL');

let saveButton = document.getElementById('saveButton');
let loginButton = document.getElementById('loginButton');
let loginButtonModal = document.getElementById('loginButtonModal');
let alertDanger = document.getElementById('alertDanger');
let rememberCredentials = document.getElementById('rememberCredentials');
let rememberWarning = document.getElementById('rememberWarning');
let loginModalInstance = null;
let httpWarning = document.getElementById('httpWarning');

let loginFailures = 0;
let loginLockedUntil = 0;

function loadLoginRateLimit(callback) {
    chrome.storage.session.get(['loginFailures', 'loginLockedUntil'], function(data) {
        loginFailures = data.loginFailures || 0;
        loginLockedUntil = data.loginLockedUntil || 0;
        if (callback) callback();
    });
}

function saveLoginRateLimit() {
    chrome.storage.session.set({ loginFailures, loginLockedUntil });
}


function enableSpinner() {
    while (spinnerDiv.firstChild) spinnerDiv.removeChild(spinnerDiv.firstChild);
    const spinner = document.createElement('div');
    spinner.className = 'spinner-border text-primary m-3';
    const label = document.createElement('div');
    label.textContent = msg('optionsCheckingStatus');
    spinnerDiv.appendChild(spinner);
    spinnerDiv.appendChild(label);
}

function disableSpinner() {
    while (spinnerDiv.firstChild) spinnerDiv.removeChild(spinnerDiv.firstChild);
}

function setDangerMessage(message, timeout=3000) {
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

function updateLoggedInStatus(callback) {
    saveButton.disabled = true;
    loginStatusOKDiv.hidden = true;
    loginStatusKODiv.hidden = true;
    loginButton.hidden = true;
    enableSpinner();
    isLoggedIn(function(loggedIn, unauthorized, error) {
        disableSpinner();
        loginStatusOKDiv.hidden = !loggedIn;
        loginStatusKODiv.hidden = loggedIn;
        loginStatusKODiv.innerHTML = `<i class="fa fa-times small me-3"></i>`;
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
    });
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

saveButton.onclick = function(ev) {
    setOrigin(serverIpInput.value, serverPortInput.value, getProtocol(), serverPathInput.value, serverNameInput.value.trim() || 'Default', function() {
        requestPermission(function() {
            renderServerList();
            updateLoggedInStatus(function() {
                if (!loginButton.hidden) {
                    loginButton.click();
                }
            });
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

loginButtonModal.onclick = function(ev) {
    const now = Date.now();
    if (now < loginLockedUntil) {
        const secs = Math.ceil((loginLockedUntil - now) / 1000);
        setDangerMessage(msg('optionsTooManyAttempts', [String(secs)]), 0);
        return;
    }
    setDangerMessage('');
    login(usernameInput.value, passwordInput.value, rememberCredentials.checked, function(success, error_msg) {
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
    });
}

// --- Server Management ---

function renderServerList() {
    serverListDiv.textContent = '';
    if (!servers.length) {
        const noServers = document.createElement('span');
        noServers.className = 'text-muted';
        noServers.textContent = msg('optionsNoServers');
        serverListDiv.appendChild(noServers);
        return;
    }
    servers.forEach(function(s) {
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
        activateBtn.onclick = function() {
            setActiveServer(s.id, function() {
                pullStoredData(function() {
                    renderServerList();
                    updateForm();
                    updateLoggedInStatus();
                });
            });
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-outline-danger py-0 px-1';
        deleteBtn.textContent = msg('optionsDelete');
        deleteBtn.disabled = false;
        deleteBtn.onclick = function() {
            if (!confirm(msg('optionsConfirmDeleteServer'))) return;
            removeServer(s.id, function() {
                pullStoredData(function() {
                    renderServerList();
                    updateForm();
                    updateLoggedInStatus();
                });
            });
        };

        row.appendChild(badge);
        row.appendChild(label);
        row.appendChild(activateBtn);
        row.appendChild(deleteBtn);
        serverListDiv.appendChild(row);
    });
}

function updateForm() {
    serverNameInput.value = servers.find(s => s.id === activeServerId)?.name || '';
    serverIpInput.value = serverIp;
    serverPortInput.value = serverPort;
    serverPathInput.value = serverPath;
    useHTTPSInput.checked = serverProtocol === 'https';
    updateCurrentURL();
}

addServerButton.onclick = function() {
    const config = {
        name: serverNameInput.value.trim() || msg('optionsNewServer'),
        serverIp: serverIpInput.value.trim() || 'localhost',
        serverPort: parseInt(serverPortInput.value, 10) || 8000,
        serverProtocol: getProtocol(),
        serverPath: serverPathInput.value || '/'
    };
    addServer(config, function(s) {
        setActiveServer(s.id, function() {
            pullStoredData(function() {
                renderServerList();
                updateForm();
                updateLoggedInStatus();
            });
        });
    });
};

// --- Hoster Accounts ---

let accountsDiv = document.getElementById('accountsDiv');
let accountPlugin = document.getElementById('accountPlugin');
let accountLogin = document.getElementById('accountLogin');
let accountPassword = document.getElementById('accountPassword');
let addAccountButton = document.getElementById('addAccountButton');
let accountFeedback = document.getElementById('accountFeedback');
let accountSuccess = document.getElementById('accountSuccess');

function renderAccounts(accounts) {
    accountsDiv.textContent = '';
    const entries = [];
    for (const [plugin, list] of Object.entries(accounts)) {
        list.forEach(acc => entries.push({ plugin, login: acc.login, valid: acc.valid }));
    }
    if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'text-muted text-center';
        empty.textContent = msg('optionsNoAccounts');
        accountsDiv.appendChild(empty);
        return;
    }
    entries.forEach(function(acc) {
        const row = document.createElement('div');
        row.className = 'd-flex align-items-center gap-2 mb-1';

        const badge = document.createElement('span');
        badge.className = `badge ${acc.valid ? 'bg-success' : 'bg-danger'}`;
        badge.textContent = acc.valid ? msg('optionsValid') : msg('optionsInvalid');

        const label = document.createElement('span');
        label.className = 'flex-grow-1';
        label.textContent = `${acc.plugin} — ${acc.login}`;

        const testBtn = document.createElement('button');
        testBtn.className = 'btn btn-sm btn-outline-primary py-0 px-1';
        testBtn.textContent = msg('optionsTestAccount');
        testBtn.onclick = function() {
            testBtn.disabled = true;
            testBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            getAccounts(function(refreshed) {
                testBtn.disabled = false;
                testBtn.textContent = msg('optionsTestAccount');
                const list = refreshed[acc.plugin] || [];
                const found = list.find(function(a) { return a.login === acc.login; });
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
            }, true);
        };

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-sm btn-outline-danger py-0 px-1';
        removeBtn.textContent = msg('optionsRemove');
        removeBtn.onclick = function() {
            if (!confirm(msg('optionsConfirmDeleteAccount'))) return;
            removeBtn.disabled = true;
            removeAccount(acc.plugin, acc.login, function() { loadAccounts(); });
        };

        row.appendChild(badge);
        row.appendChild(label);
        row.appendChild(testBtn);
        row.appendChild(removeBtn);
        accountsDiv.appendChild(row);
    });
}

function loadAccounts() {
    accountsDiv.textContent = '';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'text-muted text-center';
    loadingDiv.textContent = msg('optionsLoading');
    accountsDiv.appendChild(loadingDiv);
    getAccounts(function(accounts) { renderAccounts(accounts); });
}

addAccountButton.onclick = function() {
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
    updateAccount(plugin, login, password, function(ok) {
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
    });
};

// --- Log Viewer ---

let loadLogButton = document.getElementById('loadLogButton');
let logOutput = document.getElementById('logOutput');
let logControls = document.getElementById('logControls');
let logSearchInput = document.getElementById('logSearchInput');
let logLevelFilter = document.getElementById('logLevelFilter');
let logPagination = document.getElementById('logPagination');
let logPrevBtn = document.getElementById('logPrevBtn');
let logNextBtn = document.getElementById('logNextBtn');
let logPageInfo = document.getElementById('logPageInfo');

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

loadLogButton.onclick = function() {
    loadLogButton.disabled = true;
    getLog(0, function(lines) {
        loadLogButton.disabled = false;
        logAllLines = lines || [];
        logCurrentPage = 0;
        logControls.hidden = false;
        renderLogPage();
    });
};

logSearchInput.oninput = function() { logCurrentPage = 0; renderLogPage(); };
logLevelFilter.onchange = function() { logCurrentPage = 0; renderLogPage(); };
logPrevBtn.onclick = function() { if (logCurrentPage > 0) { logCurrentPage--; renderLogPage(); } };
logNextBtn.onclick = function() { logCurrentPage++; renderLogPage(); };

let autoRetryToggle = document.getElementById('autoRetryToggle');
autoRetryToggle.onchange = function() {
    setAutoRetryEnabled(autoRetryToggle.checked);
};

let localeSelect = document.getElementById('localeSelect');
localeSelect.value = getLocale();
localeSelect.onchange = function() {
    setLocale(localeSelect.value);
};

loadLoginRateLimit();
pullStoredData(async function() {
    await initLocale();
    localeSelect.value = getLocale();
    applyI18n();
    renderServerList();
    updateForm();

    serverNameInput.oninput = requireSaving;
    serverIpInput.oninput = requireSaving;
    serverPortInput.oninput = requireSaving;
    useHTTPSInput.oninput = requireSaving;
    serverPathInput.oninput = requireSaving;

    isAutoRetryEnabled(function(enabled) {
        autoRetryToggle.checked = enabled;
    });

    updateLoggedInStatus(function() {
        document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));
    });

    document.getElementById('username').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') document.getElementById('loginButtonModal').click();
    });
    document.getElementById('password').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') document.getElementById('loginButtonModal').click();
    });
});

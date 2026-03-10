import { pullStoredData, setOrigin, origin, serverIp, serverPort, serverProtocol, serverPath } from './js/storage.js';
import { login, isLoggedIn, abortServerStatus } from './js/pyload-api.js';

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
    spinnerDiv.innerHTML = `
        <div class="spinner-border text-primary m-3"></div>
        <div>Checking status...</div>
    `;
}

function disableSpinner() {
    spinnerDiv.innerHTML = ``;
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
            msgSpan.textContent = 'Please log in';
        } else {
            msgSpan.textContent = error ? error : 'You are not logged in';
        }
        loginStatusKODiv.appendChild(msgSpan);
        loginButton.hidden = !unauthorized;
        saveButton.disabled = false;
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
                        alert('Not granting this permission will make the extension unusable.');
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
    setOrigin(serverIpInput.value, serverPortInput.value, getProtocol(), serverPathInput.value, function() {
        requestPermission(function(granted) {
            updateLoggedInStatus();
        });
    });
};

loginButton.onclick = function(ev) {
    rememberCredentials.checked = false;
    rememberWarning.hidden = true;
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
        setDangerMessage(`Too many attempts. Try again in ${secs}s.`, 0);
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
                setDangerMessage(`Too many attempts. Try again in ${lockSecs}s.`, 0);
            } else {
                saveLoginRateLimit();
                setDangerMessage(error_msg, 0);
            }
        }
    });
}

loadLoginRateLimit();
pullStoredData(function() {
    serverIpInput.value = serverIp;
    serverPortInput.value = serverPort;
    serverPathInput.value = serverPath;
    useHTTPSInput.checked = serverProtocol === 'https';

    updateCurrentURL();

    serverIpInput.oninput = requireSaving;
    serverPortInput.oninput = requireSaving;
    useHTTPSInput.oninput = requireSaving;
    serverPathInput.oninput = requireSaving;

    updateLoggedInStatus(function() {
        document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));
    });
});

let xhr = null;

function getServerStatus(callback) {
    xhr = new XMLHttpRequest();
    xhr.open('GET', `${origin}/api/status_server`, true);
    const authHeader = getAuthHeader();
    if (authHeader) {
        xhr.setRequestHeader('Authorization', authHeader);
    }
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            try {
                if (xhr.status === 404) {
                    if (callback) callback(false, false, 'Server not found');
                    return;
                }
                const response = JSON.parse(xhr.responseText);
                if (xhr.status === 200) {
                    if (callback) callback(true, false, null, response);
                } else if (xhr.status === 403 || xhr.status === 401) {
                    if (callback) callback(false, true, 'Unauthorized', response);
                } else if (response.hasOwnProperty('error')) {
                    // CSRF error or Unauthorized means we need to authenticate
                    if (response.error === 'CSRF token is invalid' || response.error.includes('Unauthorized') || response.error.includes('Login required')) {
                        if (callback) callback(false, true, response.error);
                    } else {
                        if (callback) callback(false, false, response.error);
                    }
                } else {
                    if (callback) callback(false, false, null, response);
                }
            } catch {
                if (callback) callback(false, false, 'Server unreachable');
            }
        }
    }
    xhr.timeout = 5000;
    xhr.ontimeout = function() {
        if (callback) callback(false, false, 'Server unreachable');
    }
    xhr.send();
}

function login(user, pass, callback) {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', `${origin}/api/check_auth?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`, true);
    const authHeader = 'Basic ' + btoa(user + ':' + pass);
    xhr.setRequestHeader('Authorization', authHeader);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            try {
                const response = JSON.parse(xhr.responseText);
                if (xhr.status === 200 && response && Object.keys(response).length > 0) {
                    setCredentials(user, pass, function() {
                        if (callback) callback(true);
                    });
                } else {
                    if (callback) callback(false, 'Login failed, invalid credentials');
                }
            } catch (e) {
                if (callback) callback(false, 'Login failed, invalid response from server');
            }
        }
    }
    xhr.timeout = 5000;
    xhr.ontimeout = function() {
        if (callback) callback(false, 'Login failed, server unreachable');
    }
    xhr.send();
}

function getStatusDownloads(callback) {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', `${origin}/api/status_downloads`, true);
    const authHeader = getAuthHeader();
    if (authHeader) {
        xhr.setRequestHeader('Authorization', authHeader);
    }
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            const status = JSON.parse(xhr.responseText);
            if (callback) callback(status);
        }
    }
    xhr.send();
}

function getQueueData(callback) {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', `${origin}/api/get_queue_data`, true);
    const authHeader = getAuthHeader();
    if (authHeader) {
        xhr.setRequestHeader('Authorization', authHeader);
    }
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            const queueData = JSON.parse(xhr.responseText);
            const urls = [];
            queueData.forEach(pack => {
                pack.links.forEach(link => {
                    urls.push(link.url);
                });
            });
            if (callback) callback(urls);
        }
    }
    xhr.send();
}

function getLimitSpeedStatus(callback) {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', `${origin}/api/get_config_value?category=download&option=limit_speed&section=core`, true);
    const authHeader = getAuthHeader();
    if (authHeader) {
        xhr.setRequestHeader('Authorization', authHeader);
    }
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            const limitSpeed = JSON.parse(xhr.responseText).toString().toLowerCase() === 'true';
            if (callback) callback(limitSpeed);
        }
    }
    xhr.send();
}

function setLimitSpeedStatus(limitSpeed, callback) {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', `${origin}/api/set_config_value`, true);
    const authHeader = getAuthHeader();
    if (authHeader) {
        xhr.setRequestHeader('Authorization', authHeader);
    }
    xhr.setRequestHeader('Content-type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (callback) callback(xhr.status === 200);
        }
    }
    xhr.send(JSON.stringify({
        category: "download",
        option: "limit_speed",
        value: limitSpeed,
        section: "core"
    }));
}

function addPackage(name, url, callback) {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', `${origin}/api/add_package`, true);
    const authHeader = getAuthHeader();
    if (authHeader) {
        xhr.setRequestHeader('Authorization', authHeader);
    }
    xhr.setRequestHeader('Content-type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            try {
                const response = JSON.parse(xhr.responseText);
                if (response.hasOwnProperty('error')) {
                    if (callback) callback(false, response.error);
                } else {
                    if (callback) callback(true);
                }
            } catch (e) {
                if (callback) callback(xhr.status === 200);
            }
        }
    }
    const safeName = name.replace(/[^a-z0-9._\-]/gi, '_');
    xhr.send(JSON.stringify({
        name: safeName,
        links: [url]
    }));
}

function checkURL(url, callback) {
    let xhr = new XMLHttpRequest();
    xhr.open('POST', `${origin}/api/check_urls`, true);
    const authHeader = getAuthHeader();
    if (authHeader) {
        xhr.setRequestHeader('Authorization', authHeader);
    }
    xhr.setRequestHeader('Content-type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            try {
                const response = JSON.parse(xhr.responseText);
                if (callback) callback(!response.hasOwnProperty('BasePlugin') && !response.hasOwnProperty('error'));
            } catch (e) {
                if (callback) callback(false);
            }
        }
    }
    xhr.send(JSON.stringify({
        urls: [url]
    }));
}

let serverPort, serverIp, serverProtocol, serverPath, origin;
let username, password;

function pullStoredData(callback) {
    chrome.storage.sync.get(['serverIp', 'serverPort', 'serverPath', 'serverProtocol', 'username', 'password'], function(data) {
        serverIp = data.serverIp || '172.0.0.1';
        serverPort = data.serverPort || 8001;
        serverPath = data.serverPath || '/';
        serverProtocol = data.serverProtocol || 'http';
        username = data.username || '';
        password = data.password || '';
        origin = `${serverProtocol}://${serverIp}:${serverPort}${serverPath}`;
        if (origin.endsWith('/')) {
            origin = origin.slice(0, origin.length - 1);
        }
        if (callback) callback(data);
    });
}

function setCredentials(user, pass, callback) {
    username = user;
    password = pass;
    chrome.storage.sync.set({
        username: username,
        password: password
    }, function () {
        if (callback) callback();
    });
}

function getAuthHeader() {
    if (username && password) {
        return 'Basic ' + btoa(username + ':' + password);
    }
    return null;
}

function isLoggedIn(callback) {
    getServerStatus(function(success, unauthorized, error, response) {
        if (callback) {
            callback(success, unauthorized, error, response);
        }
    });
}

function setOrigin(ip, port, protocol, path, callback) {
    serverIp = ip;
    serverPort = port;
    serverProtocol = protocol;
    serverPath = path;
    origin = `${serverProtocol}://${serverIp}:${serverPort}${serverPath}`;
    if (origin.endsWith('/')) {
        origin = origin.slice(0, origin.length - 1);
    }
    chrome.storage.sync.set({
        serverIp: serverIp,
        serverPort: serverPort,
        serverProtocol: serverProtocol,
        serverPath: serverPath
    }, function () {
        if (callback) callback();
    });
}

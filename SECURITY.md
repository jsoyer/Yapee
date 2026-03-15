# Security

Yapee is designed with privacy and security as core principles. This document outlines the extension's security model and best practices.

---

## Credential Storage

### Encryption

When you check "Remember credentials" in the options page, your PyLoad login credentials are stored locally using the WebCrypto API:

- **Algorithm**: AES-GCM 256-bit
- **Key derivation**: Per-session key derived using PBKDF2
- **Storage location**: `chrome.storage.local` (your device only)
- **Scope**: Credentials are isolated per server by server ID

### Session-Only Mode

By default, credentials are stored in `chrome.storage.session` (memory only) and are cleared when your browser closes. This is the safest option for shared devices.

### Never Plaintext

Your password is never stored in plaintext, logged, or transmitted unencrypted to any service except your own PyLoad server.

---

## Content Security Policy

Yapee enforces a strict Content Security Policy to prevent injection attacks:

```
default-src 'none'                    # Block everything by default
script-src 'self'                     # Only extension scripts
connect-src *                         # Required for user-configured servers
img-src 'self' data: https:           # Images from extension or data URIs
style-src 'self' 'unsafe-inline'      # Styles from extension (Inline Bootstrap)
font-src 'self'                       # Fonts bundled with extension
```

- No inline event handlers
- No `eval()` or `Function()` constructor
- No remote code execution
- No third-party CDN dependencies

---

## Permissions Model

### Required Permissions

| Permission | Purpose |
|---|---|
| `storage` | Store server configuration and credentials |
| `contextMenus` | Add "Download with Yapee" to right-click menu |
| `notifications` | Send desktop alerts for downloads and errors |
| `alarms` | Schedule credential refresh tasks |

### Optional Permissions

Host permissions are requested dynamically when you add a server. You can:

- Grant permission to a specific server origin (recommended)
- Revoke permission at any time in browser settings
- Use the extension with multiple servers and fine-tune access per server

The extension does **not** request blanket `<all_urls>` or `http://*/*/*` permissions at install time.

---

## Content Script Security

The content relay script (`content-relay.js`) is used only for Tampermonkey communication:

- **Validation**: Only messages with `type: 'yape-add-package'` are relayed
- **No DOM modification**: The extension does not modify page content
- **No credential injection**: The script never injects credentials into web pages
- **Isolated scope**: Messages are forwarded to the background service worker only

---

## Authentication

### HTTP Basic Auth

All API requests to your PyLoad server use HTTP Basic Auth:

```
Authorization: Basic base64(username:password)
```

- Sent only to the server origin you configure
- Never transmitted to third parties
- HTTPS recommended (see HTTP warning below)

### Login Rate Limiting

After 3 failed login attempts, the extension applies exponential backoff:

- 1st failure: immediate retry
- 2nd failure: immediate retry
- 3rd failure and beyond: 30 seconds, 60 seconds, 120 seconds, up to 300 seconds maximum

Rate limit state is stored in session storage and resets when your browser restarts.

### HTTP Warning

If you configure an HTTP (non-HTTPS) server, Yapee displays a warning:

- In the server options form
- In the login modal before authentication

HTTP credentials are transmitted in cleartext and can be intercepted on insecure networks. HTTPS is strongly recommended.

---

## Data Security in Transit

### HTTPS (Recommended)

When using HTTPS:
- Credentials are encrypted end-to-end
- Man-in-the-middle attacks are prevented by certificate validation

### HTTP (Discouraged)

When using HTTP:
- Credentials are sent in plaintext over the network
- Only safe on trusted, local networks (e.g., 192.168.x.x)
- Yapee warns you when using HTTP

---

## No Tracking or Telemetry

Yapee does **not**:

- Collect analytics or usage data
- Send telemetry to any server
- Use crash reporting services
- Track download history outside your device
- Transmit data to the extension developer

The only network requests made by Yapee are to the PyLoad server you configure. You have full control over where your data goes.

See [PRIVACY.md](PRIVACY.md) for the complete data handling policy.

---

## Third-Party Libraries

Yapee bundles the following open-source libraries. They run entirely locally and make no network requests:

- [jQuery](https://jquery.com) (MIT License)
- [Bootstrap](https://getbootstrap.com) (MIT License)
- [DOMPurify](https://github.com/cure53/DOMPurify) (Apache 2.0 / MPL 2.0)
- [Font Awesome Free](https://fontawesome.com) (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT)

All libraries are vendored (included directly) rather than loaded from CDNs.

---

## Tampermonkey Integration

The companion userscript (`yape-companion.user.js`) communicates with the extension via `chrome.runtime.sendMessage`:

- Messages are validated by extension ID
- Only the Tampermonkey environment can inject this script
- No cross-domain communication
- Message format is strictly validated

---

## Reporting a Security Vulnerability

If you discover a security vulnerability in Yapee, please do not disclose it publicly. Instead:

1. Open a private issue on GitHub (mark as private)
2. Email the maintainer with details and reproduction steps
3. Allow 30 days for a fix before public disclosure

Security fixes are released as soon as possible and will be noted in the changelog.

---

## Browser Security Features Used

Yapee leverages built-in browser security features:

- **Manifest V3**: Service workers instead of persistent background pages
- **WebCrypto API**: Hardware-accelerated encryption when available
- **Storage Isolation**: `chrome.storage.local` is isolated per-profile and per-device
- **Origin Policy**: Host permissions are enforced per-origin
- **Notification API**: Notifications use the browser's native system, not web pages

---

## Security Best Practices for Users

1. **Use HTTPS**: Configure your PyLoad server with HTTPS if possible
2. **Use a Strong Password**: Choose a complex password for your PyLoad account
3. **Remember Credentials Carefully**: Only enable "Remember credentials" on trusted devices
4. **Review Permissions**: Check which servers have extension permissions in your browser settings
5. **Keep Your Browser Updated**: Security fixes are released regularly
6. **Uninstall If Unused**: Remove the extension if you no longer use PyLoad

---

## Ongoing Security

Yapee follows secure development practices:

- Regular code reviews before merging
- Dependency updates to patch vulnerabilities
- Clear separation of concerns (service worker, content scripts, UI)
- Minimal external dependencies
- Automated testing of critical paths

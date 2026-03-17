# Yapee — PyLoad Browser Extension

A powerful, privacy-first browser extension for managing [PyLoad](https://pyload.net) downloads — the spiritual successor to [Yape](https://github.com/RemiRigal/Yape), completely rewritten with Manifest V3. Available for Chrome, Chromium, Edge, and Firefox.

**Current version:** 3.8.1 — Language selector, store listing refresh, documentation update.

[![Sponsor](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-ea4aaa?logo=github)](https://github.com/sponsors/jsoyer)
[![Ko-fi](https://img.shields.io/badge/Support-Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/jsoyer)

---

## Features

**Core Download Management**
- Monitor active downloads with progress, speed, and ETA
- View queued packages and reorder with drag and drop
- Browse collector and push packages to queue
- Per-file controls: stop, restart, or delete individual files and packages

**Server & Multi-Account**
- Manage multiple PyLoad instances, switch in one click
- Add, edit, and delete servers from options page
- Per-server credentials (encrypted storage option)
- Hoster account management for sites requiring login

**User Interface**
- Dark mode with dynamic system theme detection (updates without reload)
- Chrome Side Panel and Firefox Sidebar for persistent monitoring
- Internationalization: English and French, with manual language override in Options
- Search and filter across downloads, queue, and collector
- Download history (last 1,000 entries) with search and status filter
- Mini-stats dashboard: per-hoster breakdown, peak speed, failure rate
- Desktop notifications: per-package completion, errors, captcha alerts with timeout warning
- Keyboard shortcuts: Alt+Shift+P (pause), Alt+Shift+Y (popup)

**Advanced Features**
- Event-driven real-time updates via PyLoad's event streaming API
- Context menu: right-click any link or extract all hoster links from a page
- Multi-URL paste with parallel submission and custom package names
- Captcha solving directly in the popup with timeout countdown
- Server log viewer with level filter, search, and pagination
- Speed limiter (0–100,000 KB/s) with input validation and proxy toggle
- Smart retry with exponential backoff (up to 5 attempts, configurable)
- Batch operations: multi-select delete in queue, click-to-rename packages
- Container file upload (DLC/CCF/RSDF) with 10 MB size guard
- Tampermonkey companion script with one-click download buttons on 60+ hosters
- Hoster account management with test/verify button

**Technical**
- Manifest V3 (Chrome) and Firefox-compatible via manifest.firefox.json
- AES-GCM 256-bit credential encryption
- Minimal permissions model with optional host permissions
- Strict Content Security Policy with no inline scripts
- Login rate limiting to prevent brute force attempts

---

## Installation

### Chrome / Chromium / Edge

1. [Download the latest Chrome release](https://github.com/jsoyer/Yapee/releases/latest) (`yapee-chrome-*.zip`) and unzip, or clone the repository
2. Go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the extension folder
5. Click the Yapee icon in your toolbar, then click the gear icon to configure

### Firefox

1. [Download the latest Firefox release](https://github.com/jsoyer/Yapee/releases/latest) (`yapee-firefox-*.zip`) and unzip, or clone the repository and copy `manifest.firefox.json` over `manifest.json`
2. Go to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on** and select `manifest.json`
4. Click the Yapee icon in your toolbar, then click the gear icon to configure

---

## Configuration

### Add a PyLoad Server

1. Click the Yapee icon and select the gear icon to open **Options**
2. Click **+ Add server** (or edit an existing server)
3. Enter the following:
   - **Host**: your PyLoad server's IP or domain
   - **Port**: PyLoad's listening port (default: 8000)
   - **Path**: optional path prefix (default: empty)
   - **Use HTTPS**: toggle if your server supports it
4. Click **Save** — your browser will prompt you to grant permission to the server's origin
5. Click **Login** and enter your PyLoad credentials
6. Optionally check **Remember credentials** to store encrypted login details

### Multi-Server Setup

- Add multiple servers via **+ Add server**
- Use **Activate** to switch the active server
- Each server maintains separate credentials and login state
- Quick switch from the popup's server dropdown

### Credential Storage

| Mode | Storage | Persistence |
|---|---|---|
| Default | In-memory session | Cleared on browser restart |
| "Remember credentials" enabled | Encrypted local storage (AES-GCM 256-bit) | Survives browser restart |

Credentials are never synced across devices and are isolated per server.

---

## Tampermonkey Companion Script

The included userscript adds a "↓ PyLoad" button next to download links on 60+ supported hoster sites.

### Setup

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Greasemonkey](https://www.greasespot.net/) in your browser
2. Create a new script and paste the contents of `yape-companion.user.js`
3. At the top of the script, edit the `EXTENSION_ID` constant and set it to your Yapee extension ID
   - Find your extension ID: go to `chrome://extensions` (Chrome) or `about:debugging#/runtime/this-firefox` (Firefox)
4. Save and enable the script in Tampermonkey's dashboard

The script communicates with the extension via the `externally_connectable` manifest key. No additional permissions are needed.

---

## Container File Upload

Yapee supports direct upload of DLC, CCF, and RSDF container files:

1. Open the Yapee popup
2. Navigate to the **Upload Container** section
3. Click the file picker and select a `.dlc`, `.ccf`, or `.rsdf` file
4. The container is automatically parsed and packages are added to the queue

---

## Browser Compatibility

| PyLoad Version | Auth Method | Status |
|---|---|---|
| < 0.5.0b3.dev78 | Session cookie | Unsupported — use [original extension](https://github.com/RemiRigal/Yape) |
| >= 0.5.0b3.dev78 | HTTP Basic Auth | Fully supported |

| Browser | Manifest Version | Status |
|---|---|---|
| Chrome / Chromium / Edge | MV3 (`manifest.json`) | Fully supported |
| Firefox >= 128 | MV3 (`manifest.firefox.json`) | Fully supported |

---

## Contributing

### Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/jsoyer/Yapee/issues) on GitHub.

### Translating to a New Language

Yapee supports auto-detection (browser language) and manual override (Options → Language selector).

Translations are stored in `_locales/`:

```
_locales/
  en/messages.json   # English (default)
  fr/messages.json   # French
```

To add a new language:

1. Create `_locales/<code>/messages.json` (e.g., `de` for German, `es` for Spanish)
2. Copy `_locales/en/messages.json` as a template
3. Translate all `"message"` values — keep all keys and `"placeholders"` unchanged
4. Add the new locale as an `<option>` in `options.html` (language selector)
5. Test the translation in your browser
6. Submit a pull request

HTML elements use `data-i18n` attributes for automatic translation. JavaScript code uses the `msg()` helper from `js/i18n.js`. When a manual locale is set, messages are loaded from the JSON file at runtime; otherwise `chrome.i18n.getMessage()` handles browser auto-detection.

---

## Architecture

- **Manifest V3** with service worker background script
- **Content script relay** for Tampermonkey communication
- **AES-GCM 256-bit encryption** for stored credentials (WebCrypto API)
- **Bootstrap 5** UI with dynamic dark/light theme switching
- **Event streaming** via PyLoad's real-time event API
- **Modular i18n system** with runtime locale override (`initLocale` / `setLocale`)

See [SECURITY.md](SECURITY.md) for details on encryption, CSP, and permission handling.
See [PRIVACY.md](PRIVACY.md) for the complete data handling policy.

---

## Acknowledgments

Yapee is the successor to [Yape](https://github.com/RemiRigal/Yape), originally created by [Rémi Rigal](https://github.com/RemiRigal). The project has since been completely rewritten with Manifest V3, 20+ major features, and full Firefox support. Thank you Rémi for the foundation.

---

## Support

Yapee is free, open-source, and built without ads or tracking. If you find it useful, you can support development:

- [GitHub Sponsors](https://github.com/sponsors/jsoyer)
- [Ko-fi](https://ko-fi.com/jsoyer)

---

## License

MIT — see [LICENSE](LICENSE)

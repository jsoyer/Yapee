# Privacy Policy — Yapee

**Last updated: 2026-03-15**

Yapee is a Chrome extension that allows you to monitor and send downloads to your self-hosted [PyLoad](https://pyload.net) server. This policy describes what data is collected, how it is stored, and what is transmitted.

---

## Data collected and stored

Yapee stores the following data **locally on your device only**, using `chrome.storage.local`:

| Data | Purpose | Storage |
|---|---|---|
| PyLoad server URL (host, port, path, protocol) | Connect to your self-hosted PyLoad instance | `chrome.storage.local` |
| Login credentials (username, password) | Authenticate with your PyLoad server, if you enable "Remember credentials" | `chrome.storage.local`, encrypted with AES-GCM (256-bit) |

If you do **not** check "Remember credentials", your login credentials are stored only in `chrome.storage.session` (in memory, cleared when the browser is closed) and are never written to disk.

---

## Data transmitted

The only network requests made by Yapee are to the PyLoad server URL you configure yourself. No data is sent to any third-party server, analytics service, or remote endpoint controlled by the extension developer.

Specifically:
- Your credentials are sent to your PyLoad server as an HTTP Basic Auth header to authenticate API requests.
- URLs you choose to download are sent to your PyLoad server's API.
- If you use HTTP instead of HTTPS, credentials are transmitted in cleartext over the network — Yapee displays a warning in this case.

---

## Third parties

Yapee does **not**:
- Share any data with third parties
- Sell user data
- Use data for advertising or tracking
- Transfer data outside your local network (except to your own configured PyLoad server)

---

## Bundled third-party libraries

Yapee bundles the following open-source libraries. They run entirely locally and make no network requests of their own:

- [jQuery](https://jquery.com) (MIT License)
- [Bootstrap](https://getbootstrap.com) (MIT License)
- [DOMPurify](https://github.com/cure53/DOMPurify) (Apache 2.0 / MPL 2.0)
- [Font Awesome Free](https://fontawesome.com) (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT)

---

## Data deletion

To delete all data stored by Yapee:

1. Go to `chrome://extensions`
2. Find Yapee and click **Details**
3. Click **Clear site data**

Alternatively, uninstalling the extension removes all stored data.

---

## Contact

If you have questions about this policy, open an issue at:
[https://github.com/jsoyer/Yapee/issues](https://github.com/jsoyer/Yapee/issues)

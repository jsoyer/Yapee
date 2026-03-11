# Yape — Roadmap

Features identified via PyLoad 0.5.0 API analysis and code quality audit (v2.1.0 baseline).

---

## Done

- **v2.2.0** — Stop/restart individual file, delete individual package, collector view with push-to-queue, proxy toggle, DOM-based download rendering, timer leak fix
- **v2.3.0** — `apiFetch` helper refactor (368→195 lignes), default IP localhost, aria-labels, PyLoad version display

---

## Backlog

### Code Quality

~~Tout fait~~

### Features — High value + Hard

- **Solve captchas in popup** — Embarquer l'image + formulaire directement, sans ouvrir PyLoad. API: `getCaptchaTask(exclusive=True)`, `setCaptchaResult(tid, result)`.
- **Event-driven updates** — Remplacer le polling 3s par des events delta. API: `getEvents(uuid)`. Moins de latence, moins de charge serveur.
- **Reorder queue** — Boutons ↑↓ pour réordonner les packages. API: `orderPackage(pid, position)`
- **Hoster account management** — Gérer les credentials premium (Uploaded, 1fichier…). API: `getAccounts()`, `updateAccount(plugin, login, password)`

### Features — Low value + Easy

- **Log viewer** — Modal avec les dernières lignes du log serveur. API: `getLog(offset)`
- **Multi-URL paste** — Textarea pour coller plusieurs URLs d'un coup dans le popup.

### Ideas / Exploration

- **Tampermonkey companion script** — Button injected next to direct download links on web pages (e.g. 1fichier, Uploaded). Communicates with the extension via `chrome.runtime.sendMessage` using `externally_connectable` in the manifest. Requires a separate Tampermonkey script and manifest changes.
- **Multi-URL paste** — Textarea in popup to paste and add multiple URLs at once.

---

## Won't Do

- **Full config editor** — Users edit `pyload.cfg` directly; not worth the complexity.
- **Container file upload (.dlc / .ccf)** — Niche feature; file picker + binary handling, rare use case.
- **Download scheduler** — Time-window config for downloads; complex UI, covered by PyLoad's own web UI.
- **Multi-server support** — Architectural change; niche use case.

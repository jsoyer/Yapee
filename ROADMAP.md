# Yape — Roadmap

Features identified via PyLoad 0.5.0 API analysis and code quality audit (v2.1.0 baseline).

---

## Done

- **v2.2.0** — Stop/restart individual file, delete individual package, collector view with push-to-queue, proxy toggle, DOM-based download rendering, timer leak fix
- **v2.3.0** — `apiFetch` helper refactor (368→195 lignes), default IP localhost, aria-labels, PyLoad version display
- **v2.4.0** — Loading spinners on action buttons
- **v2.5.0** — Event-driven updates (`getEvents`), queue view with reorder (↑↓), 3-tab popup (Downloads/Queue/Collector)
- **v2.6.0** — Captcha solving in popup, multi-URL paste, hoster account management in options, server log viewer in options
- **v2.7.0** — Tampermonkey companion script (`yape-companion.user.js`), `externally_connectable` for 60+ hosters, `onMessageExternal` in background.js
- **v2.8.0** — Multi-server switcher (Option A): servers array in storage, active server selector in popup, server management in options page, automatic migration from single-server format
- **v3.0.0** — Per-server credentials, dark mode (auto), notification on download complete, search/filter in popup, drag & drop reorder in queue, download stats counter, Firefox port (`manifest.firefox.json`), i18n FR/EN modular (`_locales/`, `js/i18n.js`)
- **v3.1.0** — DLC/CCF/RSDF container upload, options page redesign (tabbed layout), content-relay for companion script (no more EXTENSION_ID), checkURLs POST fix, search debounce, accessibility (aria-labels), i18n completeness, Firefox content-relay, SECURITY.md, fork independence (README rewrite, LICENSE update)

---

## Backlog

- **Multi-server (Option B)** — Afficher les downloads des deux instances simultanément dans le popup. Necessite de passer `origin` en parametre dans toute la chaine API, N event loops en parallele, et merger les resultats dans l'UI avec badge par serveur.

---

## Won't Do

- **Full config editor** — Users edit `pyload.cfg` directly; not worth the complexity.
- **Download scheduler** — Time-window config for downloads; complex UI, covered by PyLoad's own web UI.

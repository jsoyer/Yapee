# Yapee — Roadmap

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
- **v3.2.0** — Security hardening: content-relay URL validation (HTTP/S only), postMessage targetOrigin restriction, companion script per-hoster `@match` (no more `*://*/*`), MutationObserver debounce, consolidated `onMessage` listener, improved `.gitignore`
- **v3.3.0** — Rename Yape to Yapee, badge live (download count + captcha warning), actionable "all complete" notification with clear button, speed limit KB/s input, keyboard shortcuts (Alt+Shift+P pause, Alt+Shift+Y popup), global queue ETA, collector push-all and queue retry buttons
- **v3.4.0** — Enhanced notifications: per-package completion alerts, error/failure desktop notifications, captcha pending desktop alert, progress bar notification (`type: 'progress'`) for active downloads
- **v3.5.0** — Chrome Side Panel + Firefox Sidebar (reuses popup.html), batch operations (multi-select delete in queue), click-to-rename packages, add links to existing packages, hoster link extractor (context menu + `chrome.scripting`)

- **v3.6.0** — Analytics & Intelligence: download history (last 1000, circular buffer), mini-stats dashboard (per-hoster breakdown, peak speed, failure rate), smart retry with exponential backoff (5 attempts, configurable), advanced status filter in downloads view, History tab in popup

- **v3.7.0** — UX Polish & Collector Refactor: simplified Downloads tab (package management moved to Collector), container upload exclusive to Collector tab, custom package name for multi-URL submissions, fixed addPackage dest parameter and uploadContainer reliability, skip page download check for PyLoad's own URL, fixed tab visibility race conditions, toolbar icon wrapping fix, GitHub Sponsors and Ko-fi funding links

---

## Next — v3.8.0 — Hardening & Quality of Life

Quick wins from codebase audit. No new features, just making everything tighter.

- [x] **Speed input validation** — reject negative values, clamp to 0–100000 KB/s
- [x] **Captcha timeout warning** — visual countdown when captcha is pending, alert after 2min idle
- [x] **Dynamic theme switching** — `matchMedia` listener so dark↔light updates without reload
- [x] **Parallel multi-URL submission** — `Promise.all` instead of sequential `addPackage` calls
- [x] **Container upload size guard** — client-side file size limit (10 MB) before upload
- [x] **Account verify button** — "Test" button in options to validate hoster credentials
- [x] **Log viewer upgrade** — log level filter (DEBUG/INFO/WARNING/ERROR/CRITICAL), search, pagination
- [x] **Progress notification multi-download** — show top 3 active downloads, not just 1
- [ ] **Chrome Web Store listing update** — sync listing copy with v3.8.0 features (currently frozen at v3.3.0)

---

## Planned — v3.9.0 — Click'n'Load & Smart Capture

Close the biggest gap vs. JDownloader's browser extension.

- [ ] **Click'n'Load (CNL2) interception** — detect CNL2 protocol requests from hoster sites, auto-forward to PyLoad (the #1 expected feature for PyLoad browser extensions)
- [ ] **Clipboard monitoring** — optional: detect download URLs copied to clipboard, offer to send to PyLoad via notification
- [ ] **Destination folder picker** — choose PyLoad download subfolder/category before sending links (requires `getConfig` API)
- [ ] **Send feedback on companion script** — visual confirmation (checkmark animation) when link is sent from hoster page
- [ ] **Companion script button consistency** — unified positioning and styling across all 60+ hosters

---

## Planned — v4.0.0 — Multi-Instance Dashboard

The big architectural change. Display downloads from all PyLoad servers simultaneously.

- [ ] **Multi-server Option B** — afficher les downloads de toutes les instances simultanément dans le popup
- [ ] **Per-server origin** — passer `origin` en paramètre dans toute la chaîne API
- [ ] **Parallel event loops** — N polling loops indépendants, un par serveur
- [ ] **Merged UI with server badges** — chaque package/download affiche son serveur d'origine (couleur/badge)
- [ ] **Cross-server statistics** — dashboard agrégé ou filtrable par serveur
- [ ] **Server health indicators** — status dot (online/offline/slow) par serveur dans le header

---

## Planned — v4.1.0 — Data & Portability

- [ ] **Export history** — CSV/JSON export du download history
- [ ] **Import/export settings** — backup/restore complète (serveurs, préférences, comptes) en JSON chiffré
- [ ] **Extended history** — configurable retention (100 → 1000 → unlimited with IndexedDB)
- [ ] **Hoster stats full table** — afficher tous les hosters, pas juste le top 10

---

## Icebox — Under Consideration

Not committed. Evaluate based on user demand and effort.

- **Video/media detection** — detect downloadable video/audio on current page (YouTube, Vimeo), offer to send to PyLoad. Complex: requires page content analysis, overlaps with yt-dlp.
- **RSS/page monitoring** — watch a page for new download links, auto-send to PyLoad. Complex: requires persistent background scheduling + storage.
- **Browser download interception** — hijack Chrome's native download dialog to route through PyLoad. Requires `downloads` permission, complex UX.
- **Configurable keyboard shortcuts** — let users remap Alt+Shift+P/Y in options. Chrome MV3 supports `chrome.commands.update` but limited.
- **i18n expansion** — German, Spanish, Portuguese, Italian translations. Needs community contributors.
- **Safari port** — WebExtension API differences, Apple developer account required. Evaluate demand.
- **CONTRIBUTING.md + docs site** — contributor guide, structured documentation, API reference for companion script.

---

## Won't Do

- **Full config editor** — Users edit `pyload.cfg` directly; not worth the complexity.
- **Download scheduler** — Time-window config for downloads; complex UI, covered by PyLoad's own web UI.
- **Auto-interception of all browser downloads** — too intrusive, requires broad permissions, breaks user trust model.

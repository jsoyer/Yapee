# Yapee — PyLoad Download Manager Extension

## Project

- **Type**: Chrome/Firefox MV3 browser extension
- **Stack**: Vanilla JavaScript ES modules, Bootstrap 5.3.3, Font Awesome (woff2)
- **No build system** — files are served directly, no bundler/transpiler
- **i18n**: EN/FR via `_locales/` + `js/i18n.js` with manual locale override

## Architecture

```
popup.js              Entry point — tabs, buttons, polling, init (548 lines)
js/views/
  downloads.js        Download items view
  queue.js            Queue with drag & drop, file expansion
  collector.js        Collector staging area
  history.js          History + stats dashboard
background.js         Service worker — notifications, badge, retry (async/await)
js/
  pyload-api.js       All PyLoad API calls (apiFetch wrapper, safeInt validation)
  storage.js          Credential encryption (AES-256-GCM), server config, Telegram config
  telegram.js         Telegram bot notifications with rate limiting
  constants.js        Named constants (timeouts, limits, intervals)
  utils.js            Shared utilities (nameFromUrl, formatBytes, setIcon)
  i18n.js             Internationalization
  theme.js            Theme detection (prefers-color-scheme)
options.html/js       Settings page — servers, accounts, logs, notifications
content-relay.js      Message relay for companion userscript
```

## Key Patterns

- **API layer**: All PyLoad calls go through `apiFetch()` in `pyload-api.js` — never raw `fetch()`
- **Numeric params**: All API functions validate with `safeInt()` before interpolating into URLs
- **Credentials**: Encrypted with AES-256-GCM in `chrome.storage.local`, key in same storage (known limitation)
- **Notifications**: `notify()` (browser) + `sendTelegramNotification()` (Telegram) fire in parallel, Telegram is fire-and-forget
- **State**: `pullStoredData()` must be called before accessing `origin`, `servers`, etc. from storage.js
- **Callbacks vs Promises**: pyload-api.js and storage.js still use callbacks; background.js alarm handler uses async/await with `new Promise()` wrappers

## Gotchas

- **Dual manifests**: `manifest.json` (Chrome) + `manifest.firefox.json` — hoster domain lists must be synced manually
- **Userscript hoster list** (`yape-companion.user.js`) has extra entries not in manifests — intentional drift
- **PyLoad `restartPackage`** only restarts "failed" files, NOT "aborted" — we call `restartFile` per aborted file as a workaround
- **`connect-src *`** in CSP is required because the user's PyLoad server address is dynamic
- **Font Awesome CSS** (`css/all.min.css`) still references .eot/.svg/.ttf/.woff formats that were deleted — browsers fall back to woff2 silently

## Roadmap

See `tasks/roadmap.md` for backlog and done items.

---

# Behavior Instructions

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.

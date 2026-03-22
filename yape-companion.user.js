// ==UserScript==
// @name         Yapee — Send to PyLoad
// @namespace    https://github.com/jsoyer/Yapee
// @version      1.2.0
// @description  Adds a "↓ PyLoad" button next to download links on supported hosters
// @author       jsoyer
// @match        *://*.1fichier.com/*
// @match        *://*.4shared.com/*
// @match        *://*.alfafile.net/*
// @match        *://*.alldebrid.com/*
// @match        *://*.alterupload.com/*
// @match        *://*.clicknupload.com/*
// @match        *://cloud.mail.ru/*
// @match        *://*.debrid.it/*
// @match        *://*.debrid.link/*
// @match        *://*.depositfiles.com/*
// @match        *://*.dfiles.eu/*
// @match        *://*.dfiles.ru/*
// @match        *://*.dl4free.com/*
// @match        *://*.dropbox.com/*
// @match        *://drive.google.com/*
// @match        *://docs.google.com/*
// @match        *://*.easyupload.io/*
// @match        *://*.fboom.me/*
// @match        *://*.fileboom.me/*
// @match        *://*.filecloud.io/*
// @match        *://*.filefactory.com/*
// @match        *://*.filejoker.net/*
// @match        *://*.fileom.com/*
// @match        *://*.filerio.in/*
// @match        *://*.fshare.vn/*
// @match        *://*.gofile.io/*
// @match        *://*.k2s.cc/*
// @match        *://*.keep2share.cc/*
// @match        *://*.krakenfiles.com/*
// @match        *://*.linksnappy.com/*
// @match        *://*.mega.nz/*
// @match        *://*.mega.co.nz/*
// @match        *://*.mediafire.com/*
// @match        *://*.mp4upload.com/*
// @match        *://*.nitro.download/*
// @match        *://*.nitroflare.com/*
// @match        *://*.novafile.com/*
// @match        *://*.pixeldrain.com/*
// @match        *://*.premiumize.me/*
// @match        *://*.rapidgator.net/*
// @match        *://*.rg.to/*
// @match        *://*.real-debrid.com/*
// @match        *://*.sendspace.com/*
// @match        *://*.solidfiles.com/*
// @match        *://*.soundcloud.com/*
// @match        *://*.turbobit.net/*
// @match        *://*.tusfiles.com/*
// @match        *://*.uloz.to/*
// @match        *://*.ulozto.cz/*
// @match        *://*.ulozto.sk/*
// @match        *://*.uploadgig.com/*
// @match        *://*.upstore.net/*
// @match        *://*.uptobox.com/*
// @match        *://*.uptostream.com/*
// @match        *://*.userscloud.com/*
// @match        *://*.vimeo.com/*
// @match        *://*.vk.com/*
// @match        *://*.webshare.cz/*
// @match        *://*.wetransfer.com/*
// @match        *://*.youtube.com/*
// @match        *://youtu.be/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // Domains supported by PyLoad plugins
    const HOSTERS = [
        '1fichier.com',
        '4shared.com',
        'alfafile.net',
        'alldebrid.com',
        'alterupload.com',
        'clicknupload.com',
        'cloud.mail.ru',
        'debrid.it',
        'debrid.link',
        'depositfiles.com',
        'dfiles.eu',
        'dfiles.ru',
        'dl4free.com',
        'dropbox.com',
        'drive.google.com',
        'docs.google.com',
        'easyupload.io',
        'fboom.me',
        'fileboom.me',
        'filecloud.io',
        'filefactory.com',
        'filejoker.net',
        'fileom.com',
        'filerio.in',
        'fshare.vn',
        'gofile.io',
        'k2s.cc',
        'keep2share.cc',
        'krakenfiles.com',
        'linksnappy.com',
        'mega.nz',
        'mega.co.nz',
        'mediafire.com',
        'mp4upload.com',
        'nitro.download',
        'nitroflare.com',
        'novafile.com',
        'pixeldrain.com',
        'premiumize.me',
        'rapidgator.net',
        'rg.to',
        'real-debrid.com',
        'sendspace.com',
        'solidfiles.com',
        'soundcloud.com',
        'turbobit.net',
        'tusfiles.com',
        'uloz.to',
        'ulozto.cz',
        'ulozto.sk',
        'uploadgig.com',
        'upstore.net',
        'uptobox.com',
        'uptostream.com',
        'userscloud.com',
        'vimeo.com',
        'vk.com',
        'webshare.cz',
        'wetransfer.com',
        'youtube.com',
        'youtu.be',
    ];

    // ============================================================

    let stylesInjected = false;

    function injectStyles() {
        if (stylesInjected) return;
        stylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
            .yape-btn {
                display: inline-flex;
                align-items: center;
                gap: 3px;
                margin-left: 6px;
                padding: 2px 8px;
                font-size: 11px;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-weight: 600;
                line-height: 1.6;
                border: 1px solid #444;
                border-radius: 10px;
                background: #1e1e1e;
                color: #ddd;
                cursor: pointer;
                vertical-align: middle;
                white-space: nowrap;
                text-decoration: none !important;
                transition: background 0.15s, border-color 0.15s;
                user-select: none;
                box-sizing: border-box;
            }
            .yape-btn:hover:not(:disabled) { background: #2e2e2e; border-color: #666; }
            .yape-btn:disabled { opacity: 0.65; cursor: default; }
            .yape-btn[data-state="success"] { background: #1a5c1a; border-color: #2a8c2a; color: #fff; }
            .yape-btn[data-state="error"]   { background: #5c1a1a; border-color: #8c2a2a; color: #fff; }
        `;
        document.head.appendChild(style);
    }

    function createButton() {
        injectStyles();
        const btn = document.createElement('button');
        btn.className = 'yape-btn';
        btn.dataset.state = 'idle';
        btn.textContent = '↓ PyLoad';
        return btn;
    }

    function setState(btn, state, label) {
        btn.dataset.state = state;
        btn.disabled = (state === 'loading');
        const icons = { idle: '↓', loading: '⟳', success: '✓', error: '✗' };
        btn.textContent = `${icons[state]} ${label}`;
    }

    function sendToPyload(url, name, btn) {
        setState(btn, 'loading', 'Sending…');
        const timeout = setTimeout(() => {
            window.removeEventListener('message', onResponse);
            setState(btn, 'error', 'No extension');
            setTimeout(() => setState(btn, 'idle', 'PyLoad'), 3000);
        }, 5000);
        function onResponse(event) {
            if (event.source !== window || event.data?.type !== 'yape-add-package-response') return;
            if (event.data.url !== url) return;
            window.removeEventListener('message', onResponse);
            clearTimeout(timeout);
            if (event.data.success) {
                setState(btn, 'success', 'Added!');
            } else {
                setState(btn, 'error', event.data.error || 'Error');
            }
            setTimeout(() => setState(btn, 'idle', 'PyLoad'), 3000);
        }
        window.addEventListener('message', onResponse);
        window.postMessage({ type: 'yape-add-package', url, name }, '*');
    }

    function isHosterUrl(href) {
        try {
            const host = new URL(href).hostname.replace(/^www\./, '');
            return HOSTERS.some(h => host === h || host.endsWith(`.${h}`));
        } catch {
            return false;
        }
    }

    function injectButton(link) {
        if (link.dataset.yapeInjected) return;
        link.dataset.yapeInjected = '1';
        const url = link.href;
        const name = link.textContent.trim() || url.split('/').pop() || url;
        const btn = createButton();
        btn.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            sendToPyload(url, name, btn);
        };
        link.insertAdjacentElement('afterend', btn);
    }

    function scanLinks() {
        document.querySelectorAll('a[href]').forEach(link => {
            if (isHosterUrl(link.href)) injectButton(link);
        });
    }

    scanLinks();

    let scanTimer = null;
    new MutationObserver(function (mutations) {
        for (const m of mutations) {
            if (m.addedNodes.length) {
                if (scanTimer) clearTimeout(scanTimer);
                scanTimer = setTimeout(scanLinks, 200);
                return;
            }
        }
    }).observe(document.body, { childList: true, subtree: true });

})();

import { getHistory, getStats, clearHistory } from '../storage.js';
import { msg } from '../i18n.js';
import { HISTORY_DISPLAY_LIMIT, MAX_HOSTERS_DISPLAY } from '../constants.js';

const historyDiv = document.getElementById('historyDiv');
const statsDashboard = document.getElementById('statsDashboard');
const statsSummary = document.getElementById('statsSummary');
const statsHosterTable = document.getElementById('statsHosterTable');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

export function init() {
    clearHistoryBtn.onclick = function() {
        clearHistory(function() {
            updateHistoryView();
            updateStatsDashboard();
        });
    };
}

export function updateHistoryView(searchTerm) {
    getHistory(function(entries) {
        historyDiv.textContent = '';
        const reversed = entries.slice().reverse();
        const filtered = searchTerm
            ? reversed.filter(e => e.name.toLowerCase().includes(searchTerm))
            : reversed;

        if (!filtered.length) {
            const empty = document.createElement('div');
            empty.className = 'text-center m-4 text-muted';
            empty.textContent = msg('popupHistoryEmpty');
            historyDiv.appendChild(empty);
            return;
        }

        filtered.slice(0, HISTORY_DISPLAY_LIMIT).forEach(function(entry) {
            const row = document.createElement('div');
            row.className = 'd-flex align-items-center gap-1';
            row.style.cssText = 'margin-bottom: 6px; font-size: small';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'ellipsis flex-grow-1';
            nameDiv.textContent = entry.name;

            const badge = document.createElement('span');
            badge.className = entry.status === 'completed'
                ? 'badge bg-success'
                : 'badge bg-danger';
            badge.textContent = entry.status === 'completed'
                ? msg('popupHistoryCompleted')
                : msg('popupHistoryFailed');

            const speedSpan = document.createElement('span');
            speedSpan.className = 'text-muted';
            speedSpan.style.whiteSpace = 'nowrap';
            if (entry.speedAvg && entry.speedAvg > 0) {
                speedSpan.textContent = `${(entry.speedAvg / (1000 * 1000)).toFixed(1)} MB/s`;
            }

            const timeSpan = document.createElement('span');
            timeSpan.className = 'text-muted';
            timeSpan.style.cssText = 'white-space: nowrap; font-size: 10px';
            if (entry.timestamp) {
                const d = new Date(entry.timestamp);
                timeSpan.textContent = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            }

            row.appendChild(nameDiv);
            row.appendChild(speedSpan);
            row.appendChild(badge);
            row.appendChild(timeSpan);
            historyDiv.appendChild(row);
        });
    });
}

export function updateStatsDashboard() {
    getStats(function(stats) {
        const total = stats.totalDownloads || 0;
        const failures = stats.totalFailures || 0;
        const rate = total > 0 ? Math.round(((total - failures) / total) * 100) : 100;
        const peak = stats.peakSpeed || 0;
        const peakStr = peak > 0 ? `${(peak / (1000 * 1000)).toFixed(1)} MB/s` : '-';

        let summary = msg('popupStatsTotal', [String(total), String(failures)]);
        summary += ` (${msg('popupStatsRate', [String(rate)])})`;
        summary += ` | ${msg('popupStatsPeakSpeed', [peakStr])}`;
        statsSummary.textContent = summary;

        const byHoster = stats.byHoster || {};
        const hosters = Object.entries(byHoster).sort((a, b) => b[1].count - a[1].count);
        statsHosterTable.textContent = '';

        if (hosters.length > 0) {
            const table = document.createElement('table');
            table.className = 'table table-sm table-striped mb-0';
            table.style.fontSize = '11px';
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            ['Hoster', 'OK', 'Fail'].forEach(function(text, i) {
                const th = document.createElement('th');
                if (i > 0) th.className = 'text-end';
                th.textContent = text;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
            const tbody = document.createElement('tbody');
            hosters.slice(0, MAX_HOSTERS_DISPLAY).forEach(function([hoster, data]) {
                const tr = document.createElement('tr');
                const ok = data.count - data.failures;
                const tdName = document.createElement('td');
                tdName.className = 'ellipsis';
                tdName.style.maxWidth = '180px';
                tdName.textContent = hoster;
                const tdOk = document.createElement('td');
                tdOk.className = 'text-end';
                tdOk.textContent = ok;
                const tdFail = document.createElement('td');
                tdFail.className = 'text-end';
                tdFail.textContent = data.failures;
                tr.appendChild(tdName);
                tr.appendChild(tdOk);
                tr.appendChild(tdFail);
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            statsHosterTable.appendChild(table);
        }

        statsDashboard.hidden = false;
    });
}

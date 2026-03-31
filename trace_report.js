// ==UserScript==
// @name         trace report
// @namespace    http://tampermonkey.net/
// @version      2025-03-26
// @description  Optimized trace report with segmented time axis (Gantt-style) and visual duration bars
// @author       You
// @match        https://kibana.remarkablefoods.net/app/discover*
// @match        https://kibana.foodtruck-qa.com/app/discover*
// @match        https://kibana.foodtruck-uat.com/app/discover*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=remarkablefoods.net
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    const HIGH_DURATION_THRESHOLD_NS = 200000000; // 200ms

    const observer = new MutationObserver(function(mutations) {
        const titleElement = document.querySelector('div[data-test-subj="tableDocViewRow-content-value"]');
        if (titleElement) {
            addCopyButton(titleElement);
            observer.disconnect();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    function formatDuration(ns) {
        if (ns === null || ns === undefined) return '';
        const ms = ns / 1000000;
        if (ms >= 1000) {
            return (ms / 1000).toFixed(3) + 's';
        }
        return ms.toFixed(3) + 'ms';
    }

    /**
     * Converts the MM:SS.ns timestamp string to total nanoseconds for positioning
     */
    function parseTimestampToNs(tsStr) {
        if (!tsStr) return 0;
        const match = tsStr.match(/(\d{2}):(\d{2})\.(\d{9})/);
        if (!match) return 0;
        const mins = parseInt(match[1]);
        const secs = parseInt(match[2]);
        const ns = parseInt(match[3]);
        return (mins * 60 + secs) * 1000000000 + ns;
    }

    function processLogs(logString) {
        const lines = logString.split('\n');
        const groups = [];
        let currentGroup = null;
        const timestampRegex = /^\s*(\d{2}:\d{2}\.\d{9})/;

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine && !currentGroup) return;

            if (timestampRegex.test(line)) {
                if (currentGroup) groups.push(currentGroup);
                currentGroup = [line];
            } else if (currentGroup) {
                currentGroup.push(line);
            } else {
                currentGroup = [line];
            }
        });
        if (currentGroup) groups.push(currentGroup);
        
        let maxElapsed = 0;
        const processed = groups.map((group, index) => {
            const fullText = group.join('\n').trim();
            const timestampMatch = group[0].match(timestampRegex);
            const timestampStr = timestampMatch ? timestampMatch[1].trim() : '';
            const timestampNs = parseTimestampToNs(timestampStr);
            
            const elapsedMatch = fullText.match(/elapsed=(\d+)$/);
            const elapsedNs = elapsedMatch ? parseInt(elapsedMatch[1]) : null;
            if (elapsedNs > maxElapsed) maxElapsed = elapsedNs;
            
            let coreText = fullText;
            if (timestampStr) {
                const tsIndex = coreText.indexOf(timestampStr);
                coreText = coreText.substring(tsIndex + timestampStr.length).trim();
            }
            
            if (elapsedMatch) {
                const lastMarkerIndex = coreText.lastIndexOf(', elapsed=');
                if (lastMarkerIndex !== -1 && lastMarkerIndex > coreText.length - 50) {
                    coreText = coreText.substring(0, lastMarkerIndex).trim();
                } else {
                    const altMarkerIndex = coreText.lastIndexOf(' elapsed=');
                    if (altMarkerIndex !== -1 && altMarkerIndex > coreText.length - 50) {
                        coreText = coreText.substring(0, altMarkerIndex).trim();
                    }
                }
            }
            
            let logger = '';
            let content = coreText;
            const separatorIndex = coreText.indexOf(' - ');
            if (separatorIndex !== -1 && separatorIndex < 100) {
                logger = coreText.substring(0, separatorIndex).trim();
                content = coreText.substring(separatorIndex + 3).trim();
            }

            return {
                id: `log-row-${index}`,
                timestampStr,
                timestampNs,
                logger,
                content,
                elapsed: elapsedNs,
                formattedElapsed: formatDuration(elapsedNs)
            };
        });

        // Calculate relative positions for time axis
        if (processed.length > 0) {
            const startTime = processed[0].timestampNs;
            const endTime = processed[processed.length - 1].timestampNs;
            const totalTraceDuration = endTime - startTime || 1;
            
            processed.forEach(log => {
                log.relativePos = ((log.timestampNs - startTime) / totalTraceDuration) * 100;
                log.durationPercentOfMax = log.elapsed ? (log.elapsed / maxElapsed) * 100 : 0;
                log.durationPercentOfTotal = log.elapsed ? (log.elapsed / totalTraceDuration) * 100 : 0;
                // A segment starts at (timestamp - elapsed)
                log.segmentStartPos = log.elapsed ? (((log.timestampNs - log.elapsed) - startTime) / totalTraceDuration) * 100 : log.relativePos;
                if (log.segmentStartPos < 0) log.segmentStartPos = 0;
            });
        }

        return processed;
    }

    function buildReport(processedLogs) {
        let axisHtml = '<div id="trace-time-axis"><div id="axis-indicator"></div>';
        let tableHtml = `
            <div id="trace-table-container">
                <table id="trace-report-table">
                    <thead>
                        <tr>
                            <th class="col-elapsed">Duration</th>
                            <th class="col-time">Timestamp</th>
                            <th class="col-logger">Logger/Component</th>
                            <th class="col-message">Message</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        processedLogs.forEach(log => {
            const isHighDuration = log.elapsed > HIGH_DURATION_THRESHOLD_NS;
            
            // Build Time Axis Segments
            if (log.elapsed && log.durationPercentOfTotal > 0.1) {
                // If it's a very long block (like a summary log), we style it slightly differently or use a lower z-index
                const isSummary = log.durationPercentOfTotal > 95;
                const blockClass = isHighDuration ? 'time-block high' : 'time-block normal';
                const summaryClass = isSummary ? 'summary-block' : '';
                
                axisHtml += `
                    <div class="${blockClass} ${summaryClass}" 
                         style="top: ${log.segmentStartPos}%; height: ${log.durationPercentOfTotal}%" 
                         title="${log.formattedElapsed} [${log.logger}]"
                         data-target="${log.id}">
                    </div>`;
            } else {
                // For logs without duration or very small ones, just a marker
                axisHtml += `
                    <div class="time-marker" 
                         style="top: ${log.relativePos}%" 
                         title="${log.timestampStr}"
                         data-target="${log.id}">
                    </div>`;
            }
            
            tableHtml += `
                <tr id="${log.id}" data-pos="${log.relativePos}">
                    <td class="col-elapsed">
                        <div class="duration-container ${isHighDuration ? 'high-duration' : ''}">
                            <span class="${isHighDuration ? 'high-duration-text' : ''}">${log.formattedElapsed || ''}</span>
                            ${log.elapsed ? `<div class="duration-bar" style="width: ${log.durationPercentOfMax}%"></div>` : ''}
                        </div>
                    </td>
                    <td class="col-time">${escapeHtml(log.timestampStr)}</td>
                    <td class="col-logger" title="${escapeHtml(log.logger)}">${escapeHtml(log.logger)}</td>
                    <td class="col-message">${escapeHtml(log.content)}</td>
                </tr>
            `;
        });

        axisHtml += '</div>';
        tableHtml += '</tbody></table></div>';

        return `
            <div id="trace-report-header" style="margin: 20px 20px 0 20px; font-weight: bold; font-size: 18px; color: #0366d6; border-bottom: 2px solid #0366d6; padding-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
                <span>Trace Execution Report</span>
                <span style="font-size: 12px; font-weight: normal; color: #6a737d;">Click or Drag on left axis to navigate</span>
            </div>
            <div id="trace-report-wrapper">
                ${axisHtml}
                ${tableHtml}
            </div>
        `;
    }

    function injectStyles() {
        if (document.getElementById('trace-report-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'trace-report-styles';
        style.textContent = `
            #trace-report-wrapper {
                display: flex;
                margin: 0 20px 20px 20px;
                height: calc(90vh - 120px);
                background: #ffffff;
                border: 1px solid #e1e4e8;
                border-radius: 0 0 6px 6px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.12);
                overflow: hidden;
                font-family: 'Roboto Mono', Menlo, Monaco, Consolas, monospace;
            }
            #trace-time-axis {
                width: 40px;
                background: #f6f8fa;
                border-right: 1px solid #dfe2e5;
                position: relative;
                cursor: pointer;
                flex-shrink: 0;
            }
            .time-marker {
                position: absolute;
                left: 0;
                right: 0;
                height: 1px;
                background: #0366d6;
                opacity: 0.3;
                z-index: 1;
            }
            .time-block {
                position: absolute;
                left: 4px;
                right: 4px;
                border-radius: 2px;
                min-height: 2px;
                z-index: 2;
                transition: transform 0.1s;
            }
            .time-block:hover {
                transform: scaleX(1.1);
                z-index: 10;
            }
            .time-block.normal {
                background: #0366d6;
                opacity: 0.4;
            }
            .time-block.high {
                background: #d73a49;
                opacity: 0.8;
                box-shadow: 0 0 2px rgba(215, 58, 73, 0.5);
            }
            .summary-block {
                left: 0 !important;
                right: 0 !important;
                opacity: 0.1 !important;
                z-index: 0 !important;
                border-radius: 0;
            }
            #axis-indicator {
                position: absolute;
                left: 0;
                right: 0;
                height: 2px;
                background: #24292e;
                border: 1px solid white;
                z-index: 20;
                pointer-events: none;
                box-shadow: 0 0 4px rgba(0,0,0,0.3);
            }
            #trace-table-container {
                flex-grow: 1;
                overflow-y: auto;
                scroll-behavior: smooth;
            }
            #trace-report-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 11px;
                table-layout: fixed;
            }
            #trace-report-table th {
                background: #f6f8fa;
                padding: 8px 12px;
                border: 1px solid #dfe2e5;
                position: sticky;
                top: 0;
                z-index: 100;
                text-align: left;
            }
            #trace-report-table td {
                padding: 4px 12px;
                border: 1px solid #dfe2e5;
                vertical-align: top;
                word-break: break-all;
            }
            .duration-container {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
            }
            .duration-bar {
                height: 3px;
                background: #0366d6;
                opacity: 0.4;
                margin-top: 2px;
            }
            .high-duration .duration-bar {
                background: #d73a49;
                opacity: 0.8;
                height: 4px;
            }
            .high-duration-text { color: #d73a49; font-weight: bold; }
            .col-elapsed { width: 90px; text-align: right; }
            .col-time { width: 120px; color: #6a737d; }
            .col-logger { width: 180px; color: #005cc5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .col-message { white-space: pre-wrap; color: #24292e; }
            #trace-report-table tr:hover { background-color: #f1f8ff; }
            #trace-report-table tr.active-step { background-color: #fffbdd; outline: 1px solid #e2cc33; }
        `;
        document.head.appendChild(style);
    }

    function setupInteractions() {
        const axis = document.getElementById('trace-time-axis');
        const container = document.getElementById('trace-table-container');
        const indicator = document.getElementById('axis-indicator');
        const rows = Array.from(document.querySelectorAll('#trace-report-table tbody tr'));

        if (!axis || !container) return;

        let isDragging = false;
        
        const handleInteraction = (e) => {
            const rect = axis.getBoundingClientRect();
            let y = e.clientY - rect.top;
            y = Math.max(0, Math.min(y, rect.height));
            const percent = (y / rect.height) * 100;
            
            // Find closest row
            let closestRow = rows[0];
            let minDiff = 100;
            
            rows.forEach(row => {
                const rowPos = parseFloat(row.dataset.pos);
                const diff = Math.abs(rowPos - percent);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestRow = row;
                }
            });

            closestRow.scrollIntoView({ block: 'center' });
            highlightRow(closestRow);
        };

        axis.addEventListener('mousedown', (e) => {
            isDragging = true;
            handleInteraction(e);
        });

        window.addEventListener('mousemove', (e) => {
            if (isDragging) handleInteraction(e);
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Update indicator on scroll
        container.addEventListener('scroll', () => {
            if (isDragging) return;
            const containerRect = container.getBoundingClientRect();
            // Find the row currently at the top of the viewport
            const topRow = rows.find(row => {
                const rowRect = row.getBoundingClientRect();
                return rowRect.top >= containerRect.top;
            }) || rows[0];

            indicator.style.top = `${topRow.dataset.pos}%`;
        });

        function highlightRow(row) {
            rows.forEach(r => r.classList.remove('active-step'));
            row.classList.add('active-step');
        }
    }

    function addCopyButton(titleElement) {
        injectStyles();
        
        const existing = document.getElementById('trace-report-wrapper-container');
        if (existing) existing.remove();
        
        const wrapperContainer = document.createElement('div');
        wrapperContainer.id = 'trace-report-wrapper-container';
        
        const logs = processLogs(titleElement.textContent);
        wrapperContainer.innerHTML = buildReport(logs);
        
        document.body.appendChild(wrapperContainer);
        setupInteractions();
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        const titleElement = document.querySelector('div[data-test-subj="tableDocViewRow-content-value"]');
        if (titleElement) {
            addCopyButton(titleElement);
        }
    }
})();

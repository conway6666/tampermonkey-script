// ==UserScript==
// @name         trace report
// @namespace    http://tampermonkey.net/
// @version      2025-03-26
// @description  try to take over the world!
// @author       You
// @match        https://kibana.remarkablefoods.net/app/discover*
// @match        https://kibana.foodtruck-qa.com/app/discover*
// @match        https://kibana.foodtruck-uat.com/app/discover*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=remarkablefoods.net
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    // 创建一个MutationObserver来监听DOM变化
    const observer = new MutationObserver(function(mutations) {
        // 检查目标元素是否已加载
        const titleElement = document.querySelector('div[data-test-subj="tableDocViewRow-content-value"]');
        if (titleElement) {
            // 如果找到目标元素且按钮尚未添加，则添加按钮
            addCopyButton(titleElement);
            // 找到元素后停止观察
            observer.disconnect();
        }
    });

    // 开始观察文档变化
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    /**
     * Escape HTML special characters
     */
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

    /**
     * Format nanoseconds to a human-readable duration (ms or s)
     */
    function formatDuration(ns) {
        if (ns === null || ns === undefined) return '';
        const ms = ns / 1000000;
        if (ms >= 1000) {
            return (ms / 1000).toFixed(3) + 's';
        }
        return ms.toFixed(3) + 'ms';
    }

    /**
     * Process log strings into structured data objects
     * @param {string} logString - The input log string with multiple lines
     * @return {Array} - Array of parsed log objects
     */
    function processLogs(logString) {
        const lines = logString.split('\n').filter(line => line.trim());
        
        return lines.map(line => {
            // Extract relative timestamp (e.g., 00:00.001179021)
            const timestampMatch = line.match(/^(\d{2}:\d{2}\.\d{9})/);
            const timestamp = timestampMatch ? timestampMatch[1] : '';
            
            // Extract elapsed time (e.g., elapsed=927217)
            const elapsedMatch = line.match(/elapsed=(\d+)$/);
            const elapsedNs = elapsedMatch ? parseInt(elapsedMatch[1]) : null;
            
            // Extract the core message part
            let coreMessage = line;
            if (timestamp) {
                coreMessage = coreMessage.substring(timestamp.length).trim();
            }
            if (elapsedMatch) {
                const elapsedIndex = coreMessage.lastIndexOf(', elapsed=');
                if (elapsedIndex !== -1) {
                    coreMessage = coreMessage.substring(0, elapsedIndex).trim();
                } else {
                    const altElapsedIndex = coreMessage.lastIndexOf(' elapsed=');
                    if (altElapsedIndex !== -1) {
                        coreMessage = coreMessage.substring(0, altElapsedIndex).trim();
                    }
                }
            }
            
            // Split logger and actual message if possible (looking for ' - ')
            let logger = '';
            let content = coreMessage;
            const separatorIndex = coreMessage.indexOf(' - ');
            if (separatorIndex !== -1) {
                logger = coreMessage.substring(0, separatorIndex).trim();
                content = coreMessage.substring(separatorIndex + 3).trim();
            }

            return {
                timestamp,
                logger,
                content,
                elapsed: elapsedNs,
                formattedElapsed: formatDuration(elapsedNs)
            };
        });
    }

    /**
     * Build an HTML table from processed logs
     */
    function buildReportTable(processedLogs) {
        let html = `
            <div id="trace-report-container">
                <div class="report-header">Trace Execution Report</div>
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
            const isHighDuration = log.elapsed > 500000000; // > 0.5s (500ms)
            html += `
                <tr>
                    <td class="col-elapsed ${isHighDuration ? 'high-duration' : ''}">${log.formattedElapsed || ''}</td>
                    <td class="col-time">${escapeHtml(log.timestamp)}</td>
                    <td class="col-logger">${escapeHtml(log.logger)}</td>
                    <td class="col-message">${escapeHtml(log.content)}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
        return html;
    }

    /**
     * Inject necessary CSS styles
     */
    function injectStyles() {
        if (document.getElementById('trace-report-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'trace-report-styles';
        style.textContent = `
            #trace-report-container {
                margin: 20px;
                padding: 15px;
                background: #ffffff;
                border: 1px solid #e1e4e8;
                border-radius: 6px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
                font-family: 'Roboto Mono', Menlo, Monaco, Consolas, monospace;
                color: #24292e;
            }
            .report-header {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 2px solid #0366d6;
                color: #0366d6;
            }
            #trace-report-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
                line-height: 1.5;
            }
            #trace-report-table th {
                background: #f6f8fa;
                color: #586069;
                text-align: left;
                padding: 8px 12px;
                border: 1px solid #dfe2e5;
                font-weight: 600;
                position: sticky;
                top: 0;
            }
            #trace-report-table td {
                padding: 6px 12px;
                border: 1px solid #dfe2e5;
                vertical-align: top;
            }
            #trace-report-table tr:nth-child(even) {
                background-color: #f8f9fa;
            }
            #trace-report-table tr:hover {
                background-color: #f1f8ff;
            }
            .col-elapsed { 
                width: 100px; 
                text-align: right !important;
            }
            .high-duration {
                color: #d73a49;
                font-weight: bold;
                background-color: #fffbdd;
            }
            .col-time { width: 140px; color: #6a737d; }
            .col-logger { width: 220px; color: #005cc5; }
            .col-message { min-width: 400px; white-space: pre-wrap; word-break: break-all; }
        `;
        document.head.appendChild(style);
    }

    // 函数：添加复制按钮
    function addCopyButton(titleElement) {
        injectStyles();
        
        // 创建报告容器
        const reportContainer = document.createElement('div');
        reportContainer.id = 'copy-title-button';
        
        const logs = processLogs(titleElement.textContent);
        reportContainer.innerHTML = buildReportTable(logs);
        
        // 将报告添加到页面底部或标题元素旁边
        // 如果已经存在，先移除
        const existing = document.getElementById('copy-title-button');
        if (existing) existing.remove();
        
        document.body.appendChild(reportContainer);
    }

    // 检查页面是否已经加载完毕
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        const titleElement = document.querySelector('div[data-test-subj="tableDocViewRow-content-value"]');
        if (titleElement) {
            addCopyButton(titleElement);
        }
    }
})();
// ==UserScript==
// @name         Copy Jira Issue Title
// @namespace    http://tampermonkey.net/
// @version      2025-03-24
// @description  Copy Jira Issue Id and Title
// @author       conway
// @match        https://wonder.atlassian.net/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=atlassian.net
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
   // 创建一个MutationObserver来监听DOM变化
    const observer = new MutationObserver(function(mutations) {
        // 检查目标元素是否已加载
        const titleElement = document.querySelector('a[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]');
        if (titleElement && !document.getElementById('copy-title-button')) {
            // 如果找到目标元素且按钮尚未添加，则添加按钮
            addCopyButton(titleElement);
            // 找到元素后停止观察
            //observer.disconnect();
        }
    });

    // 开始观察文档变化
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 函数：添加复制按钮
    function addCopyButton(titleElement) {
        // 创建按钮元素
        const copyButton = document.createElement('button');
        copyButton.id = 'copy-title-button';
        copyButton.textContent = 'Copy Title';

        // 为按钮添加事件监听器
        copyButton.addEventListener('click', function() {
            // 获取标题文本
            const titleText = titleElement.textContent.trim() + ": " + document.querySelector('h1[data-testid="issue.views.issue-base.foundation.summary.heading"]').textContent.trim();

            // 复制到剪贴板
            navigator.clipboard.writeText(titleText).then(function() {
                // 复制成功，临时改变按钮文字和样式
                const originalText = copyButton.textContent;
                copyButton.textContent = 'Copied Title!';
                copyButton.style.backgroundColor = '#2ea44f';
                copyButton.style.color = 'white';

                // 1.5秒后恢复按钮原样
                setTimeout(function() {
                    copyButton.textContent = originalText;
                    copyButton.style.backgroundColor = '#f6f8fa';
                    copyButton.style.color = 'initial';
                }, 1500);
            }).catch(function(err) {
                console.error('复制失败:', err);
                copyButton.textContent = '✗ 复制失败';
                copyButton.style.backgroundColor = '#cb2431';
                copyButton.style.color = 'white';

                setTimeout(function() {
                    copyButton.textContent = '复制标题';
                    copyButton.style.backgroundColor = '#f6f8fa';
                    copyButton.style.color = 'initial';
                }, 1500);
            });
        });

        // 将按钮添加到标题元素旁边
        titleElement.parentNode.parentNode.parentNode.appendChild(copyButton);
    }

    // 检查页面是否已经加载完毕
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        const titleElement = document.querySelector('a[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]');
        if (titleElement) {
            addCopyButton(titleElement);
        }
    }
})();

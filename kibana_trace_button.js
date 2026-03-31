// ==UserScript==
// @name         Add trace log link
// @namespace    http://tampermonkey.net/
// @version      2025-03-10
// @description  Adds a button to action log page to redirect to trace log page
// @author       conway
// @match        https://kibana.foodtruck-qa.com/app/discover*
// @match        https://kibana.foodtruck-uat.com/app/discover*
// @match        https://kibana.remarkablefoods.net/app/discover*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function addTraceButton() {
        try {
            // 1. Detect if the doc viewer flyout is open
            const flyout = document.querySelector('[data-test-subj="docViewerFlyout"]');
            if (!flyout) return;

            // 2. Extract Index and ID from the flyout content
            const indexElem = flyout.querySelector('#tableDocViewRow-_index-value');
            const idElem = flyout.querySelector('#tableDocViewRow-_id-value');

            if (!indexElem || !idElem) return;

            const indexName = indexElem.innerText.trim();
            const docId = idElem.innerText.trim();


            // We only care if it's an action log index
            if (!indexName.startsWith('action-')) {
                // Remove existing button if we switched to a non-action document
                const existing = flyout.querySelector('.trace-log-link-added');
                if (existing) existing.remove();
                return;
            }

            // 3. Construct Trace URL
            const baseUrl = window.location.origin;
            const traceUrl = `${baseUrl}/app/discover#/doc/trace-pattern/trace-*?id=${docId}`;

            // 4. Check if we already added our button
            const existingLink = flyout.querySelector('.trace-log-link-added-anchor');
            if (existingLink) {
                // If it exists but the ID is old, update it
                if (existingLink.href !== traceUrl) {
                    existingLink.href = traceUrl;
                }
                return;
            }

            // 5. Find injection point
            const actionsContainer = flyout.querySelector('[data-test-subj="docViewerFlyoutActions"]');
            const breadcrumbList = flyout.querySelector('.euiBreadcrumbs__list');

            if (!actionsContainer && !breadcrumbList) return;

            // 6. Create and inject the button
            const listItem = document.createElement('li');
            listItem.className = 'euiBreadcrumb trace-log-link-added';

            const link = document.createElement('a');
            link.className = 'euiLink euiBreadcrumb__content trace-log-link-added-anchor';
            link.href = traceUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.title = 'Trace Log';
            link.innerText = 'Trace Log';
            link.style.color = '#006BB8';
            link.style.fontWeight = 'bold';
            link.style.marginLeft = '10px';

            if (breadcrumbList) {
                listItem.appendChild(link);
                breadcrumbList.appendChild(listItem);
            } else if (actionsContainer) {
                const actionItem = document.createElement('div');
                actionItem.className = 'euiFlexItem css-kpsrin-euiFlexItem-growZero trace-log-link-added';
                link.className = 'euiButtonEmpty euiButtonDisplay-euiButtonEmpty-s-empty-primary trace-log-link-added-anchor';
                actionItem.appendChild(link);
                actionsContainer.appendChild(actionItem);
            }

        } catch (error) {
            console.error('Error adding trace button:', error);
        }
    }

    // Observer to watch for flyout appearance or content changes
    const observer = new MutationObserver(() => {
        addTraceButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Fallback interval
    setInterval(addTraceButton, 1000);
})();

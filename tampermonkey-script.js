/**
 * @name         Kibana Action to Trace Log Redirect
 * @namespace    http://tampermonkey.net/
 * @version      0.1
 * @description  Adds a button to action log page to redirect to trace log page
 * @author       You
 * @match        https://kibana.foodtruck-qa.com/app/discover#/doc/action-pattern/*
 * @grant        none
 */

(function() {
    'use strict';

    // Function to create and insert the li element
    function addListItem() {
        try {
            // Find the location to insert the li element
            const breadcrumbList = document.querySelector('.euiBreadcrumbs__list');
            if (!breadcrumbList) throw new Error('Breadcrumb list element not found');

            // Create the li element
            const listItem = document.createElement('li');
            listItem.className = 'euiBreadcrumb css-ojwi9r-euiBreadcrumb-application-isTruncated';
            listItem.setAttribute('data-test-subj', 'euiBreadcrumb');

            // Create the a tag inside li
            const link = document.createElement('a');
            link.className = 'euiLink euiBreadcrumb__content css-gdu3j7-euiLink-subdued-euiBreadcrumb__content-application-isTruncated-firstChild';
            link.href = '#';
            link.rel = 'noreferrer';
            link.setAttribute('data-test-subj', 'breadcrumb breadcrumb-deepLinkId-discover first');
            link.title = 'Trace Log';
            link.innerText = 'Trace Log';

            // Add event listener to the a tag
            link.addEventListener('click', (event) => {
                event.preventDefault();
                try {
                    const currentUrl = window.location.href;
                    const traceUrl = currentUrl.replace('/action-pattern/', '/trace-pattern/');
                    window.location.href = traceUrl;
                } catch (error) {
                    alert('Error constructing trace log URL: ' + error.message);
                }
            });

            // Append the a tag to the li element
            listItem.appendChild(link);

            // Insert the li element into the breadcrumb list
            breadcrumbList.appendChild(listItem);
        } catch (error) {
            alert('Error adding list item: ' + error.message);
        }
    }

    // Wait for the page to load before adding the li element
    window.addEventListener('load', addListItem);
})();

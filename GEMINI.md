# Tampermonkey Scripts

A collection of Tampermonkey (UserScript) utilities designed to enhance productivity on Jira and Kibana platforms.

## Project Overview

This repository contains standalone JavaScript files that can be installed as Tampermonkey scripts. These scripts automate repetitive tasks and improve the user interface of common tools used in the development workflow.

### Main Scripts

- **`copy-jira-issue-title.js`**: Adds a "Copy Title" button to Jira issue pages. It copies the issue ID and summary in a formatted string (e.g., `PROJ-123: Issue Summary`).
- **`kibana_trace_button.js`**: Adds a "Trace Log" link to Kibana's breadcrumbs when viewing action logs, allowing quick navigation between action and trace patterns.
- **`trace_report.js`**: Enhances Kibana log views by processing log strings, aligning suffixes (like elapsed time), and displaying a formatted report directly on the page.

## Technologies

- **JavaScript (ES6+)**: Core logic for all scripts.
- **Tampermonkey/Greasemonkey**: The userscript manager platform.
- **DOM Manipulation**: Extensive use of `MutationObserver` and `querySelector` to interact with dynamic web applications (Jira/Kibana).

## Installation and Usage

### Prerequisites

1.  Install the [Tampermonkey extension](https://www.tampermonkey.net/) for your browser (Chrome, Firefox, Safari, etc.).

### How to Install a Script

1.  Click on the raw file of the script you want to install in this repository (e.g., `copy-jira-issue-title.js`).
2.  Copy the entire content of the file.
3.  Open the Tampermonkey Dashboard in your browser.
4.  Click the "Utilities" tab.
5.  Under "Import from URL" or "File", you can also choose to "Create a new script" (+ icon).
6.  Paste the code into the editor and press `Ctrl+S` (or `Cmd+S`) to save.

### Usage

- **Jira**: Navigate to any Jira issue. Look for the "Copy Title" button near the breadcrumbs.
- **Kibana**: Navigate to Kibana discover pages. The scripts will automatically activate based on the `@match` rules defined in their headers.

## Development Conventions

- **UserScript Header**: Every script must start with a valid `==UserScript==` block containing metadata like `@name`, `@match`, and `@grant`.
- **IIFE Pattern**: Scripts should be wrapped in an Immediately Invoked Function Expression (IIFE) to avoid polluting the global namespace.
- **DOM Resilience**: Since Jira and Kibana are Single Page Applications (SPAs), use `MutationObserver` to detect when elements are added to the DOM dynamically.
- **Strict Mode**: Use `'use strict';` at the top of the function body.

## TODO / Future Improvements

- [ ] Add a build system (e.g., Webpack or Rollup) to allow for shared modules between scripts.
- [ ] Implement unit tests for complex logic like the log processor in `trace_report.js`.
- [ ] Standardize the UI components (buttons, labels) used across different scripts.

# Account Note Privacy Policy

Last updated: 2026-10-10

Account Note is a browser extension for managing account notes locally. This policy explains what information the extension handles and when it makes network requests.

## Information stored locally

The extension stores user-created notes and their associated website domains, usernames, tags, favorite state, manual field anchors, and preferences in the browser's `chrome.storage.local`. It does not read or store passwords.

## Network requests and sharing

- Account Note does not upload note content, usernames, passwords, or settings to a developer server. It has no cloud sync, advertising, or analytics service.
- The management page requests `/favicon.ico` from saved websites to display their icons. The request goes to the corresponding website, which may receive the domain, IP address, and ordinary request metadata. It does not include note content.
- When you choose to open the GitHub changelog or support page, your browser visits GitHub and GitHub's own privacy policy applies.

Core note storage and form detection run locally in the browser. Network access is used for site icons and external support pages.

## Extension permissions and page access

- `storage`: saves notes and preferences in the browser.
- `activeTab`: supports extension actions initiated on the active tab.
- The manifest configures the content script to match `<all_urls>` so it can locally identify account fields and display matching notes on webpages. Form contents are not uploaded as a result.

## Deleting data

Users can delete notes or clear extension data in the management page. Uninstalling the extension also removes its local data. Users choose where exported backup files are saved and manage those files themselves.

## Contact

For privacy questions or suggestions, open an issue in the [Account Note GitHub repository](https://github.com/hjweix/account-note).

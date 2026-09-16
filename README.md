# Account Note

A browser extension that helps you add and manage notes for your online accounts. Your note appears right next to the login form, so you always know which account is which — and all notes are managed in one place.

[中文文档](./README_zh.md)

## Features

- **Smart Detection**: A scoring-based engine locks onto the account field using keywords, form structure, and input attributes — zero configuration needed
- **Manual Anchoring**: For fields the engine can't identify (multi-step logins, delayed rendering), pick the field once and it's remembered forever
- **Quick Notes**: The note card pops up as soon as you focus the account field; click the text to edit, press Enter to save
- **Scoped to the Site**: Notes follow the *website*, not the exact URL — a note written on the login subdomain shows on the main site, while sibling environments (uat / dev / prod) stay separate by default. Adjustable per site in the management page
- **Tag Organization**: Add tags inline and filter notes by tag
- **Favorites**: Star important accounts for quick access
- **Search & Filter**: Find notes by website, username, tag, or content; sortable
- **Safe Deletion**: Deleted notes stay in a trash for 7 days and can be undone anytime — batch deletion included
- **Data Backup**: One-click JSON export / import, including tags, theme, and anchor settings
- **Do-not-Disturb Controls**: Disable per session / per site / globally, one hover away
- **Native Feel**: Chrome-style native UI, automatic light/dark theme, English & Chinese
- **Secure Storage**: All data stays in your browser; passwords are never touched

## Installation

### Chrome Web Store

1. Visit [Chrome Web Store](https://chrome.google.com/webstore)
2. Search for "Account Note"
3. Click "Add to Chrome"

### Manual Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist` folder

## Usage

### Adding Notes

1. Focus the account field on a login page (or click "Add a note on the page" in the toolbar popup)
2. A note card appears to the right of the field
3. Click the card text to type, press Enter to save, Esc to cancel
4. Click "＋ tag" to tag this account

### Viewing & Managing

- Focus the same account field again and the note card appears automatically
- Click the toolbar icon: view all notes for the current site, favorite, edit, or pick a field manually
- Management page: notes grouped by site (same-site accounts together), with search, sort, tag filters, batch deletion, and a live counter
- Deleted notes stay in the trash for 7 days — click "Undo" in the toast to restore

### Do-not-Disturb Controls

- Hover the ⚙ icon on the note card: disable for this session / this site / all sites
- Click ✕ to dismiss the card for now
- Disabled state can be restored anytime from the management page or the toolbar popup

## Privacy & Security

- All data is stored locally in your browser
- No data is uploaded to any server
- Notes are associated only with websites and usernames
- Passwords are never read or stored

## Development

```bash
# Install dependencies
npm install

# Start development mode
npm run watch

# Build for production
npm run build

# Quality gates
npm run check:css   # content-script CSS scope-leak check
npm run check:i18n  # locale key consistency (en / zh_CN)
```

## Project Structure

```
project/
├── src/          # Source files
├── dist/         # Compiled files (load the extension from here)
├── icons/        # Extension icons
└── document/     # Documentation
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License

## Support

If you encounter any issues or have suggestions, please [open an issue](https://github.com/hjweix/account-note/issues).

# Account Note

A browser extension that helps you add and manage notes for your online accounts. Quickly add notes to any login form, and manage all your account notes in one place.

[中文文档](./README_zh.md)

## Features

- **Smart Detection**: Automatically identifies password fields and account fields on web pages
- **Quick Notes**: Add notes directly to any login form with one click
- **Tag Organization**: Categorize notes with custom tags for easy filtering
- **Favorites**: Mark important notes as favorites for quick access
- **Search & Filter**: Find notes by website, username, tag, or content
- **Secure Storage**: All data is stored locally in your browser
- **Responsive Design**: Works great on any screen size

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

1. Click on any input field on a login page
2. A note icon will appear next to the field
3. Click the icon to add or edit notes
4. Press Enter to save, Esc to cancel

### Managing Notes

- Click the extension icon in the browser toolbar to view notes for the current site
- Use the management page to view and organize all your notes
- Search by website, username, or content
- Filter by tags or favorites
- Batch select and delete notes as needed

## Privacy & Security

- All data is stored locally in your browser
- No data is uploaded to any server
- Notes are associated only with websites and usernames
- No passwords are ever stored or accessed

## Development

```bash
# Install dependencies
npm install

# Start development mode
npm run watch

# Build for production
npm run build
```

## Project Structure

```
project/
├── src/          # Source files
├── dist/         # Compiled files
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

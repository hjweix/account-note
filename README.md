# Account Note

A browser extension that enhances your Account management experience by allowing you to add and manage notes for your Account.

[中文文档](./README_zh.md)

## Features

- 🔍 Smart Detection: Automatically identifies password fields and usernames
- 📝 Quick Notes: Add notes directly next to password fields
- 🔒 Secure Storage: All data is stored locally for maximum security
- 📱 Easy Management: Centralized management of all your password notes
- 🎯 Precise Association: Notes are bound to specific sites and usernames
- 🔍 Quick Search: Search by website, username, or note content

## Installation

### Chrome Web Store
1. Visit [Chrome Web Store](https://chrome.google.com/webstore)
2. Search for "Account Note"
3. Click "Add to Chrome"

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist` folder

## Usage

### Adding Notes
1. Click on any password field
2. A note icon will appear next to the field
3. Click the icon to add or edit notes
4. Press Enter to save or Esc to cancel

### Managing Notes
- Click the extension icon in toolbar to view site notes
- Use the management page to view and organize all notes
- Search notes by website, username, or content
- Batch select and delete notes as needed

## Privacy & Security

- All data is stored locally in your browser
- No data is uploaded to any server
- Notes are associated with websites and usernames only
- No passwords are ever stored or accessed

## Development

### Setup
```bash
# Install dependencies
npm install

# Start development mode
npm run watch

# Build for production
npm run build
```

### Project Structure
```
project/
├── src/          # Source files
├── dist/         # Compiled files
├── icons/        # Extension icons
└── docs/         # Documentation
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to all contributors who have helped with this project
- Special thanks to the open source community

## Support

If you encounter any issues or have suggestions, please [open an issue](https://github.com/yourusername/AccountNote/issues).


# Account Note

A browser extension that enhances your Account management experience by allowing you to add and manage notes for your Account.

[中文文档](./README_zh.md)

## 🚀 Version 1.1.0 - Data Migration & Feature Enhancement

**Latest Release:** v1.1.0 (April 2026)
**Key Feature:** 🔄 Automatic Data Migration Support

> **Important:** Version 1.1.0 includes automatic data migration for existing users. All your existing notes will be automatically upgraded to the new format when you first open the management page after updating. **No data loss, no manual action required!**

### ✨ What's New in v1.1.0

- 🔄 **Automatic Data Migration**: Seamlessly upgrades data from older versions
- 🏷️ **Tag Support**: Add tags to organize your notes better
- ⭐ **Favorites**: Mark important notes as favorites
- 🔍 **Enhanced Filtering**: Filter by tags and favorites
- 🎨 **Compact Design**: Improved card layout with avatars
- 📱 **Better Responsive Design**: Optimized for all screen sizes

## Features

- 🔍 Smart Detection: Automatically identifies password fields and usernames
- 📝 Quick Notes: Add notes directly next to password fields
- 🔒 Secure Storage: All data is stored locally for maximum security
- 📱 Easy Management: Centralized management of all your password notes
- 🎯 Precise Association: Notes are bound to specific sites and usernames
- 🔍 Quick Search: Search by website, username, or note content
- 🏷️ Tag Organization: Categorize notes with custom tags
- ⭐ Favorite System: Mark important notes for quick access

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
- Filter notes by tags or favorite status
- Batch select and delete notes as needed

### Using Tags
- Click "+ Tag" button in the note popup to add tags
- Tags help you categorize and find notes quickly
- Filter notes by tag in the management page

### Marking as Favorite
- Click the star icon in note popup or management page
- Access all favorite notes using the favorite filter

## Data Migration (v1.1.0)

### For Existing Users
When you upgrade to v1.1.0:
1. Open the management page
2. The system will automatically migrate your existing notes
3. All notes will be upgraded to include tags and favorites
4. **No action required on your part!**

### What Gets Migrated
- ✅ Tags field (empty array for existing notes)
- ✅ isFavorite field (false for existing notes)
- ✅ favoriteTime field (null for existing notes)
- ✅ All existing data remains unchanged

### Compatibility
- Backward compatible with all previous versions
- Forward compatible with new features
- Zero data loss guaranteed

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

### Building for Production
```bash
npm run build
```

The compiled files will be in the `dist/` directory.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Version History

### v1.1.0 (April 2026)
- ✨ Added automatic data migration for existing users
- 🏷️ Added tag support for notes
- ⭐ Added favorite system
- 🔍 Enhanced filtering (by tags and favorites)
- 🎨 Compact card design with avatars
- 📱 Improved responsive design

### v1.0.0 (January 2025)
- 🎯 Initial release
- 🔍 Smart password field detection
- 📝 Quick note adding
- 🔒 Secure local storage
- 📱 Management interface

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to all contributors who have helped with this project
- Special thanks to the open source community

## Support

If you encounter any issues or have suggestions, please [open an issue](https://github.com/yourusername/AccountNote/issues).

---

**Note:** This extension respects your privacy. All data stays on your device.


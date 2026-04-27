# Account Note - Extension Verification Guide

## Basic Information

- Extension Name: Account Note
- Version: 1.1.0
- Purpose: Account Note Management Tool

## Test Accounts

No specific test accounts are required. This extension can be tested on any website with a login form, such as:

1. https://github.com/login
2. https://accounts.google.com
3. Any login page containing a login form

## Functional Testing Steps

### 1. Adding Notes

1. Visit any login page
2. Enter any text in the username input field
3. Enter username in the login form
4. Click the note button that appears and enter note information
5. Press Enter to save

### 2. Viewing and Editing Notes

1. Click the extension icon in the browser toolbar
2. View all notes for the current website
3. Click the edit button next to a note to modify its content
4. Click "Manage Notes" to enter the management page

### 3. Management Page Features

1. Search Function: Enter keywords in the top search box
2. Sort Function: Use the sort dropdown menu to choose sorting method
3. Batch Operations:
   - Click the "Select" button to enter selection mode
   - Use checkboxes to select notes
   - Click the "Delete" button to delete selected notes
4. Settings Tab:
   - Manage disabled sites list
   - View and manage extension settings
   - Access about information

### 4. Disable Options

1. Session Disable: Disable the extension for the current session only
2. Site Disable: Disable the extension for the current website
3. Global Disable: Disable the extension for all websites

## Special Notes

1. Data Storage:

   - All data is stored locally in the browser
   - Uses chrome.storage.local API
   - No network connection required
2. Permission Details:

   - storage: For local data storage
   - activeTab: For identifying login forms on current page
   - tabs: For displaying website information in management page
3. Privacy Protection:

   - Does not collect any user data
   - Does not interfere with login process
   - No online services required

## Dependency Information

- No third-party dependencies
- No additional services or APIs required
- Completely offline operation

## Testing Recommendations

1. Test adding notes on multiple different login pages
2. Verify that notes are correctly associated with specific websites and usernames
3. Test batch operations and search functionality
4. Confirm that data persists after browser restart
5. Test all three disable options and verify they work as expected

## Contact Information

For any questions or additional information, please contact:
[hwacer@outlook.com]

# Access Manager - Chrome Extension

Access Manager is a powerful Chrome extension that helps you track and manage access to your shared resources across multiple platforms like Google Drive, Notion, Miro, and Luma.

## Features

- **Automatic Access Tracking**: Detects when you share files or grant access
- **Unified Dashboard**: View all shared accesses in one place
- **Smart Filtering**: Filter by platform, access level, user, and date
- **Access Management**: Quickly see who has access to your resources
- **Freemium Model**: Basic features for free, advanced features for premium users

## Supported Platforms

- Google Workspace (Drive, Docs, Sheets, etc.)
- Notion
- Miro
- Luma

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the extension directory

## Development

### Project Structure

- `background.js` - Background script for monitoring sharing activities
- `content.js` - Content script that runs on supported websites
- `popup.html` - Main dashboard interface
- `popup.js` - Logic for the dashboard
- `popup.css` - Styles for the dashboard
- `manifest.json` - Extension configuration
- `icons/` - Extension icons in various sizes

### Building

1. Make your changes to the source files
2. Test the extension by loading it in Chrome
3. When ready, zip the files for distribution

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

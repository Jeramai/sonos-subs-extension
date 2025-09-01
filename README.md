# Sonos Subs

A browser extension that enhances the Sonos Web App by displaying song lyrics and adding helpful features.

## Features

- 🎵 **Real-time Lyrics Display** - Shows synchronized lyrics with karaoke-style highlighting
- 🔊 **Volume Control** - Scroll wheel volume adjustment on sliders
- 🎮 **Media Session Integration** - Control playback from browser/OS media controls
- 🖼️ **Picture-in-Picture** - Display album artwork in a floating window
- 🔔 **Desktop Notifications** - Get notified when songs change
- ⚙️ **Customizable Settings** - Adjust font size and toggle features

## Installation

### Chrome/Edge
1. Download the latest release or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder

### Firefox
1. Run the build script: `node build.js`
2. Open Firefox and go to `about:debugging`
3. Click "This Firefox" → "Load Temporary Add-on..."
4. Navigate to `dist-firefox/` and select `manifest.json`

## Development

### Building for Firefox
```bash
node build.js
```

This creates a Firefox-compatible version in the `dist-firefox/` directory.

### Project Structure
```
├── manifest.json          # Chrome manifest (Manifest V3)
├── manifest-firefox.json  # Firefox manifest (Manifest V2)
├── background.js          # Chrome background script
├── background-firefox.js  # Firefox background script
├── content.js            # Chrome content script
├── content-firefox.js    # Firefox content script
├── patch.js              # Injected script for Sonos API
├── popup.html/css/js     # Extension popup interface
├── build.js              # Build script for Firefox
└── icons/                # Extension icons
```

### API Compatibility
The extension uses standard WebExtension APIs that work across browsers:
- `browser.storage` / `chrome.storage`
- `browser.tabs` / `chrome.tabs`
- `browser.notifications` / `chrome.notifications`
- `browser.runtime` / `chrome.runtime`

## Usage

1. Navigate to [play.sonos.com](https://play.sonos.com)
2. Start playing music on your Sonos system
3. Click the lyrics button (📄) in the header to view lyrics
4. Use mouse wheel on volume sliders for quick adjustments
5. Control playback through browser media controls

## Lyrics Source

Lyrics are provided by [lrclib.net](https://lrclib.net/) - a free, open-source lyrics database.

## License

This project is open source. Feel free to contribute or report issues.

## Author

Created by [Jeram.ai](https://github.com/jeram-ai)
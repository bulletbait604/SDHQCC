# KICK Live Status Plugin for StreamDeck

Monitor KICK streamers' live status with color-coded buttons on your StreamDeck.

## Features

- **Green Button**: Streamer is LIVE
- **Red Button**: Streamer is offline
- **Click to Open**: Opens the streamer's KICK page in your selected browser
- **Auto-Refresh**: Checks live status every 30 seconds
- **Browser Selection**: Choose Chrome, Firefox, Edge, Brave, Opera, or system default

## Installation

1. Download the plugin folder
2. Double-click `com.sdhqcreator.kicklive.streamDeckPlugin` file (after packaging) or:
   - Copy the plugin folder to `%APPDATA%\Elgato\StreamDeck\Plugins\` on Windows
   - Or `~/Library/Application Support/com.elgato.StreamDeck/Plugins/` on Mac
3. Restart StreamDeck software

## Setup

1. Drag the "KICK Live Status" action to a button
2. Enter the KICK username (without @)
3. Select your preferred browser
4. The button will update automatically

## Configuration

The plugin stores your KICK Client ID and Client Secret internally for API authentication with Cloudflare protection.

## File Structure

```
streamdeck-plugin/
├── manifest.json           # Plugin metadata
├── app.html               # Plugin entry point
├── plugin.js              # Main plugin logic
├── property-inspector.html # Settings UI
├── property-inspector.js   # Settings logic
├── libs/
│   └── js/
│       ├── stream-deck.js      # StreamDeck SDK
│       ├── property-inspector.js # PI SDK
│       ├── action.js           # Action utilities
│       ├── utils.js            # Helper functions
│       └── events.js           # Event definitions
└── icons/
    ├── icon.svg           # Default icon
    ├── icon-offline.svg   # Red offline icon (State 0)
    ├── icon-online.svg    # Green live icon (State 1)
    ├── plugin.svg         # Plugin icon
    └── category.svg       # Category icon
```

## API Reference

Uses KICK API v2 endpoints:
- `GET https://kick.com/api/v2/channels/{username}`

The plugin includes Cloudflare authentication headers using your provided credentials.

## Browser Support

- System Default
- Google Chrome
- Mozilla Firefox  
- Microsoft Edge
- Brave Browser
- Opera

## Troubleshooting

- If status doesn't update, check your internet connection
- Ensure the KICK username is correct (case-insensitive)
- The button refreshes every 30 seconds automatically

## License

MIT License - Stream Dreams Creator Corner

/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />
/// <reference path="libs/js/property-inspector.js" />
/// <reference path="libs/js/utils.js" />
/// <reference path="libs/js/events.js" />

const KICK_CLIENT_ID = '01KMBAZAAATS4VPGDAJDJG1X3T';
const KICK_CLIENT_SECRET = 'aa29e3824f2b063c1f97c144f164cd14da413bdeb9b31c138504a2f2e179f726';

let refreshInterval = null;

// Action UUID
const ACTION_UUID = 'com.sdhqcreator.kicklive.action';

// Store for all buttons and their settings
const buttons = new Map();

// Initialize plugin
$SD.onConnected(({ actionInfo, appInfo, connection, messageType, port, uuid }) => {
    console.log('KICK Live Plugin Connected');
});

$SD.onDidReceiveGlobalSettings((payload) => {
    console.log('Global settings received:', payload);
});

// Called when an action appears on the Stream Deck
$SD.onWillAppear((jsn) => {
    const context = jsn.context;
    const settings = jsn.payload?.settings || {};
    
    buttons.set(context, {
        context: context,
        username: settings.username || '',
        browser: settings.browser || 'default',
        isLive: false
    });
    
    // Start refresh interval if not already running
    if (!refreshInterval) {
        refreshInterval = setInterval(refreshAllStatuses, 30000); // Refresh every 30 seconds
    }
    
    // Initial status check
    checkLiveStatus(context);
});

// Called when an action disappears from the Stream Deck
$SD.onWillDisappear((jsn) => {
    const context = jsn.context;
    buttons.delete(context);
    
    // Clear interval if no buttons left
    if (buttons.size === 0 && refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
});

// Called when settings are received from Property Inspector
$SD.onDidReceiveSettings((jsn) => {
    const context = jsn.context;
    const settings = jsn.payload?.settings || {};
    
    if (buttons.has(context)) {
        const button = buttons.get(context);
        button.username = settings.username || '';
        button.browser = settings.browser || 'default';
        buttons.set(context, button);
    }
    
    // Check status immediately after settings update
    checkLiveStatus(context);
});

// Called when the button is pressed
$SD.onKeyDown((jsn) => {
    const context = jsn.context;
    const button = buttons.get(context);
    
    if (button && button.username) {
        const kickUrl = `https://kick.com/${button.username}`;
        openUrl(kickUrl, button.browser);
    }
});

// Refresh all button statuses
async function refreshAllStatuses() {
    for (const [context, button] of buttons) {
        await checkLiveStatus(context);
    }
}

// Check live status for a specific button
async function checkLiveStatus(context) {
    const button = buttons.get(context);
    if (!button || !button.username) {
        setButtonOffline(context);
        return;
    }
    
    try {
        const isLive = await fetchKickLiveStatus(button.username);
        
        if (isLive !== button.isLive) {
            button.isLive = isLive;
            buttons.set(context, button);
        }
        
        if (isLive) {
            setButtonOnline(context, button.username);
        } else {
            setButtonOffline(context, button.username);
        }
    } catch (error) {
        console.error('Error checking live status:', error);
        setButtonOffline(context, button.username);
    }
}

// Fetch live status from KICK API
async function fetchKickLiveStatus(username) {
    try {
        // KICK API endpoint for channel info
        // Using the public API endpoint
        const response = await fetch(`https://api.kick.com/api/v2/channels/${username}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'SDHQ-KickLive-Plugin/1.0',
                'Authorization': `Bearer ${KICK_CLIENT_ID}`,
                'X-Client-Secret': KICK_CLIENT_SECRET
            }
        });
        
        if (!response.ok) {
            // If API fails, try fallback to check live status via public endpoint
            return await checkLiveStatusFallback(username);
        }
        
        const data = await response.json();
        
        // Check if stream is live based on API response structure
        // The API returns livestream data if the user is live
        if (data && data.data && data.data.livestream) {
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('API Error:', error);
        // Fallback method
        return await checkLiveStatusFallback(username);
    }
}

// Fallback method using alternative approach
async function checkLiveStatusFallback(username) {
    try {
        // Alternative: Check if user is live using the public channels endpoint
        const response = await fetch(`https://kick.com/api/v2/channels/${username}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0',
                'Referer': 'https://kick.com/'
            }
        });
        
        if (!response.ok) {
            return false;
        }
        
        const data = await response.json();
        
        // Check if livestream exists and is active
        if (data && data.livestream) {
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Fallback check failed:', error);
        return false;
    }
}

// Set button to online state (green)
function setButtonOnline(context, username) {
    $SD.setState(context, 1); // State 1 = Online (green icon)
    if (username) {
        $SD.setTitle(context, username);
    }
}

// Set button to offline state (red)
function setButtonOffline(context, username) {
    $SD.setState(context, 0); // State 0 = Offline (red icon)
    if (username) {
        $SD.setTitle(context, username);
    }
}

// Open URL in specified browser
function openUrl(url, browser) {
    // Note: Browser selection requires native execution capabilities
    // In a pure JS plugin, we use StreamDeck's openUrl or window.open
    // For specific browser support, this would need a native companion plugin
    
    if (browser && browser !== 'default') {
        // Log browser preference - specific browser requires native wrapper
        console.log(`Browser preference: ${browser} (uses default in web environment)`);
        
        // Try to use custom URL scheme for specific browsers (limited support)
        let browserUrl = url;
        try {
            switch (browser) {
                case 'chrome':
                    // Attempt Chrome URL scheme (may not work on all systems)
                    browserUrl = `google-chrome:${url}`;
                    break;
                case 'edge':
                    browserUrl = `microsoft-edge:${url}`;
                    break;
                case 'firefox':
                    browserUrl = `firefox:${url}`;
                    break;
            }
        } catch (e) {
            console.log('Browser URL scheme not supported, using default');
            browserUrl = url;
        }
        
        // Try window.open first for custom schemes, fallback to SD API
        try {
            const newWindow = window.open(browserUrl, '_blank');
            if (newWindow) {
                console.log('Opened URL in browser');
                return;
            }
        } catch (e) {
            console.log('window.open failed, using StreamDeck API');
        }
    }
    
    // Use StreamDeck's built-in openUrl (opens in default browser)
    $SD.openUrl(url);
}

console.log('KICK Live Plugin Loaded');

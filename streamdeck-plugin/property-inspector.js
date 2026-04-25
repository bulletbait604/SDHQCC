/// <reference path="libs/js/property-inspector.js" />

let currentSettings = {
    username: '',
    browser: 'default'
};

// Initialize Property Inspector
$PI.onConnected((jsn) => {
    const settings = jsn.actionInfo?.payload?.settings || {};
    currentSettings = {
        username: settings.username || '',
        browser: settings.browser || 'default'
    };
    
    // Populate form with saved settings
    const usernameInput = document.getElementById('username');
    const browserSelect = document.getElementById('browser');
    
    if (usernameInput) {
        usernameInput.value = currentSettings.username;
    }
    
    if (browserSelect) {
        browserSelect.value = currentSettings.browser;
    }
    
    // Add event listeners
    if (usernameInput) {
        usernameInput.addEventListener('input', handleInputChange);
        usernameInput.addEventListener('change', handleInputChange);
    }
    
    if (browserSelect) {
        browserSelect.addEventListener('change', handleInputChange);
    }
    
    // Update status indicator
    updateStatusIndicator();
});

// Handle input changes
function handleInputChange(event) {
    const target = event.target;
    
    if (target.id === 'username') {
        currentSettings.username = target.value.trim().toLowerCase();
    } else if (target.id === 'browser') {
        currentSettings.browser = target.value;
    }
    
    // Save settings to Stream Deck
    $PI.setSettings(currentSettings);
    
    // Update status indicator
    updateStatusIndicator();
}

// Update the status indicator in the Property Inspector
function updateStatusIndicator() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    if (!statusDot || !statusText) return;
    
    if (!currentSettings.username) {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Enter a username to check status';
        return;
    }
    
    statusText.textContent = `Checking ${currentSettings.username}...`;
    
    // Check live status
    checkLiveStatus(currentSettings.username).then(isLive => {
        if (isLive) {
            statusDot.className = 'status-dot live';
            statusText.textContent = `${currentSettings.username} is LIVE!`;
        } else {
            statusDot.className = 'status-dot';
            statusText.textContent = `${currentSettings.username} is offline`;
        }
    }).catch(error => {
        statusDot.className = 'status-dot';
        statusText.textContent = `Unable to check ${currentSettings.username}`;
        console.error('Status check error:', error);
    });
}

// Check live status (similar to plugin.js but for PI)
async function checkLiveStatus(username) {
    try {
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
        return !!(data && data.livestream);
    } catch (error) {
        console.error('Status check failed:', error);
        return false;
    }
}

console.log('KICK Live Property Inspector Loaded');

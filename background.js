// Background script for Access Manager

// Initialize storage with default values
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['accessData', 'isPremium'], (result) => {
    if (!result.accessData) {
      chrome.storage.local.set({ accessData: [] });
    }
    if (result.isPremium === undefined) {
      chrome.storage.local.set({ isPremium: false });
    }
  });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  ('Background received message:', request.type, request, 'from:', sender.url);
  
  // Handle debug ping
  if (request.type === 'DEBUG_PING') {
    ('Debug ping received from:', sender.url);
    if (sendResponse) {
      sendResponse({
        status: 'pong',
        timestamp: new Date().toISOString(),
        extensionId: chrome.runtime.id
      });
    }
    return true;
  }
  
      // Handle access granted events
  if (request.type === 'ACCESS_GRANTED' || 
      request.type === 'GOOGLE_CALENDAR_ACCESS_GRANTED') {
    ('Processing access event:', request);
    
    try {
      // Format the data for our access log
      const accessData = request.data;
      handleAccessGranted(accessData);
      if (sendResponse) sendResponse({ status: 'access_logged', success: true });
    } catch (error) {
      if (sendResponse) sendResponse({ status: 'error', error: error.message });
    }
    return true;
  }

  // Handle simple OAuth button click event (minimal data)
  if (request.type === 'GOOGLE_OAUTH_BUTTON_CLICKED') {
    try {
      // Compose a minimal access data object
      const accessData = {
        id: 'access_' + Date.now(),
        platform: 'google-oauth',
        platformName: 'Google OAuth',
        fileName: 'OAuth Grant',
        fileType: 'OAuth Grant',
        accessType: 'unknown',
        accessTypeLabel: 'Granted',
        sharedWith: (request.url ? new URL(request.url).hostname : 'Unknown'),
        sharedWithName: 'Unknown App',
        url: request.url || '',
        timestamp: request.timestamp || new Date().toISOString(),
        date: request.timestamp || new Date().toISOString(), // Add date field for popup compatibility
        appName: 'Unknown App',
        permissions: ['OAuth Grant'],
        description: 'Access granted via Google OAuth button click'
      };
      
      chrome.storage.local.get(['accessData'], (result) => {
        const accessDataArray = result.accessData || [];
        accessDataArray.unshift(accessData);
        const trimmedData = accessDataArray.slice(0, 1000);
        chrome.storage.local.set({ accessData: trimmedData }, () => {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Access Granted',
            message: `OAuth access was granted to ${accessData.sharedWith}`
          }, (notificationId) => {
          });
          chrome.runtime.sendMessage({
            type: 'ACCESS_DATA_UPDATED',
            data: accessData
          }, (response) => {
          });
        });
      });
      if (sendResponse) sendResponse({ status: 'access_logged', success: true });
    } catch (error) {
      if (sendResponse) sendResponse({ status: 'error', error: error.message });
    }
    return true;
  }
  
  // Handle premium status check
  if (request.type === 'CHECK_PREMIUM') {
    chrome.storage.local.get(['isPremium'], (result) => {
      if (sendResponse) {
        sendResponse({ isPremium: result.isPremium });
      }
    });
    return true; // Required for async sendResponse
  }
  
  // For any other message types, log them
  if (sendResponse) sendResponse({ status: 'unhandled', type: request.type });
  return true;
});

// Keep the service worker alive
let keepAliveInterval;

function startKeepAlive() {
  // Keep alive by periodically checking tabs
  keepAliveInterval = setInterval(() => {
    chrome.tabs.query({}, () => {
      // This empty callback ensures the service worker stays alive
    });
  }, 30000); // 30 seconds
}

// Log when the background script starts
startKeepAlive();

// Handle extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
  startKeepAlive();
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  startKeepAlive();
});

// Clean up on extension unload
chrome.runtime.onSuspend.addListener(() => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
});

// Handle new access granted event
function handleAccessGranted(accessData) {
  try {
    // Generate a unique ID for this access
    const accessId = 'access_' + Date.now();
    accessData.id = accessId;
    accessData.timestamp = accessData.timestamp || new Date().toISOString();
    
    // Format the data specifically for Google Calendar access
    if (accessData.platform === 'google-calendar') {
      accessData.fileName = `Calendar access for ${accessData.appName || 'an app'}`;
      accessData.fileType = 'OAuth Grant';
      accessData.sharedWithName = accessData.sharedWith || 'Unknown App';
      
      // Format the description to show permissions
      if (accessData.permissions && accessData.permissions.length > 0) {
        accessData.description = 'Permissions granted:\n' + 
          accessData.permissions.map((p, i) => `${i + 1}. ${p}`).join('\n');
      }
    }
    
    // Add to storage
    chrome.storage.local.get(['accessData'], (result) => {
      try {
        const accessDataArray = Array.isArray(result.accessData) ? [...result.accessData] : [];
        accessDataArray.unshift(accessData);
        
        // Keep only the last 1000 entries to prevent storage issues
        const trimmedData = accessDataArray.slice(0, 1000);
        
        chrome.storage.local.set({ accessData: trimmedData }, () => {
          // Notify any open popups
          chrome.runtime.sendMessage({
            type: 'ACCESS_DATA_UPDATED',
            data: trimmedData
          }).catch(err => {});
          
          // Show notification
          showAccessNotification(accessData);
        });
      } catch (error) {}
    });
  } catch (error) {}
}

// Generate a simple unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Show notification when access is granted
function showAccessNotification(accessData) {
  const notificationOptions = {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Access Granted',
    message: `You've shared "${accessData.fileName}" with ${accessData.sharedWithName || accessData.sharedWith}`,
    priority: 1
  };
  
  chrome.notifications.create(`access-${Date.now()}`, notificationOptions);
}

// Listen for tab updates to detect when sharing dialogs are opened
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if we're on a sharing dialog or Loom page
    if (isSharingPage(tab.url) || tab.url.includes('loom.com')) {
      // Inject content script if not already injected
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      }).catch(err => {});
      
      // For Loom, we need to inject a mutation observer to detect when the share dialog appears
      if (tab.url.includes('loom.com')) {
        chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            // This will be injected into the page context
            const observer = new MutationObserver(() => {
              const shareButton = document.querySelector('button:contains("Share")');
              if (shareButton) {
                // Notify the content script that the share button is available
                window.dispatchEvent(new CustomEvent('loomShareButtonReady'));
              }
            });
            
            // Start observing the document with the configured parameters
            observer.observe(document.body, { 
              childList: true, 
              subtree: true 
            });
          }
        }).catch(err => {});
      }
    }
  }
});

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ACCESS_GRANTED' || request.type === 'GOOGLE_CALENDAR_ACCESS_GRANTED') {
    handleAccessGranted(request.data);
  }
  return true;
});

// Check if the current URL is a sharing page
function isSharingPage(url) {
  const sharingPatterns = [
    // Google Drive sharing
    /https?:\/\/docs\.google\.com\/.*\/d\/.*\/share\b/,
    // Notion sharing
    /https?:\/\/www\.notion\.so\/share\b/,
    // Miro sharing
    /https?:\/\/miro\.com\/app\/board\/.*\/share/,
    // Luma sharing
    /https?:\/\/lu\.ma\/event\/.*\/share/,
    // Loom sharing
    /https?:\/\/www\.loom\.com\/share\b/
  ];
  
  return sharingPatterns.some(pattern => pattern.test(url));
}

// Listen for web navigation to detect when sharing is completed
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0) { // Main frame only
    // Here we would typically check if the navigation was from a sharing dialog
    // and update our data accordingly
  }
}, {
  url: [
    { hostSuffix: 'google.com' },
    { hostSuffix: 'notion.so' },
    { hostSuffix: 'miro.com' },
    { hostSuffix: 'lu.ma' }
  ]
});

// Context menu for manual access tracking
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'trackAccess',
    title: 'Track Access in Access Manager',
    contexts: ['link', 'page']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'trackAccess') {
    // In a real implementation, this would open a dialog to track access
    chrome.tabs.sendMessage(tab.id, { type: 'TRACK_ACCESS' });
  }
});

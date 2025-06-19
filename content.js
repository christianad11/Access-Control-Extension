// Configuration for different platforms
const PLATFORM_CONFIG = {
  'docs.google.com': {
    name: 'Google Workspace',
    icon: '📄',
    detectSharing: detectGoogleSharing,
    selectors: {
      shareButton: '[role="button"][aria-label*="Share"]',
      dialog: '[role="dialog"][aria-label*="Share"]',
      doneButton: 'button[aria-label="Send"]',
      shareLink: 'input[type="text"][readonly]',
      accessLevel: '[role="radiogroup"] [aria-checked="true"]',
      emailInput: 'input[type="email"], input[placeholder*="email"]',
      fileName: 'div[role="heading"][aria-level=1]',
      fileType: 'div[role="heading"] + div',
    },
  },
  'www.loom.com': {
    name: 'Loom',
    icon: '🎬',
    detectSharing: detectLoomSharing,
    selectors: {
      shareButton: 'button:contains("Share")',
      dialog: '[role="dialog"]',
      doneButton: 'button:contains("Copy link")',
      emailInput: 'input[type="email"]',
      videoTitle: 'h1',
    },
  },
  'www.notion.so': {
    name: 'Notion',
    icon: '📝',
    detectSharing: detectNotionSharing,
    selectors: {
      shareButton: 'button:has-text("Share")',
      dialog: '.notion-overlay-container',
      doneButton: 'button:has-text("Invite")',
      accessLevel: 'div[role="button"]:has-text("Can edit"), div[role="button"]:has-text("Can view")',
      emailInput: 'input[type="email"], input[placeholder*="email"]',
      pageTitle: 'div[placeholder="Untitled"]',
    },
  },
  'miro.com': {
    name: 'Miro',
    icon: '🖌️',
    detectSharing: detectMiroSharing,
    selectors: {
      shareButton: 'button:has-text("Share")',
      dialog: '.share-dialog',
      doneButton: 'button:has-text("Copy link")',
      accessLevel: 'button[aria-label*="access"]',
      emailInput: 'input[type="email"]',
      boardName: '.board-name',
    },
  },
  'lu.ma': {
    name: 'Luma',
    icon: '🎟️',
    detectSharing: detectLumaSharing,
    selectors: {
      shareButton: 'button:has-text("Share")',
      dialog: '[role="dialog"]',
      doneButton: 'button:has-text("Copy link")',
      eventName: 'h1',
    },
  },
};

// Current platform config
const currentPlatform = Object.keys(PLATFORM_CONFIG).find(domain => 
  window.location.hostname.includes(domain)
);

// Track if we're currently monitoring a sharing dialog
let isMonitoring = false;

// Initialize the content script
function init() {
  if (!currentPlatform) {
    // Special handling for Loom
    if (window.location.hostname.includes('loom.com')) {
      setupLoomObserver();
    }
    return;
  }
  
  console.log(`Access Manager: Monitoring ${PLATFORM_CONFIG[currentPlatform].name} for sharing activities`);
  
  // Start monitoring for sharing dialogs
  startMonitoring();
  
  // Also monitor dynamically added elements
  const observer = new MutationObserver(() => {
    if (!isMonitoring) {
      startMonitoring();
    }
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
}

// Special observer for Loom
function setupLoomObserver() {
  console.log('Access Manager: Setting up Loom observer');
  
  // Use a more specific selector for the share button to avoid conflicts
  const findShareButton = () => {
    // Try to find the most specific share button we can
    return document.querySelector('button[data-testid="share-button"], button:contains("Share"):not([aria-expanded])');
  };
  
  const handleShareButtonClick = () => {
    console.log('Access Manager: Loom share button clicked');
    
    // Use a more robust way to detect the share dialog
    const dialogObserver = new MutationObserver((mutations, observer) => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"], .ReactModal__Overlay');
      if (dialog) {
        console.log('Access Manager: Loom share dialog detected');
        observer.disconnect();
        handleLoomSharing(dialog);
      }
    });
    
    // Start observing the document for the dialog
    dialogObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Clean up after a while if we don't find the dialog
    setTimeout(() => {
      dialogObserver.disconnect();
    }, 5000);
  };
  
  // Initial check for share button
  const shareButton = findShareButton();
  if (shareButton) {
    shareButton.addEventListener('click', handleShareButtonClick, { once: true });
  }
  
  // Also set up a mutation observer for dynamically added share buttons
  const buttonObserver = new MutationObserver(() => {
    const newShareButton = findShareButton();
    if (newShareButton) {
      newShareButton.addEventListener('click', handleShareButtonClick, { once: true });
    }
  });
  
  buttonObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Handle Loom sharing
function handleLoomSharing(dialog) {
  console.log('Access Manager: Handling Loom sharing');
  
  // Clean up any existing observers to prevent duplicates
  if (window.loomShareObserver) {
    window.loomShareObserver.disconnect();
    delete window.loomShareObserver;
  }
  
  // Function to safely get video title
  const getVideoTitle = () => {
    try {
      return document.querySelector('h1')?.textContent.trim() || 'Untitled Video';
    } catch (e) {
      console.error('Error getting video title:', e);
      return 'Untitled Video';
    }
  };
  
  // Function to handle share event
  const handleShareEvent = (shareType, data = {}) => {
    try {
      const accessData = {
        platform: 'loom',
        platformName: 'Loom',
        fileName: getVideoTitle(),
        fileType: 'Loom Video',
        accessType: 'view',
        accessTypeLabel: 'Can View',
        url: window.location.href,
        timestamp: new Date().toISOString(),
        ...data
      };
      
      console.log('Access Manager: Sending Loom share data', accessData);
      chrome.runtime.sendMessage({
        type: 'ACCESS_GRANTED',
        data: accessData
      }).catch(err => {
        console.error('Error sending share data:', err);
      });
    } catch (e) {
      console.error('Error handling share event:', e);
    }
  };
  
  // Set up the observer
  window.loomShareObserver = new MutationObserver((mutations) => {
    try {
      // Look for email inputs in the dialog
      const emailInputs = Array.from(dialog.querySelectorAll('input[type="email"]'));
      const copyButton = Array.from(dialog.querySelectorAll('button')).find(btn => 
        btn.textContent?.toLowerCase().includes('copy link')
      );
      
      // Handle email sharing
      if (emailInputs.length > 0) {
        const shareButton = Array.from(dialog.querySelectorAll('button')).find(btn => 
          btn.textContent?.toLowerCase().includes('send')
        );
        
        if (shareButton && !shareButton.dataset.accessManagerListener) {
          shareButton.dataset.accessManagerListener = 'true';
          const clickHandler = () => {
            const emails = emailInputs
              .map(input => input.value?.trim())
              .filter(email => email && email.includes('@'));
              
            if (emails.length > 0) {
              handleShareEvent('email', {
                sharedWith: emails.join(', ')
              });
            }
            
            // Clean up after handling
            shareButton.removeEventListener('click', clickHandler);
            delete shareButton.dataset.accessManagerListener;
          };
          
          shareButton.addEventListener('click', clickHandler, { once: true });
        }
      } 
      // Handle link sharing
      else if (copyButton && !copyButton.dataset.accessManagerListener) {
        copyButton.dataset.accessManagerListener = 'true';
        const clickHandler = () => {
          handleShareEvent('link', {
            sharedWith: 'Link shared'
          });
          
          // Clean up after handling
          copyButton.removeEventListener('click', clickHandler);
          delete copyButton.dataset.accessManagerListener;
        };
        
        copyButton.addEventListener('click', clickHandler, { once: true });
      }
    } catch (e) {
      console.error('Error in Loom share observer:', e);
    }
  });
  
  // Start observing the dialog
  try {
    window.loomShareObserver.observe(dialog, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
    
    // Set a timeout to clean up the observer if the dialog is closed
    const cleanupTimer = setTimeout(() => {
      if (window.loomShareObserver) {
        window.loomShareObserver.disconnect();
        delete window.loomShareObserver;
      }
    }, 30000); // Clean up after 30 seconds
    
    // Store the timer ID for cleanup
    dialog.dataset.cleanupTimer = cleanupTimer;
  } catch (e) {
    console.error('Error setting up Loom share observer:', e);
  }
}

// Start monitoring for sharing dialogs
function startMonitoring() {
  if (isMonitoring) return;
  
  const config = PLATFORM_CONFIG[currentPlatform];
  if (!config) return;
  
  // Check if sharing dialog is already open
  const dialog = document.querySelector(config.selectors.dialog);
  if (dialog) {
    handleSharingDialog(config, dialog);
    return;
  }
  
  // Set up click handler for share buttons
  document.addEventListener('click', handleShareButtonClick);
}

// Handle share button clicks
function handleShareButtonClick(event) {
  const config = PLATFORM_CONFIG[currentPlatform];
  if (!config) return;
  
  // Check if the click was on a share button
  const shareButton = event.target.closest(config.selectors.shareButton);
  if (!shareButton) return;
  
  // Wait for the sharing dialog to appear
  const checkDialog = setInterval(() => {
    const dialog = document.querySelector(config.selectors.dialog);
    if (dialog) {
      clearInterval(checkDialog);
      handleSharingDialog(config, dialog);
    }
  }, 100);
}

// Handle sharing dialog
function handleSharingDialog(config, dialog) {
  if (isMonitoring) return;
  isMonitoring = true;
  
  console.log('Access Manager: Sharing dialog detected');
  
  // Set up mutation observer for the dialog
  const observer = new MutationObserver(() => {
    // Check if sharing was completed
    if (config.detectSharing()) {
      observer.disconnect();
      isMonitoring = false;
    }
  });
  
  observer.observe(dialog, { 
    childList: true, 
    subtree: true,
    attributes: true,
    characterData: true
  });
  
  // Also check for sharing when dialog is closed
  const checkClosed = setInterval(() => {
    if (!document.body.contains(dialog)) {
      clearInterval(checkClosed);
      observer.disconnect();
      isMonitoring = false;
    }
  }, 1000);
}

// Platform-specific sharing detection functions
function detectLoomSharing() {
  const doneButton = document.querySelector(PLATFORM_CONFIG[currentPlatform].selectors.doneButton);
  if (!doneButton) return false;

  const emailInputs = Array.from(document.querySelectorAll(PLATFORM_CONFIG[currentPlatform].selectors.emailInput));
  const hasEmails = emailInputs.some(input => input.value.includes('@'));
  
  if (hasEmails) {
    const videoTitle = document.querySelector(PLATFORM_CONFIG[currentPlatform].selectors.videoTitle)?.textContent || 'Untitled Video';
    
    const accessData = {
      platform: 'loom',
      platformName: 'Loom',
      fileName: videoTitle.trim(),
      fileType: 'Loom Video',
      accessType: 'view',
      accessTypeLabel: 'Can View',
      sharedWith: emailInputs.map(input => input.value).filter(Boolean).join(', '),
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
    
    // Add event listener for the done button
    const handleClick = () => {
      chrome.runtime.sendMessage({
        type: 'ACCESS_GRANTED',
        data: accessData
      });
      doneButton.removeEventListener('click', handleClick);
    };
    
    doneButton.addEventListener('click', handleClick);
    return true;
  }
  
  return false;
}

function detectGoogleSharing() {
  const doneButton = document.querySelector(PLATFORM_CONFIG[currentPlatform].selectors.doneButton);
  if (!doneButton || doneButton.disabled) return false;
  
  const emailInputs = Array.from(document.querySelectorAll(PLATFORM_CONFIG[currentPlatform].selectors.emailInput));
  const hasEmails = emailInputs.some(input => input.value.includes('@'));
  
  if (hasEmails) {
    const accessData = {
      platform: 'google',
      platformName: 'Google Workspace',
      fileName: document.querySelector(PLATFORM_CONFIG[currentPlatform].selectors.fileName)?.textContent || 'Untitled',
      fileType: document.querySelector(PLATFORM_CONFIG[currentPlatform].selectors.fileType)?.textContent || 'Google Doc',
      accessType: document.querySelector(PLATFORM_CONFIG[currentPlatform].selectors.accessLevel)?.getAttribute('aria-label')?.toLowerCase().includes('editor') ? 'edit' : 'view',
      sharedWith: emailInputs.map(input => input.value).filter(Boolean).join(', '),
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
    
    // Add event listener for the done button
    const handleClick = () => {
      chrome.runtime.sendMessage({
        type: 'ACCESS_GRANTED',
        data: accessData
      });
      doneButton.removeEventListener('click', handleClick);
    };
    
    doneButton.addEventListener('click', handleClick);
    return true;
  }
  
  return false;
}

function detectNotionSharing() {
  // Similar implementation for Notion
  // This is a simplified version - actual implementation would need to handle Notion's UI
  return false;
}

function detectMiroSharing() {
  // Implementation for Miro
  return false;
}

function detectLumaSharing() {
  // Implementation for Luma
  return false;
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TRACK_ACCESS') {
    // Handle manual access tracking
    const accessData = {
      platform: 'manual',
      platformName: 'Manual Entry',
      fileName: document.title,
      fileType: 'Web Page',
      accessType: 'view',
      sharedWith: 'Manually tracked',
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
    
    chrome.runtime.sendMessage({
      type: 'ACCESS_GRANTED',
      data: accessData
    });
    
    sendResponse({ success: true });
  }
  
  return true; // Required for async sendResponse
});

// Start monitoring when the script loads
init();

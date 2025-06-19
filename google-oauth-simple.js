// Function to check for OAuth buttons
function checkForOAuthButtons() {
  // Only run on the Google OAuth consent summary page
  if (!window.location.href.startsWith('https://accounts.google.com/signin/oauth/v2/consentsummary')) {
    return;
  }
  
  // Get all buttons on the page
  const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
  
  // Look for allow/continue buttons
  const oauthButtons = buttons.filter(button => {
    const text = (button.textContent || '').toLowerCase();
    return text.includes('allow') || 
           text.includes('continue') || 
           text.includes('approve');
  });
  
  // Add click handlers to found buttons
  oauthButtons.forEach((button, index) => {
    if (button.dataset.oauthWatched) return;
    
    button.dataset.oauthWatched = 'true';
    
    const clickHandler = () => {
      // Wait for the OAuth flow to complete by listening for navigation
      const sendOAuthMessage = () => {
        chrome.runtime.sendMessage({
          type: 'GOOGLE_OAUTH_BUTTON_CLICKED',
          url: window.location.href,
          timestamp: new Date().toISOString()
        });
        window.removeEventListener('beforeunload', sendOAuthMessage);
      };
      window.addEventListener('beforeunload', sendOAuthMessage);
    };
    
    button.addEventListener('click', clickHandler, { once: true });
  });
}

// Initial check
checkForOAuthButtons();

// Set up observer to check for dynamically added buttons
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      checkForOAuthButtons();
    }
  });
});

// Start observing
try {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
} catch (e) {
  rror('Error starting observer:', e);
}

// Try again after a short delay in case the page loads slowly
setTimeout(checkForOAuthButtons, 1000);
setTimeout(checkForOAuthButtons, 3000);
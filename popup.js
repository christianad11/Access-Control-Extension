// DOM Elements
const accessEntries = document.getElementById('access-entries');
const searchInput = document.getElementById('search');
const platformFilter = document.getElementById('platform-filter');
const accessFilter = document.getElementById('access-filter');
const timeFilter = document.getElementById('time-filter');

// Initialize with empty array
let accessData = [];

// Format date to relative time (e.g., "2 days ago")
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1
  };
  
  for (const [unit, seconds] of Object.entries(intervals)) {
    const interval = Math.floor(diffInSeconds / seconds);
    if (interval >= 1) {
      return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
    }
  }
  
  return 'Just now';
}

// Get platform icon
function getPlatformIcon(platform) {
  const icons = {
    google: '📄',
    notion: '📝',
    miro: '🖌️',
    luma: '🎟️',
    default: '📁'
  };
  return icons[platform] || icons.default;
}

// Mapping from platform to permissions/revoke page
const PLATFORM_MANAGE_URLS = {
  'google': 'https://myaccount.google.com/permissions',
  'google-oauth': 'https://myaccount.google.com/permissions',
  'notion': 'https://www.notion.so/my-integrations',
  'miro': 'https://miro.com/app/settings/user-profile/',
  'luma': 'https://lu.ma/account/connections',
};

function getManagePlatformButton(entry) {
  let platformKey = (entry.platform || '').toLowerCase();
  let url = PLATFORM_MANAGE_URLS[platformKey];
  let label = '';
  if (platformKey.includes('google')) {
    url = PLATFORM_MANAGE_URLS['google'];
    label = 'Manage on Google';
  } else if (platformKey.includes('notion')) {
    url = PLATFORM_MANAGE_URLS['notion'];
    label = 'Manage on Notion';
  } else if (platformKey.includes('miro')) {
    url = PLATFORM_MANAGE_URLS['miro'];
    label = 'Manage on Miro';
  } else if (platformKey.includes('luma')) {
    url = PLATFORM_MANAGE_URLS['luma'];
    label = 'Manage on Luma';
  }
  if (url && label) {
    return `<button class="action-btn manage-platform-btn" data-url="${url}" title="${label}">${label}</button>`;
  }
  return '';
}

// Render access entries
function renderAccessEntries(entries) {
  if (entries.length === 0) {
    accessEntries.innerHTML = `
      <tr class="empty-state">
        <td colspan="6" style="text-align:center; color:var(--text-tertiary); padding: 32px 0;">
          <span class="material-icons" style="vertical-align:middle;">search_off</span>
          <span style="margin-left:8px;">No matching entries found. Try adjusting your filters or search term.</span>
        </td>
      </tr>`;
    return;
  }

  // Deduplicate entries by id (or timestamp if needed)
  const seenIds = new Set();
  const deduped = entries.filter(entry => {
    if (seenIds.has(entry.id)) return false;
    seenIds.add(entry.id);
    return true;
  });

  accessEntries.innerHTML = deduped.map(entry => `
    <tr class="access-entry" data-id="${entry.id}">
      <td class="col-app">
        ${entry.platform === 'google-oauth' ?
          `<span class='platform-name'>${(entry.sharedWithName && entry.sharedWithName !== 'Unknown App') ? entry.sharedWithName : (entry.appName && entry.appName !== 'Unknown App' ? entry.appName : 'Google App')}</span>` :
          `<span class='platform-name'>${entry.platformName || 'Unknown Platform'}</span>`}
      </td>
      <td class="col-file">
        <a href="${entry.url || '#'}" target="_blank" class="file-link">
          <div class="file-name">${entry.platform === 'google-oauth' ? (entry.fileType || 'Google Service') : (entry.fileName || 'Unknown Resource')}</div>
          <div class="file-type">${entry.platform === 'google-oauth' ? (entry.fileName || '') : (entry.fileType || '')}</div>
        </a>
      </td>
      <td class="col-access">
        <span class="access-badge ${entry.accessType || 'unknown'}">${entry.accessTypeLabel || 'Granted'}</span>
      </td>
      <td class="col-user">
        <div class="user-info">
          <span class="user-avatar">${(entry.sharedWithName && entry.sharedWithName.charAt(0).toUpperCase()) || '?'}</span>
          <div>
            <div class="user-name">${entry.sharedWithName || 'Unknown App'}</div>
            <div class="user-email">${entry.sharedWith || ''}</div>
          </div>
        </div>
      </td>
      <td class="col-date" title="${entry.date ? new Date(entry.date).toLocaleString() : ''}">
        ${entry.date ? formatRelativeTime(entry.date) : ''}
      </td>
      <td class="col-actions">
        <button class="action-btn remove-btn" title="Remove Access">
          <span class="material-icons">delete</span> Remove
        </button>
        ${getManagePlatformButton(entry)}
      </td>
    </tr>`).join('');

  // Add event listeners for the remove buttons
  document.querySelectorAll('.remove-btn').forEach((btn, idx) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const entryId = entries[idx].id;
      removeAccessEntry(entryId);
    });
  });

  // Add event listeners for all Manage on Platform buttons
  document.querySelectorAll('.manage-platform-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const url = btn.getAttribute('data-url');
      if (url) window.open(url, '_blank');
    });
  });

}

// Remove access entry by id and update storage/UI
function removeAccessEntry(entryId) {
  chrome.storage.local.get(['accessData'], (result) => {
    let data = result.accessData || [];
    data = data.filter(entry => entry.id !== entryId);
    chrome.storage.local.set({ accessData: data }, () => {
      renderAccessEntries(data);
    });
  });
}

// Filter access entries based on filters
function filterAccessEntries() {
  const searchTerm = searchInput.value.toLowerCase();
  const platform = platformFilter.value;
  const accessType = accessFilter.value;
  const timeRange = timeFilter.value;
  
  const now = new Date();
  const daysAgo = timeRange === 'all' ? 0 : parseInt(timeRange);
  const cutoffDate = new Date(now.setDate(now.getDate() - daysAgo));
  
  return accessData.filter(entry => {
    // Filter by search term
    const matchesSearch = 
      entry.fileName.toLowerCase().includes(searchTerm) ||
      entry.sharedWith.toLowerCase().includes(searchTerm) ||
      entry.sharedWithName.toLowerCase().includes(searchTerm);
    
    // Filter by platform
    const matchesPlatform = !platform ||
      entry.platform === platform ||
      (platform === 'google' && (entry.platform === 'google-oauth' || (entry.platformName && entry.platformName.toLowerCase().includes('google'))));
    
    // Filter by access type
    const matchesAccessType = !accessType || entry.accessType === accessType;
    
    // Filter by time range
    const entryDate = new Date(entry.date);
    const matchesTimeRange = timeRange === 'all' || entryDate >= cutoffDate;
    
    return matchesSearch && matchesPlatform && matchesAccessType && matchesTimeRange;
  });
}

// Apply filters and re-render
function applyFilters() {
  const filteredEntries = filterAccessEntries();
  renderAccessEntries(filteredEntries);
}

// Initialize the popup
function init() {
  // Load data from Chrome storage
  chrome.storage.local.get(['accessData'], (result) => {
    if (result.accessData) {
      accessData = result.accessData;
    }
    
    // Initial render
    renderAccessEntries(accessData);
  });
  
  // Set up event listeners
  searchInput.addEventListener('input', applyFilters);
  platformFilter.addEventListener('change', applyFilters);
  accessFilter.addEventListener('change', applyFilters);
  timeFilter.addEventListener('change', applyFilters);
}

// Load access data from storage
function loadAccessData() {
  chrome.storage.local.get(['accessData'], (result) => {
    accessData = result.accessData || [];
    applyFilters();
  });
}

// Initialize the popup when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  ('Popup initialized');
  init();
  loadAccessData();
});

// Listen for access data updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ACCESS_DATA_UPDATED') {
    ('Received access data update:', message.data);
    loadAccessData();
  }
});

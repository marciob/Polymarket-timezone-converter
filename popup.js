// Common timezones grouped by region
const TIMEZONES = [
  { group: 'Americas', zones: [
    { value: 'America/New_York', label: 'New York (ET)' },
    { value: 'America/Chicago', label: 'Chicago (CT)' },
    { value: 'America/Denver', label: 'Denver (MT)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires (ART)' },
    { value: 'America/Mexico_City', label: 'Mexico City (CST)' },
    { value: 'America/Toronto', label: 'Toronto (ET)' },
    { value: 'America/Vancouver', label: 'Vancouver (PT)' },
  ]},
  { group: 'Europe', zones: [
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET)' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam (CET)' },
    { value: 'Europe/Zurich', label: 'Zurich (CET)' },
    { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
    { value: 'Europe/Istanbul', label: 'Istanbul (TRT)' },
  ]},
  { group: 'Asia & Pacific', zones: [
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Seoul', label: 'Seoul (KST)' },
    { value: 'Asia/Kolkata', label: 'Mumbai (IST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
  ]},
  { group: 'Other', zones: [
    { value: 'UTC', label: 'UTC' },
  ]}
];

// DOM Elements
const trigger = document.getElementById('select-trigger');
const dropdown = document.getElementById('select-dropdown');
const selectedText = document.getElementById('selected-text');
const optionsContainer = document.getElementById('options-container');
const searchInput = document.getElementById('search-input');
const currentTimeEl = document.getElementById('current-time');
const statusEl = document.getElementById('status');

let selectedValue = 'auto';
let isOpen = false;

// Build the options HTML
function buildOptions(filter = '') {
  const filterLower = filter.toLowerCase();
  let html = '';
  
  // Auto-detect option
  if ('auto-detect browser default'.includes(filterLower)) {
    html += `<div class="select-option ${selectedValue === 'auto' ? 'selected' : ''}" data-value="auto">🌐 Auto-detect (Browser Default)</div>`;
  }
  
  TIMEZONES.forEach(group => {
    const filteredZones = group.zones.filter(zone => 
      zone.label.toLowerCase().includes(filterLower) || 
      zone.value.toLowerCase().includes(filterLower)
    );
    
    if (filteredZones.length > 0) {
      html += `<div class="select-group-label">${group.group}</div>`;
      filteredZones.forEach(zone => {
        html += `<div class="select-option ${selectedValue === zone.value ? 'selected' : ''}" data-value="${zone.value}">${zone.label}</div>`;
      });
    }
  });
  
  optionsContainer.innerHTML = html;
  
  // Add click handlers
  optionsContainer.querySelectorAll('.select-option').forEach(option => {
    option.addEventListener('click', () => selectOption(option.dataset.value));
  });
}

// Select an option
function selectOption(value) {
  selectedValue = value;
  
  // Update display text
  if (value === 'auto') {
    selectedText.textContent = '🌐 Auto-detect';
  } else {
    const zone = TIMEZONES.flatMap(g => g.zones).find(z => z.value === value);
    selectedText.textContent = zone ? zone.label : value;
  }
  
  // Close dropdown
  closeDropdown();
  
  // Rebuild to update selected state
  buildOptions(searchInput.value);
  
  // Save and update clock
  saveSettings();
  updateClock();
}

// Toggle dropdown
function toggleDropdown() {
  if (isOpen) {
    closeDropdown();
  } else {
    openDropdown();
  }
}

function openDropdown() {
  isOpen = true;
  trigger.classList.add('open');
  dropdown.classList.add('open');
  searchInput.value = '';
  buildOptions();
  searchInput.focus();
}

function closeDropdown() {
  isOpen = false;
  trigger.classList.remove('open');
  dropdown.classList.remove('open');
}

// Update the live clock
function updateClock() {
  const tz = selectedValue === 'auto' 
    ? Intl.DateTimeFormat().resolvedOptions().timeZone 
    : selectedValue;
  
  const now = new Date();
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(now);
  
  currentTimeEl.textContent = formatted;
}

// Save settings
function saveSettings() {
  chrome.storage.sync.set({ timezone: selectedValue }, () => {
    statusEl.classList.add('show');
    setTimeout(() => statusEl.classList.remove('show'), 3000);
  });
}

// Load saved settings
function loadSettings() {
  chrome.storage.sync.get(['timezone'], (result) => {
    if (result.timezone) {
      selectedValue = result.timezone;
    } else {
      selectedValue = 'auto';
    }
    
    // Update display
    if (selectedValue === 'auto') {
      selectedText.textContent = '🌐 Auto-detect';
    } else {
      const zone = TIMEZONES.flatMap(g => g.zones).find(z => z.value === selectedValue);
      selectedText.textContent = zone ? zone.label : selectedValue;
    }
    
    buildOptions();
    updateClock();
  });
}

// Event listeners
trigger.addEventListener('click', toggleDropdown);

searchInput.addEventListener('input', (e) => {
  buildOptions(e.target.value);
});

searchInput.addEventListener('click', (e) => {
  e.stopPropagation();
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select')) {
    closeDropdown();
  }
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDropdown();
  }
});

// Initialize
loadSettings();

// Update clock every second
setInterval(updateClock, 1000);

// Polymarket Timezone Converter Content Script

const processedAttribute = 'data-pm-timezone-converted';
let userTimezone = null; // Will be loaded from storage

// Load timezone preference from storage
function loadTimezonePreference() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['timezone'], (result) => {
      if (result.timezone && result.timezone !== 'auto') {
        userTimezone = result.timezone;
      } else {
        userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      }
      resolve(userTimezone);
    });
  });
}

function getETModifier(monthIndex) {
    // DST: Mar 2nd Sunday to Nov 1st Sunday
    // Simple: Apr-Oct -> EDT, else EST
    if (monthIndex > 2 && monthIndex < 10) return 'EDT';
    return 'EST';
}

function parseAndConvert(text) {
    // Multiple patterns to match:
    // 1. "January 7, 5:45-6:15PM ET" (both times have minutes, 15m markets)
    // 2. "January 7, 5:45-6PM ET" (end time no minutes)
    // 3. "January 7, 6-6:15PM ET" (start time no minutes)
    // 4. "January 7, 5:45PM-6:00PM ET" (sidebar, full format)
    // 5. "January 7, 7-8PM ET" (hourly markets - both just hours)
    // 6. "January 7, 4:00PM" (4H markets - single time, no ET, no range)
    // 7. "January 7, 8PM ET" (hourly single time with ET)
    
    // Pattern 1: Both times have minutes, single AM/PM at end
    const pattern1 = /([A-Za-z]+ \d{1,2}), (\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})(AM|PM) ET/;
    
    // Pattern 2: Start has minutes, end is just hour (no minutes)
    const pattern2 = /([A-Za-z]+ \d{1,2}), (\d{1,2}):(\d{2})-(\d{1,2})(AM|PM) ET/;
    
    // Pattern 3: Start is just hour (no minutes), end has minutes
    const pattern3 = /([A-Za-z]+ \d{1,2}), (\d{1,2})-(\d{1,2}):(\d{2})(AM|PM) ET/;
    
    // Pattern 4: Both times have AM/PM (sidebar format)
    const pattern4 = /([A-Za-z]+ \d{1,2}), (\d{1,2}):(\d{2})(AM|PM)-(\d{1,2}):(\d{2})(AM|PM) ET/;
    
    // Pattern 5: Hourly markets - both just hours, no minutes (e.g., "7-8PM ET")
    const pattern5 = /([A-Za-z]+ \d{1,2}), (\d{1,2})-(\d{1,2})(AM|PM) ET/;
    
    // Pattern 6: 4H markets - single time with minutes, no range, no ET (e.g., "4:00PM")
    const pattern6 = /([A-Za-z]+ \d{1,2}), (\d{1,2}):(\d{2})(AM|PM)$/;
    
    // Pattern 7: Single hour with ET (e.g., "January 7, 8PM ET")
    const pattern7 = /([A-Za-z]+ \d{1,2}), (\d{1,2})(AM|PM) ET/;
    
    let match, startHour, startMin, endHour, endMin, startMod, endMod, datePart;
    let isSingleTime = false;
    
    if ((match = text.match(pattern4))) {
        // Full format with AM/PM on both
        [, datePart, startHour, startMin, startMod, endHour, endMin, endMod] = match;
        startHour = parseInt(startHour);
        startMin = parseInt(startMin);
        endHour = parseInt(endHour);
        endMin = parseInt(endMin);
    } else if ((match = text.match(pattern1))) {
        // Both have minutes, single AM/PM
        [, datePart, startHour, startMin, endHour, endMin, endMod] = match;
        startHour = parseInt(startHour);
        startMin = parseInt(startMin);
        endHour = parseInt(endHour);
        endMin = parseInt(endMin);
        startMod = endMod;
    } else if ((match = text.match(pattern2))) {
        // Start has minutes, end is just hour
        [, datePart, startHour, startMin, endHour, endMod] = match;
        startHour = parseInt(startHour);
        startMin = parseInt(startMin);
        endHour = parseInt(endHour);
        endMin = 0;
        startMod = endMod;
    } else if ((match = text.match(pattern3))) {
        // Start is just hour, end has minutes
        [, datePart, startHour, endHour, endMin, endMod] = match;
        startHour = parseInt(startHour);
        startMin = 0;
        endHour = parseInt(endHour);
        endMin = parseInt(endMin);
        startMod = endMod;
    } else if ((match = text.match(pattern5))) {
        // Hourly: both just hours (e.g., "7-8PM ET")
        [, datePart, startHour, endHour, endMod] = match;
        startHour = parseInt(startHour);
        startMin = 0;
        endHour = parseInt(endHour);
        endMin = 0;
        startMod = endMod;
    } else if ((match = text.match(pattern6))) {
        // 4H: single time with minutes, no ET (e.g., "4:00PM")
        [, datePart, startHour, startMin, startMod] = match;
        startHour = parseInt(startHour);
        startMin = parseInt(startMin);
        isSingleTime = true;
    } else if ((match = text.match(pattern7))) {
        // Single hour with ET (e.g., "8PM ET")
        [, datePart, startHour, startMod] = match;
        startHour = parseInt(startHour);
        startMin = 0;
        isSingleTime = true;
    } else {
        return null;
    }
    
    const currentYear = new Date().getFullYear();
    
    function to24Hour(hour, mod) {
        if (mod === 'PM' && hour < 12) return hour + 12;
        if (mod === 'AM' && hour === 12) return 0;
        return hour;
    }
    
    function getDateObj(dateStr, hour, minute, mod) {
        const hour24 = to24Hour(hour, mod);
        
        const months = {
            January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
            July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
        };
        const monthName = dateStr.split(' ')[0];
        const monthIdx = months[monthName];
        
        const tzAbbr = getETModifier(monthIdx);
        const day = parseInt(dateStr.split(' ')[1]);
        
        const pad = n => n.toString().padStart(2, '0');
        // Format: "January 7, 2026 18:15:00 EST"
        const dateString = `${dateStr}, ${currentYear} ${pad(hour24)}:${pad(minute)}:00 ${tzAbbr}`;
        return new Date(dateString);
    }

    try {
        const startDt = getDateObj(datePart, startHour, startMin, startMod);
        
        if (isNaN(startDt.getTime())) return null;

        const timeOpts = { timeZone: userTimezone, hour: 'numeric', minute: '2-digit', hour12: true };
        const startFmt = new Intl.DateTimeFormat('en-US', timeOpts).format(startDt);
        
        // Get timezone abbreviation (e.g., "BRT", "PST", "EST")
        const tzParts = new Intl.DateTimeFormat('en-US', { 
            timeZone: userTimezone, 
            timeZoneName: 'short' 
        }).formatToParts(startDt);
        const tzAbbr = tzParts.find(p => p.type === 'timeZoneName')?.value || 'Local';
        
        if (isSingleTime) {
            return ` (${tzAbbr}: ${startFmt})`;
        } else {
            const endDt = getDateObj(datePart, endHour, endMin, endMod);
            if (isNaN(endDt.getTime())) return null;
            const endFmt = new Intl.DateTimeFormat('en-US', timeOpts).format(endDt);
            return ` (${tzAbbr}: ${startFmt} - ${endFmt})`;
        }
    } catch (e) {
        console.error("Polymarket Timezone: Parse error", e);
        return null;
    }
}

function scanAndConvert() {
    // Strategy: Find ONLY the most specific (leaf) elements containing our time pattern
    // Avoid adding to parent elements that contain the text via children
    
    const allElements = document.querySelectorAll('p, h1, h2, h3, h4, span');
    const convertedTexts = new Set(); // Track which patterns we've already converted
    
    for (const element of allElements) {
        if (element.hasAttribute(processedAttribute)) continue;
        if (element.querySelector('[data-pm-tz-span]')) continue;
        
        // Get ONLY the direct text of this element (not from children)
        let directText = '';
        for (const node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                directText += node.textContent;
            }
        }
        
        // If no direct text, skip (the text is in children)
        if (!directText.trim()) continue;
        
        // Check if this element has children with the same pattern - if so, skip
        const hasChildWithPattern = Array.from(element.querySelectorAll('p, span')).some(child => {
            const childText = child.textContent;
            return parseAndConvert(childText);
        });
        if (hasChildWithPattern) continue;
        
        // Now check the full text for the pattern
        const text = element.textContent;
        
        // Quick filter: must contain "ET" or "AM"/"PM" (for 4H markets without ET)
        if (!text.includes('ET') && !text.includes('AM') && !text.includes('PM')) continue;
        
        const conversion = parseAndConvert(text);
        if (!conversion) continue;
        
        // Create a unique key for this conversion to avoid duplicates
        const conversionKey = conversion.trim();
        if (convertedTexts.has(conversionKey)) continue;
        convertedTexts.add(conversionKey);
        
        const span = document.createElement('span');
        span.textContent = conversion;
        span.style.color = '#00f2ea'; // Neon Cyan
        span.style.fontWeight = 'bold';
        span.style.marginLeft = '0.5em';
        span.setAttribute('data-pm-tz-span', 'true');
        
        element.appendChild(span);
        element.setAttribute(processedAttribute, 'true');
        console.log("Polymarket Timezone: Converted", text.substring(0, 60));
    }
}

// Initial run - wait for timezone to load
loadTimezonePreference().then(() => {
  setTimeout(scanAndConvert, 500); // Small delay for SPA hydration
});

// Observer for SPA navigation
const observer = new MutationObserver(() => {
    if (userTimezone) scanAndConvert();
});

observer.observe(document.body, { childList: true, subtree: true });

console.log("Polymarket Timezone Extension loaded.");

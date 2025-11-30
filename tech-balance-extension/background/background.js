let activeTabId = null;
let activeDomain = null;
let startTime = null;

// Only valid HTTP/HTTPS pages
function isValidUrl(url) {
    return url && (url.startsWith("http://") || url.startsWith("https://"));
}

// Extract main domain (hostname, no www)
function getDomain(url) {
    try {
        const hostname = new URL(url).hostname;
        return hostname.replace(/^www\./, '');
    } catch (e) {
        return null;
    }
}

// Save elapsed time for a domain
function saveStopTime(domain) {
    if (!startTime || !domain) return;
    const stopTime = Date.now();
    const elapsed = stopTime - startTime;

    chrome.storage.local.get(['timeData'], (result) => {
        const data = result.timeData || {};
        if (!data[domain]) data[domain] = 0;
        data[domain] += elapsed;
        chrome.storage.local.set({ timeData: data });
        startTime = null;
    });
}

// Handle tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    if (activeTabId !== null && activeDomain && startTime) {
        saveStopTime(activeDomain);
    }

    activeTabId = activeInfo.tabId;
    const tab = await chrome.tabs.get(activeTabId);
    if (!isValidUrl(tab.url)) {
        activeDomain = null;
        startTime = null;
        return;
    }

    activeDomain = getDomain(tab.url);
    startTime = Date.now();
});

// Handle tab updates (like navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId !== activeTabId) return;
    if (!changeInfo.url || !isValidUrl(changeInfo.url)) return;

    const newDomain = getDomain(changeInfo.url);
    if (!newDomain || newDomain === activeDomain) return; // same domain, ignore

    // Save old domain time
    if (activeDomain && startTime) saveStopTime(activeDomain);

    // Start tracking new domain
    activeDomain = newDomain;
    startTime = Date.now();
});

// Handle tab closure
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === activeTabId && activeDomain && startTime) {
        saveStopTime(activeDomain);
        activeTabId = null;
        activeDomain = null;
        startTime = null;
    }
});
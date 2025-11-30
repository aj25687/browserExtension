let activeTabId = null;
let activeUrl = null;
let startTime = null;

// Ignore internal Chrome pages
function isValidUrl(url) {
    return url && !url.startsWith('chrome://') && !url.startsWith('chrome-extension://');
}

// Tab activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    // Save previous tab
    if (activeTabId !== null && activeUrl && startTime) {
        saveStopTime(activeUrl);
    }

    // Start new tab
    activeTabId = activeInfo.tabId;
    const tab = await chrome.tabs.get(activeTabId);
    if (!isValidUrl(tab.url)) {
        activeUrl = null;
        startTime = null;
        return;
    }
    activeUrl = tab.url.replace(/^www\./, '');
    startTime = Date.now();
});

// Tab updated (URL change)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === activeTabId && changeInfo.url && isValidUrl(changeInfo.url)) {
        if (activeUrl && startTime) saveStopTime(activeUrl);

        activeUrl = changeInfo.url.replace(/^www\./, '');
        startTime = Date.now();
    }
});

// Tab closed
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === activeTabId && activeUrl && startTime) {
        saveStopTime(activeUrl);
        activeTabId = null;
        activeUrl = null;
        startTime = null;
    }
});

// Save elapsed time to timeData in storage
function saveStopTime(url) {
    if (!startTime) return;
    const stopTime = Date.now();
    const elapsed = stopTime - startTime;

    chrome.storage.local.get(['timeData'], (result) => {
        const data = result.timeData || {};
        if (!data[url]) data[url] = 0;
        data[url] += elapsed;
        chrome.storage.local.set({ timeData: data });
        startTime = null;
    });
}

// Optional helper: calculate minutes for a site
function getMinutesForUrl(url, callback) {
    chrome.storage.local.get(['timeData'], (result) => {
        const data = result.timeData || {};
        const ms = data[url] || 0;
        callback(Math.floor(ms / 60000));
    });
}
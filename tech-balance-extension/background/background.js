let activeTabId = null;
let activeUrl = null;
let startTime = null;

// Helper: ignore chrome internal pages
function isValidUrl(url) {
    return url && !url.startsWith('chrome://') && !url.startsWith('chrome-extension://');
}

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
    activeUrl = tab.url;
    startTime = Date.now();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === activeTabId && changeInfo.url && isValidUrl(changeInfo.url)) {
        // Save old URL
        if (activeUrl && startTime) saveStopTime(activeUrl);

        // Start new URL
        activeUrl = changeInfo.url;
        startTime = Date.now();
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === activeTabId && activeUrl && startTime) {
        saveStopTime(activeUrl);
        activeTabId = null;
        activeUrl = null;
        startTime = null;
    }
});

function saveStopTime(url) {
    const stopTime = Date.now();
    chrome.storage.local.get(['siteTimes'], (result) => {
        const siteTimes = result.siteTimes || {};
        if (!siteTimes[url]) siteTimes[url] = [];
        siteTimes[url].push({ start: startTime, stop: stopTime });
        chrome.storage.local.set({ siteTimes });
        startTime = null; // reset startTime until next tab activation
    });
}

// Function to calculate total minutes on a site
function getMinutesForUrl(url, callback) {
    chrome.storage.local.get(['siteTimes'], (result) => {
        const siteTimes = result.siteTimes || {};
        const times = siteTimes[url] || [];
        let total = 0;
        for (const t of times) {
            if (t.start && t.stop) total += (t.stop - t.start);
        }
        callback(Math.floor(total / 60000)); // ms → minutes
    });
}
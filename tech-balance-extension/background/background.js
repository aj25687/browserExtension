let activeTab = null;
let activeStartTime = null;

// Track when the user switches tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    handleTabChange(activeInfo.tabId);
});

// Track when a tab updates (reloads, navigates)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") {
        handleTabChange(tabId);
    }
});

async function handleTabChange(tabId) {
    // End the old session
    if (activeTab !== null) {
        saveTime(activeTab);
    }

    // Start a new one
    activeTab = tabId;
    activeStartTime = Date.now();
}

// Save time spent on a tab
function saveTime(tabId) {
    if (!activeStartTime) return;
    const duration = Date.now() - activeStartTime;

    chrome.tabs.get(tabId, (tab) => {
        if (!tab || !tab.url) return;

        const domain = new URL(tab.url).hostname;

        chrome.storage.local.get(["timeData"], (res) => {
            const data = res.timeData || {};
            data[domain] = (data[domain] || 0) + duration;

            chrome.storage.local.set({ timeData: data });
        });
    });

    activeStartTime = null;
}

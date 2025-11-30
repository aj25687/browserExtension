let activeTab = null;
let activeStartTime = null;
const SAVE_INTERVAL = 1000; // Save every 1 second

// Normalize URL to main domain
function getDomain(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch (e) {
        return null;
    }
}

// Send message safely
function safeSend(tabId, msg) {
    chrome.tabs.sendMessage(tabId, msg, () => {
        if (chrome.runtime.lastError) {}
    });
}

// Save elapsed time for a tab
function saveTime(tabId) {
    if (!activeStartTime) return;

    const duration = Date.now() - activeStartTime;
    activeStartTime = Date.now(); // reset timer

    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab || !tab.url) return;

        const domain = getDomain(tab.url);
        if (!domain) return;

        chrome.storage.local.get(["timeData", "limits", "blockModes"], (res) => {
            const data = res.timeData || {};
            const limits = res.limits || {};
            const blockModes = res.blockModes || {};

            // accumulate time per domain
            data[domain] = (data[domain] || 0) + duration;
            chrome.storage.local.set({ timeData: data });

            // check limit
            const limit = limits[domain];
            const mode = blockModes[domain] || "soft";
            if (limit !== undefined && Math.floor(data[domain] / 60000) >= limit) {
                safeSend(tabId, { action: "applyBlock", mode });
                chrome.tabs.update(tabId, { muted: true });
            }
        });
    });
}

// Handle tab activation
chrome.tabs.onActivated.addListener(info => {
    if (activeTab !== null) saveTime(activeTab);
    activeTab = info.tabId;
    activeStartTime = Date.now();
});

// Handle tab updates (navigation, reload)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "complete") {
        if (activeTab !== null) saveTime(activeTab);
        activeTab = tabId;
        activeStartTime = Date.now();
    }
});

// Handle tab removal
chrome.tabs.onRemoved.addListener(tabId => {
    if (tabId === activeTab) {
        saveTime(tabId);
        activeTab = null;
        activeStartTime = null;
    }
});

// Periodically save active tab time
setInterval(() => {
    if (activeTab !== null) saveTime(activeTab);
}, SAVE_INTERVAL);

// Initialize: track current active tab on load
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
        activeTab = tabs[0].id;
        activeStartTime = Date.now();
    }
});

// Listen for soft override messages from content scripts
chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.action === "soft_override" && sender.tab) {
        safeSend(sender.tab.id, {
            action: "show_goal_banner",
            goal: msg.goal
        });
    }
});
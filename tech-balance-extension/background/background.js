let activeTab = null;
let activeStartTime = null;
const SAVE_INTERVAL = 5000; // Save every 5 seconds

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
                // show break overlay
                safeSend(tabId, { action: "showBreakOverlay" });

                // blur/mute while overlay is up
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

// Listen for user choices from content script
chrome.runtime.onMessage.addListener((msg, sender) => {
    if (!sender.tab) return;

    if (msg.action === "takeBreak") {
        chrome.tabs.remove(sender.tab.id); // close the tab
    } else if (msg.action === "keepGoing") {
        chrome.tabs.update(sender.tab.id, { muted: false });
        // remove overlay via content script
        chrome.tabs.sendMessage(sender.tab.id, { action: "removeOverlay" });
    } else if (msg.action === "soft_override") {
        safeSend(sender.tab.id, {
            action: "show_goal_banner",
            goal: msg.goal
        });
    }
});
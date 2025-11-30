let activeTab = null;
let activeStartTime = null;
const SAVE_INTERVAL = 5000; // save every 5 sec
const readyTabs = new Set(); // tabs with content.js ready
const pausedTabs = new Set(); // tabs paused while overlay visible

function getDomain(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch (e) {
        return null;
    }
}

function saveTime(tabId) {
    if (pausedTabs.has(tabId)) return; // skip while overlay active
    if (!activeStartTime) return;

    const duration = Date.now() - activeStartTime;
    activeStartTime = Date.now();

    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab || !tab.url) return;

        const domain = getDomain(tab.url);
        if (!domain) return;

        chrome.storage.local.get(["timeData", "limits", "blockModes"], (res) => {
            const data = res.timeData || {};
            const limits = res.limits || {};
            const blockModes = res.blockModes || {};

            data[domain] = (data[domain] || 0) + duration;
            chrome.storage.local.set({ timeData: data });

            const limit = limits[domain];
            const mode = blockModes[domain] || "soft";
            const spentMin = Math.floor(data[domain] / 60000);

            if (limit !== undefined && spentMin >= limit) {
                showOverlay(tabId);
            }
        });
    });
}

function showOverlay(tabId) {
    if (!readyTabs.has(tabId)) return;
    pausedTabs.add(tabId); // pause counting
    chrome.tabs.sendMessage(tabId, { action: "showBreakOverlay" });
    chrome.tabs.update(tabId, { muted: true });
}

chrome.tabs.onActivated.addListener(info => {
    if (activeTab !== null) saveTime(activeTab);
    activeTab = info.tabId;
    activeStartTime = Date.now();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "complete") {
        if (activeTab !== null) saveTime(activeTab);
        activeTab = tabId;
        activeStartTime = Date.now();
    }
});

chrome.tabs.onRemoved.addListener(tabId => {
    readyTabs.delete(tabId);
    pausedTabs.delete(tabId);
    if (tabId === activeTab) {
        saveTime(tabId);
        activeTab = null;
        activeStartTime = null;
    }
});

setInterval(() => {
    if (activeTab !== null) saveTime(activeTab);
}, SAVE_INTERVAL);

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
        activeTab = tabs[0].id;
        activeStartTime = Date.now();
    }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.action === "contentReady") {
        if (sender.tab && sender.tab.id) readyTabs.add(sender.tab.id);
        return;
    }

    if (!sender.tab) return;
    const tabId = sender.tab.id;

    if (msg.action === "takeBreak") {
        pausedTabs.delete(tabId);
        chrome.tabs.remove(tabId);
    } 
    else if (msg.action === "updateGoalAndLimit") {
        pausedTabs.delete(tabId); // resume counting

        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError || !tab || !tab.url) return;
            const domain = getDomain(tab.url);
            if (!domain) return;

            // Add new limit to existing limit
            chrome.storage.local.get(["limits"], (res) => {
                const limits = res.limits || {};
                const oldLimit = limits[domain] || 0;
                limits[domain] = oldLimit + msg.newLimit;
                chrome.storage.local.set({ limits });
            });

            // save goal (optional)
            chrome.storage.local.get(["goals"], (res) => {
                const goals = res.goals || {};
                goals[domain] = msg.goal;
                chrome.storage.local.set({ goals });
            });

            // unmute tab
            chrome.tabs.update(tabId, { muted: false });

            // reset timer
            activeStartTime = Date.now();
        });
    }
    else if (msg.action === "soft_override") {
        chrome.tabs.sendMessage(tabId, {
            action: "show_goal_banner",
            goal: msg.goal
        });
    }
});
let activeTab = null;
let activeStartTime = null;

// record time every X ms even if tab is active
const SAVE_INTERVAL = 5000; // 5 seconds

function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function safeSend(tabId, msg) {
    chrome.tabs.sendMessage(tabId, msg, () => {
        if (chrome.runtime.lastError) {}
    });
}

function getDomain(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch (e) {
        return null;
    }
}

async function handleTabChange(tabId) {
    // save time for previous tab
    if (activeTab !== null && activeStartTime) {
        await saveTime(activeTab);
    }

    activeTab = tabId;
    activeStartTime = Date.now();
}

// save elapsed time for tabId
function saveTime(tabId) {
    return new Promise((resolve) => {
        if (!activeStartTime) return resolve();

        const duration = Date.now() - activeStartTime;
        activeStartTime = Date.now(); // reset start time

        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError || !tab || !tab.url) return resolve();

            const domain = getDomain(tab.url);
            if (!domain) return resolve();

            const dayKey = getTodayKey();

            chrome.storage.local.get(["timeData", "limits", "blockModes"], (res) => {
                const data = res.timeData || {};
                const limits = res.limits || {};
                const blockModes = res.blockModes || {};

                if (!data[dayKey]) data[dayKey] = {};
                data[dayKey][domain] = (data[dayKey][domain] || 0) + duration;

                chrome.storage.local.set({ timeData: data });

                const limit = limits[domain];
                const mode = blockModes[domain] || "soft";

                if (limit !== undefined) {
                    const spentMin = Math.floor(data[dayKey][domain] / 60000);

                    if (spentMin >= limit) {
                        safeSend(tabId, { action: "applyBlock", mode });
                        chrome.tabs.update(tabId, { muted: true });
                    }
                }

                resolve();
            });
        });
    });
}

// listen to tab changes
chrome.tabs.onActivated.addListener(info => handleTabChange(info.tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "complete") handleTabChange(tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === activeTab) saveTime(tabId).then(() => {
        activeTab = null;
        activeStartTime = null;
    });
});

// periodically save active tab time
setInterval(() => {
    if (activeTab !== null) saveTime(activeTab);
}, SAVE_INTERVAL);

// initialize: find the currently active tab when extension loads
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) handleTabChange(tabs[0].id);
});
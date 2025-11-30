console.log("BACKGROUND SCRIPT LOADED");
let activeTab = null;
let activeStart = null;

function getHostname(url) {
    try {
        return new URL(url).hostname.replace("www.", "");
    } catch {
        return "";
    }
}

function getDayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Save time spent on the last active tab
function saveActiveTime() {
    if (!activeTab || !activeStart) return;

    chrome.tabs.get(activeTab, tab => {
        if (chrome.runtime.lastError || !tab || !tab.url) return;

        const hostname = getHostname(tab.url);
        const dayKey = getDayKey();
        const duration = Date.now() - activeStart;

        chrome.storage.local.get(["timeData", "limits", "blockTypes", "objectives"], res => {
            const timeData = res.timeData || {};
            const limits = res.limits || {};
            const blockTypes = res.blockTypes || {};
            const objectives = res.objectives || {};

            if (!timeData[dayKey]) timeData[dayKey] = {};
            if (!timeData[dayKey][hostname]) timeData[dayKey][hostname] = 0;

            timeData[dayKey][hostname] += duration;

            chrome.storage.local.set({ timeData });

            const spentMin = Math.floor(timeData[dayKey][hostname] / 60000);
            const limit = limits[hostname];
            const blockType = blockTypes[hostname];

            if (limit !== undefined && spentMin >= limit) {
                chrome.tabs.update(activeTab, { muted: true });

                if (blockType === "hard") {
                    chrome.tabs.sendMessage(activeTab, {
                        action: "showHardBlock"
                    });
                } else {
                    chrome.tabs.sendMessage(activeTab, {
                        action: "showSoftBlock",
                        objective: objectives[hostname] || null
                    });
                }
            }
        });
    });

    activeStart = Date.now();
}

// When you switch tabs
chrome.tabs.onActivated.addListener(activeInfo => {
    saveActiveTime();
    activeTab = activeInfo.tabId;
    activeStart = Date.now();

    chrome.tabs.get(activeTab, tab => {
        if (!tab || !tab.url) return;
    });
});

// When a tab finishes loading
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") return;

    saveActiveTime();
    activeTab = tabId;
    activeStart = Date.now();
});

// Handle soft block objective
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    if (!tabId) return;

    if (msg.action === "objectiveEntered") {
        const hostname = msg.hostname;

        chrome.storage.local.get(["objectives"], res => {
            const objectives = res.objectives || {};
            objectives[hostname] = msg.objective;

            chrome.storage.local.set({ objectives }, () => {
                chrome.tabs.update(tabId, { muted: false });

                chrome.tabs.sendMessage(tabId, {
                    action: "hideOverlay"
                });

                sendResponse({ ok: true });
            });
        });

        return true;
    }

    if (msg.action === "setSiteSettings") {
        const { hostname, limit, blockType } = msg;

        chrome.storage.local.get(["limits", "blockTypes"], res => {
            const limits = res.limits || {};
            const blockTypes = res.blockTypes || {};

            limits[hostname] = limit;
            blockTypes[hostname] = blockType;

            chrome.storage.local.set({ limits, blockTypes }, () => {
                sendResponse({ ok: true });
            });
        });

        return true;
    }
});
let activeTab = null;
let activeStartTime = null;

function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

chrome.tabs.onActivated.addListener((info) => {
    handleTabChange(info.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "complete") {
        handleTabChange(tabId);
    }
});

function handleTabChange(tabId) {
    if (activeTab !== null) {
        saveTime(activeTab);
    }
    activeTab = tabId;
    activeStartTime = Date.now();
}

function safeSend(tabId, msg) {
    chrome.tabs.sendMessage(tabId, msg, () => {
        if (chrome.runtime.lastError) {
            // silently ignore
        }
    });
}

function saveTime(tabId) {
    if (!activeStartTime) return;

    const duration = Date.now() - activeStartTime;
    activeStartTime = null;

    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) return;
        if (!tab || !tab.url) return;

        // Only record hostname + first path segment
        const urlObj = new URL(tab.url);
        const hostname = urlObj.hostname.replace(/^www\./, "");
        const pathSegment = urlObj.pathname.split("/")[1]; // first segment after "/"
        const domainPath = pathSegment ? `${hostname}/${pathSegment}` : hostname;

        const dayKey = getTodayKey();

        chrome.storage.local.get(["timeData", "limits", "blockModes"], (res) => {
            const data = res.timeData || {};
            const limits = res.limits || {};
            const blockModes = res.blockModes || {};

            if (!data[dayKey]) data[dayKey] = {};
            data[dayKey][domainPath] = (data[dayKey][domainPath] || 0) + duration;

            chrome.storage.local.set({ timeData: data });

            const limit = limits[hostname]; // still check limit by main domain
            const mode = blockModes[hostname] || "soft";

            if (limit !== undefined) {
                const spentMin = Math.floor(data[dayKey][domainPath] / 60000);

                if (spentMin >= limit) {
                    safeSend(tabId, {
                        action: "applyBlock",
                        mode: mode
                    });
                    chrome.tabs.update(tabId, { muted: true });
                }
            }
        });
    });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.action === "soft_override") {
        if (!sender.tab) return;
        safeSend(sender.tab.id, {
            action: "show_goal_banner",
            goal: msg.goal
        });
    }
});
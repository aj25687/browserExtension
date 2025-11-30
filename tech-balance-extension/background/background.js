let activeTab = null;
let activeStartTime = null;

function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

chrome.tabs.onActivated.addListener(async (info) => {
    handleTabChange(info.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "complete") {
        handleTabChange(tabId);
    }
});

async function handleTabChange(tabId) {
    if (activeTab !== null) {
        saveTime(activeTab);
    }
    activeTab = tabId;
    activeStartTime = Date.now();
}

function saveTime(tabId) {
    if (!activeStartTime) return;

    const duration = Date.now() - activeStartTime;
    activeStartTime = null;

    chrome.tabs.get(tabId, (tab) => {
        if (!tab || !tab.url) return;

        const domain = new URL(tab.url).hostname;
        const dayKey = getTodayKey();

        chrome.storage.local.get(["timeData", "limits"], (res) => {
            const data = res.timeData || {};
            const limits = res.limits || {};

            if (!data[dayKey]) data[dayKey] = {};
            data[dayKey][domain] = (data[dayKey][domain] || 0) + duration;

            chrome.storage.local.set({ timeData: data });

            const limit = limits[domain];
            if (limit !== undefined) {
                const spentMin = Math.floor(data[dayKey][domain] / 60000);
                if (spentMin >= limit) {
                    chrome.tabs.sendMessage(tabId, {
                    action: "applyBlock",
                    mode
                });
                chrome.tabs.update(tabId, { muted: true });
            }
            }
        });
    });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.action === "soft_override") {
        chrome.tabs.sendMessage(sender.tab.id, {
            action: "show_goal_banner",
            goal: msg.goal
        });
    }
});
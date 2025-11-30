// Track time per hostname
const siteState = {};  
// Example structure:
// siteState["youtube.com"] = {
//     timeSpent: 0,
//     limit: 120,
//     blockType: "soft",
//     objective: null,
//     timer: null
// };

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!tab.url || changeInfo.status !== "complete") return;
    handleTab(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(active => {
    chrome.tabs.get(active.tabId, tab => {
        if (chrome.runtime.lastError || !tab || !tab.url) return;
        handleTab(tab.id, tab.url);
    });
});

// MAIN HANDLER
function handleTab(tabId, url) {
    const hostname = getHostname(url);
    if (!siteState[hostname]) return;

    startTimer(tabId, hostname);
}

function startTimer(tabId, hostname) {
    const state = siteState[hostname];
    if (!state) return;

    if (state.timer) clearInterval(state.timer);

    state.timer = setInterval(() => {
        state.timeSpent++;

        // Soft block
        if (state.blockType === "soft" && state.timeSpent >= state.limit) {
            activateSoftBlock(tabId, hostname);
        }

        // Hard block
        if (state.blockType === "hard") {
            activateHardBlock(tabId, hostname);
        }

    }, 1000);
}

function activateSoftBlock(tabId, hostname) {
    const state = siteState[hostname];

    chrome.tabs.update(tabId, { muted: true });

    chrome.tabs.sendMessage(tabId, {
        action: "showSoftBlock",
        objective: state.objective
    });
}

function activateHardBlock(tabId, hostname) {
    chrome.tabs.update(tabId, { muted: true });

    chrome.tabs.sendMessage(tabId, {
        action: "showHardBlock"
    });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    if (!tabId) return;

    if (msg.action === "setSiteSettings") {
        const { hostname, limit, blockType } = msg;

        siteState[hostname] = {
            timeSpent: 0,
            limit,
            blockType,
            objective: null,
            timer: null
        };

        sendResponse({ ok: true });
        return;
    }

    if (msg.action === "objectiveEntered") {
        const hostname = msg.hostname;
        const objective = msg.objective;

        if (!siteState[hostname]) return;

        siteState[hostname].objective = objective;

        chrome.tabs.update(tabId, { muted: false });

        chrome.tabs.sendMessage(tabId, {
            action: "hideOverlay"
        });

        sendResponse({ ok: true });
        return;
    }
});

function getHostname(url) {
    try {
        return new URL(url).hostname.replace("www.", "");
    } catch {
        return "";
    }
}
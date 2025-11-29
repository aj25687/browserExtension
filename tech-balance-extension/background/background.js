// background service worker
let activeTabId = null;
let activeStartTime = null;

// Helpers
async function getStorage(keys = []) {
  return new Promise((res) => chrome.storage.local.get(keys, res));
}

async function setStorage(obj) {
  return new Promise((res) => chrome.storage.local.set(obj, res));
}

function now() {
  return Date.now();
}

// DAILY RESET CHECK
async function checkDailyReset() {
  const today = new Date().toLocaleDateString();
  const res = await getStorage(["lastDate", "timeData"]);
  const lastDate = res.lastDate;

  if (lastDate !== today) {
    await setStorage({ timeData: {}, lastDate: today });
    console.log("Tech Balance: daily usage reset");
  }
}

// Save time spent on a tab
async function saveTimeForTab(tabId) {
  if (!activeStartTime) return;
  const duration = now() - activeStartTime;

  try {
    const tab = await chrome.tabs.get(tabId);
    const url = tab?.url;
    if (!url) return;

    const domain = new URL(url).hostname;
    const res = await getStorage(["timeData"]);
    const data = res.timeData || {};

    data[domain] = (data[domain] || 0) + duration;
    await setStorage({ timeData: data });
  } catch (e) {
    // Tab might be gone
  } finally {
    activeStartTime = null;
  }
}

// Start tracking a tab
async function startTracking(tabId) {
  if (activeTabId !== null && activeStartTime) {
    await saveTimeForTab(activeTabId);
  }

  activeTabId = tabId;
  activeStartTime = now();
}

// Tab Activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await startTracking(activeInfo.tabId);
});

// Tab Updated
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    const current = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (current[0] && current[0].id === tabId) {
      await startTracking(tabId);
    }
  }
});

// Window focus change
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    if (activeTabId !== null) {
      await saveTimeForTab(activeTabId);
      activeTabId = null;
    }
    return;
  }

  const tabs = await chrome.tabs.query({ active: true, windowId });
  if (tabs[0]) {
    await startTracking(tabs[0].id);
  }
});

// Tab closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === activeTabId) {
    await saveTimeForTab(tabId);
    activeTabId = null;
  }
});

// On startup
chrome.runtime.onStartup.addListener(async () => {
  await checkDailyReset();
  activeTabId = null;
  activeStartTime = null;
});

// Wake service worker → ensure daily reset
checkDailyReset();

// Alarms: run threshold check every 1 minute
chrome.alarms.create("thresholdCheck", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  // DAILY RESET CHECK
  await checkDailyReset();

  if (alarm.name !== "thresholdCheck") return;

  try {
    const res = await getStorage(["timeData", "limits", "defaultLimitMinutes", "pausedDomains"]);
    const timeData = res.timeData || {};
    const limits = res.limits || {};
    const defaultLimit = Number(res.defaultLimitMinutes) || 30;
    const pausedDomains = res.pausedDomains || {};

    const activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const activeTab = activeTabs[0];
    
    if (!activeTab) return;

    const tabId = activeTab.id;
    const url = activeTab.url;
    if (!url) return;

    const domain = new URL(url).hostname;

    if (pausedDomains[domain]) return;

    const stored = timeData[domain] || 0;
    const running = (activeTabId === tabId && activeStartTime)
      ? now() - activeStartTime
      : 0;

    const total = stored + running;
    const limitMinutes = Number(limits[domain] ?? defaultLimit);
    const limitMs = limitMinutes * 60000;

    if (limitMs > 0 && total >= limitMs) {
      chrome.tabs.sendMessage(tabId, {
        action: "limitReached",
        domain,
        total,
        limitMinutes
      });
    }
  } catch (e) {
    console.error("Alarm check failed", e);
  }
});

// Messages from content script (extend, pause, save time, etc)
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg?.action === "extendDomain") {
    const { domain, extraMinutes } = msg;
    const res = await getStorage(["limits"]);
    const limits = res.limits || {};

    const currentLimit = Number(limits[domain] || 0);
    limits[domain] = currentLimit + Number(extraMinutes);

    await setStorage({ limits });
    sendResponse({ ok: true });
  }

  else if (msg?.action === "pauseDomain") {
    const { domain, pauseMinutes } = msg;
    const res = await getStorage(["pausedDomains"]);
    const paused = res.pausedDomains || {};

    paused[domain] = true;
    await setStorage({ pausedDomains: paused });

    chrome.alarms.create(`unpause_${domain}`, {
      when: Date.now() + pauseMinutes * 60000
    });

    sendResponse({ ok: true });
  }

  else if (msg?.action === "unpauseNow") {
    const { domain } = msg;
    const res = await getStorage(["pausedDomains"]);
    const paused = res.pausedDomains || {};

    delete paused[domain];
    await setStorage({ pausedDomains: paused });

    sendResponse({ ok: true });
  }

  else if (msg?.action === "saveTimeNow") {
    if (activeTabId !== null && activeStartTime) {
      await saveTimeForTab(activeTabId);
    }
    sendResponse({ ok: true });
  }
});

// Unpause alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("unpause_")) return;

  const domain = alarm.name.replace("unpause_", "");
  const res = await getStorage(["pausedDomains"]);
  const paused = res.pausedDomains || {};

  delete paused[domain];
  await setStorage({ pausedDomains: paused });

  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    try {
      const d = new URL(t.url).hostname;
      if (d === domain) {
        chrome.tabs.sendMessage(t.id, {
          action: "unpauseDomain",
          domain
        });
      }
    } catch {}
  }
});
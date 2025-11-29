// background service worker
let activeTabId = null;
let activeStartTime = null;

// timeData: { domain: ms }
async function getStorage(keys = []) {
  return new Promise((res) => chrome.storage.local.get(keys, res));
}

async function setStorage(obj) {
  return new Promise((res) => chrome.storage.local.set(obj, res));
}

function now() {
  return Date.now();
}

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
    // tab might be gone
  } finally {
    activeStartTime = null;
  }
}

async function startTracking(tabId) {
  // save previous
  if (activeTabId !== null && activeStartTime) {
    await saveTimeForTab(activeTabId);
  }

  activeTabId = tabId;
  activeStartTime = now();
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await startTracking(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // start tracking on navigation complete
  if (changeInfo.status === "complete") {
    // if the updated tab is active, restart tracking
    const current = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (current[0] && current[0].id === tabId) {
      await startTracking(tabId);
    }
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // lost focus
    if (activeTabId !== null) {
      await saveTimeForTab(activeTabId);
      activeTabId = null;
    }
    return;
  }
  // window focused: find active tab in that window
  const tabs = await chrome.tabs.query({ active: true, windowId });
  if (tabs[0]) {
    await startTracking(tabs[0].id);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  if (tabId === activeTabId) {
    await saveTimeForTab(tabId);
    activeTabId = null;
  }
});

chrome.runtime.onStartup.addListener(async () => {
  activeTabId = null;
  activeStartTime = null;
});

// Alarm to check thresholds every 1 minute
chrome.alarms.create("thresholdCheck", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "thresholdCheck") return;

  // compute current tab's time plus stored time
  try {
    const res = await getStorage(["timeData", "limits", "defaultLimitMinutes", "pausedDomains"]);
    const timeData = res.timeData || {};
    const limits = res.limits || {};
    const defaultLimit = Number(res.defaultLimitMinutes) || 30; // default 30 minutes
    const pausedDomains = res.pausedDomains || {}; // domain: true while on break

    // active tab info
    const activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const activeTab = activeTabs[0];
    if (!activeTab) return;

    const tabId = activeTab.id;
    const url = activeTab.url;
    if (!url) return;
    const domain = new URL(url).hostname;

    if (pausedDomains[domain]) {
      // site paused for break, skip
      return;
    }

    const stored = timeData[domain] || 0;
    const running = (activeTabId === tabId && activeStartTime) ? (now() - activeStartTime) : 0;
    const total = stored + running;
    const limitMinutes = Number(limits[domain] ?? defaultLimit);
    const limitMs = limitMinutes * 60 * 1000;

    if (limitMs > 0 && total >= limitMs) {
      // Notify the tab
      chrome.tabs.sendMessage(tabId, { action: "limitReached", domain, total, limitMinutes });
    }
  } catch (e) {
    console.error("Alarm check failed", e);
  }
});

// allow content to request a save when user chooses to keep going X minutes
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg?.action === "extendDomain") {
    const { domain, extraMinutes } = msg;
    const res = await getStorage(["limits"]);
    const limits = res.limits || {};
    const nowLimit = Number(limits[domain] || 0);
    // policy: if site had a limit set, extend by adding extra to limits. If no limit set, create one from default + extra
    limits[domain] = (nowLimit || 0) + Number(extraMinutes);
    await setStorage({ limits });
    sendResponse({ ok: true });
  } else if (msg?.action === "pauseDomain") {
    // pause site for break for X minutes
    const { domain, pauseMinutes } = msg;
    const res = await getStorage(["pausedDomains"]);
    const paused = res.pausedDomains || {};
    paused[domain] = true;
    await setStorage({ pausedDomains: paused });

    // schedule unpause alarm
    chrome.alarms.create(`unpause_${domain}`, { when: Date.now() + (pauseMinutes * 60 * 1000) });
    sendResponse({ ok: true });
  } else if (msg?.action === "unpauseNow") {
    const { domain } = msg;
    const res = await getStorage(["pausedDomains"]);
    const paused = res.pausedDomains || {};
    delete paused[domain];
    await setStorage({ pausedDomains: paused });
    sendResponse({ ok: true });
  } else if (msg?.action === "saveTimeNow") {
    // save current running time for the active tab
    if (activeTabId !== null && activeStartTime) {
      await saveTimeForTab(activeTabId);
    }
    sendResponse({ ok: true });
  }
  // return true to indicate async response? not needed because we call sendResponse synchronously.
});

// handle unpause alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("unpause_")) return;
  const domain = alarm.name.replace("unpause_", "");
  const res = await getStorage(["pausedDomains"]);
  const paused = res.pausedDomains || {};
  delete paused[domain];
  await setStorage({ pausedDomains: paused });
  // optionally notify tabs of that domain to remove overlay
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    try {
      const u = t.url;
      if (!u) continue;
      const d = new URL(u).hostname;
      if (d === domain) {
        chrome.tabs.sendMessage(t.id, { action: "unpauseDomain", domain });
      }
    } catch (e) {}
  }
});
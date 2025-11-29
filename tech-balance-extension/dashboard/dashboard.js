async function refresh() {
  const res = await chrome.storage.local.get(["timeData", "limits", "defaultLimitMinutes", "pausedDomains"]);
  const data = res.timeData || {};
  const limits = res.limits || {};
  const defaultLimit = res.defaultLimitMinutes || 30;
  const paused = res.pausedDomains || {};

  const usageDiv = document.getElementById("usage");
  usageDiv.innerHTML = "";
  for (const site in data) {
    const mins = Math.floor(data[site] / 60000);
    const limit = limits[site] ?? defaultLimit;
    const pausedText = paused[site] ? " (paused)" : "";
    const p = document.createElement("p");
    p.innerHTML = `<strong>${site}</strong>: ${mins} min. Limit: ${limit} min${pausedText} <button data-site="${site}" class="clearSite">clear</button> <button data-site="${site}" class="pauseSite">unpause/clear pause</button>`;
    usageDiv.appendChild(p);
  }

  const limitsDiv = document.getElementById("limits");
  limitsDiv.innerHTML = "";
  for (const site in limits) {
    const p = document.createElement("p");
    p.innerHTML = `<strong>${site}</strong>: ${limits[site]} min <button data-site="${site}" class="deleteLimit">delete</button>`;
    limitsDiv.appendChild(p);
  }
}

document.getElementById("setSiteLimit").addEventListener("click", async () => {
  const site = document.getElementById("siteInput").value.trim();
  const minutes = Number(document.getElementById("siteLimit").value) || 0;
  if (!site) return alert("Enter a site hostname like example.com");
  const res = await chrome.storage.local.get(["limits"]);
  const limits = res.limits || {};
  limits[site] = minutes;
  await chrome.storage.local.set({ limits });
  document.getElementById("siteInput").value = "";
  document.getElementById("siteLimit").value = "";
  refresh();
});

document.getElementById("resetData").addEventListener("click", async () => {
  await chrome.storage.local.set({ timeData: {} });
  refresh();
});

document.getElementById("exportCsv").addEventListener("click", async () => {
  const res = await chrome.storage.local.get(["timeData"]);
  const data = res.timeData || {};
  let csv = "site,minutes\n";
  for (const site in data) {
    csv += `${site},${Math.floor(data[site]/60000)}\n`;
  }
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tech-balance-usage.csv";
  a.click();
  URL.revokeObjectURL(url);
});

document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("clearSite")) {
    const site = e.target.dataset.site;
    const res = await chrome.storage.local.get(["timeData"]);
    const data = res.timeData || {};
    delete data[site];
    await chrome.storage.local.set({ timeData: data });
    refresh();
  } else if (e.target.classList.contains("deleteLimit")) {
    const site = e.target.dataset.site;
    const res = await chrome.storage.local.get(["limits"]);
    const limits = res.limits || {};
    delete limits[site];
    await chrome.storage.local.set({ limits });
    refresh();
  } else if (e.target.classList.contains("pauseSite")) {
    const site = e.target.dataset.site;
    // toggle pause
    const res = await chrome.storage.local.get(["pausedDomains"]);
    const paused = res.pausedDomains || {};
    if (paused[site]) delete paused[site];
    else paused[site] = true;
    await chrome.storage.local.set({ pausedDomains: paused });
    refresh();
  }
});

refresh();
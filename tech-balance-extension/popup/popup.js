document.getElementById("openDashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
});

document.getElementById("showToday").addEventListener("click", async () => {
  const res = await chrome.storage.local.get(["timeData"]);
  const data = res.timeData || {};
  let html = "";
  for (const site in data) {
    const minutes = Math.floor(data[site] / 60000);
    html += `${site}: ${minutes} min<br>`;
  }
  document.getElementById("output").innerHTML = html || "No data yet!";
});

async function loadDefault() {
  const res = await chrome.storage.local.get(["defaultLimitMinutes"]);
  document.getElementById("defaultLimit").value = res.defaultLimitMinutes ?? 30;
}
loadDefault();

document.getElementById("saveDefault").addEventListener("click", async () => {
  const v = Number(document.getElementById("defaultLimit").value) || 0;
  await chrome.storage.local.set({ defaultLimitMinutes: v });
  document.getElementById("output").innerHTML = "Saved.";
});
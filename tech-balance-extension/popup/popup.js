document.getElementById("showToday").addEventListener("click", () => {
    chrome.storage.local.get(["timeData"], (res) => {
        const data = res.timeData || {};
        let text = "";

        for (const site in data) {
            const minutes = Math.floor(data[site] / 60000);
            text += `${site}: ${minutes} min<br>`;
        }

        document.getElementById("output").innerHTML = text || "No data yet!";
    });
});

document.getElementById("openDashboard").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("../dashboard/dashboard.html") });
});

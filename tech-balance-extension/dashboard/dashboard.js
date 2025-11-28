chrome.storage.local.get(["timeData"], (res) => {
    const data = res.timeData || {};
    const container = document.getElementById("data");

    let html = "<h2>Time spent by site</h2>";

    for (const site in data) {
        const minutes = Math.floor(data[site] / 60000);
        html += `<p><strong>${site}:</strong> ${minutes} min</p>`;
    }

    container.innerHTML = html || "No usage data yet!";
});

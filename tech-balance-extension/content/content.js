let overlay = null;

// Notify background that content.js is loaded
chrome.runtime.sendMessage({ action: "contentReady" });

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "showBreakOverlay") {
        showBreakOverlay();
    } else if (msg.action === "removeOverlay") {
        removeOverlay();
    } else if (msg.action === "show_goal_banner") {
        showGoalBanner(msg.goal);
    }
});

function showBreakOverlay() {
    removeOverlay();
    overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(255,255,255,0.9)";
    overlay.style.backdropFilter = "blur(6px)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.zIndex = "999999";

    overlay.innerHTML = `
        <h2>You’ve reached your limit!</h2>
        <p>Do you want to take a break or keep going?</p>
        <button id="takeBreak" style="margin:5px;padding:10px 20px;">Take a break</button>
        <button id="keepGoing" style="margin:5px;padding:10px 20px;">Keep going</button>
    `;

    document.body.appendChild(overlay);

    document.getElementById("takeBreak").onclick = () => {
        chrome.runtime.sendMessage({ action: "takeBreak" });
        removeOverlay();
    };
    document.getElementById("keepGoing").onclick = () => {
        chrome.runtime.sendMessage({ action: "keepGoing" });
        removeOverlay();
    };
}

function removeOverlay() {
    if (overlay) {
        overlay.remove();
        overlay = null;
    }
}

// Optional soft override / goal banner
function showGoalBanner(goal) {
    removeOverlay();
    overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(255,255,255,0.9)";
    overlay.style.backdropFilter = "blur(6px)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.zIndex = "999999";

    overlay.innerHTML = `
        <h2>Time limit reached</h2>
        <p>Your goal: ${goal}</p>
        <button id="continueBtn" style="margin:5px;padding:10px 20px;">Continue</button>
    `;

    document.body.appendChild(overlay);
    document.getElementById("continueBtn").onclick = () => removeOverlay();
}
let overlay = null;

// Notify background
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
        removeOverlay();
        askGoalAndNewLimit();
    };
}

function askGoalAndNewLimit() {
    removeOverlay();
    overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(255,255,255,0.95)";
    overlay.style.backdropFilter = "blur(6px)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.zIndex = "999999";

    overlay.innerHTML = `
        <h2>Set your goal and new limit</h2>
        <input id="goalInput" type="text" placeholder="Your goal..." style="margin:5px;padding:5px;width:200px;">
        <input id="limitInput" type="number" placeholder="New limit in minutes" style="margin:5px;padding:5px;width:200px;">
        <button id="saveGoalLimit" style="margin:10px;padding:10px 20px;">Save and continue</button>
    `;

    document.body.appendChild(overlay);

    document.getElementById("saveGoalLimit").onclick = () => {
        const goal = document.getElementById("goalInput").value.trim();
        const newLimit = Number(document.getElementById("limitInput").value);

        if (!goal || isNaN(newLimit) || newLimit <= 0) {
            alert("Enter a goal and valid number for new limit!");
            return;
        }

        chrome.runtime.sendMessage({
            action: "updateGoalAndLimit",
            goal,
            newLimit
        });

        removeOverlay();
    };
}

function removeOverlay() {
    if (overlay) {
        overlay.remove();
        overlay = null;
    }
}

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
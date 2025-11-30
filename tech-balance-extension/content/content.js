console.log("Content script running:", location.hostname);

let blurLayer = null;
let popupContainer = null;
let goalBanner = null;

// === APPLY BLUR ===
function injectBlur() {
    if (blurLayer) return;

    blurLayer = document.createElement("div");
    blurLayer.style.position = "fixed";
    blurLayer.style.top = "0";
    blurLayer.style.left = "0";
    blurLayer.style.width = "100vw";
    blurLayer.style.height = "100vh";
    blurLayer.style.backdropFilter = "blur(12px)";
    blurLayer.style.background = "rgba(0,0,0,0.4)";
    blurLayer.style.zIndex = "999999";
    blurLayer.style.pointerEvents = "none";
    document.body.appendChild(blurLayer);
}

// === POPUP ===
function injectPopup(mode) {
    if (popupContainer) return;

    popupContainer = document.createElement("div");

    let extraContent = "";
    if (mode === "soft") {
        extraContent = `
            <input id="goalInput" placeholder="What are you here to do?"
            style="width: 90%; padding: 8px; margin-top: 10px;"/>
        `;
    }

    popupContainer.innerHTML = `
        <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 10px;
            z-index: 1000000;
            text-align: center;
            pointer-events: auto;
        ">
            <h2>${mode === "hard" ? "Time's up." : "Take a break?"}</h2>

            ${extraContent}

            <button id="continueBtn" ${mode === "hard" ? "disabled style='opacity:0.5; cursor:not-allowed;'" : ""}>
                Keep Going
            </button>

            <button id="breakBtn">Take Break</button>
        </div>
    `;

    document.body.appendChild(popupContainer);

    const continueBtn = document.getElementById("continueBtn");
    const breakBtn = document.getElementById("breakBtn");

    if (continueBtn) {
        continueBtn.onclick = () => {
            if (mode === "soft") {
                const goal = document.getElementById("goalInput").value.trim();
                chrome.runtime.sendMessage({ action: "soft_override", goal });
            }
            chrome.runtime.sendMessage({ action: "nudge_continue" });
        };
    }

    breakBtn.onclick = () => {
        chrome.runtime.sendMessage({ action: "nudge_break" });
    };
}

// === GOAL BANNER ===
function injectGoalBanner(text) {
    if (goalBanner) goalBanner.remove();

    goalBanner = document.createElement("div");
    goalBanner.textContent = text;
    goalBanner.style.position = "fixed";
    goalBanner.style.top = "0";
    goalBanner.style.left = "0";
    goalBanner.style.width = "100%";
    goalBanner.style.padding = "10px";
    goalBanner.style.background = "#222";
    goalBanner.style.color = "white";
    goalBanner.style.fontSize = "16px";
    goalBanner.style.textAlign = "center";
    goalBanner.style.zIndex = "1000001";
    goalBanner.style.pointerEvents = "none";

    document.body.appendChild(goalBanner);
}

// === LISTENER ===
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "applyBlock") {
        injectBlur();
        injectPopup(msg.mode);
    }

    if (msg.action === "nudge_continue") {
        if (blurLayer) blurLayer.remove();
        if (popupContainer) popupContainer.remove();
        blurLayer = null;
        popupContainer = null;
    }

    if (msg.action === "nudge_break") {
        location.href = "about:blank";
    }

    if (msg.action === "show_goal_banner") {
        injectGoalBanner(msg.goal);
    }
});
// Build overlay only when needed
let overlay = null;

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "showSoftBlock") {
        showSoftBlock(msg.objective);
    }

    if (msg.action === "showHardBlock") {
        showHardBlock();
    }

    if (msg.action === "hideOverlay") {
        removeOverlay();
    }
});

function showSoftBlock(objective) {
    removeOverlay();
    createOverlay();

    overlay.innerHTML = `
        <div class="extension-ui" style="position:fixed;top:0;left:0;width:100%;height:100%;display:flex;justify-content:center;align-items:center;z-index:999999;">
            <div style="background:white;padding:20px;border-radius:6px;max-width:300px;text-align:center;">
                <h2>You hit your limit</h2>
                <p>Why are you here right now</p>
                <input id="objInput" type="text" placeholder="My goal is..." style="width:100%;margin-bottom:10px;">
                <button id="saveObj">Continue</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    document.documentElement.classList.add("blurred");

    document.getElementById("saveObj").onclick = () => {
        const text = document.getElementById("objInput").value.trim();
        if (!text) return;

        const hostname = location.hostname.replace("www.", "");

        chrome.runtime.sendMessage({
            action: "objectiveEntered",
            objective: text,
            hostname
        });
    };
}

function showHardBlock() {
    removeOverlay();
    createOverlay();

    overlay.innerHTML = `
        <div class="extension-ui" style="position:fixed;top:0;left:0;width:100%;height:100%;display:flex;justify-content:center;align-items:center;z-index:999999;">
            <div style="background:white;padding:20px;border-radius:6px;max-width:300px;text-align:center;">
                <h2>Blocked</h2>
                <p>This site is hard blocked</p>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    document.documentElement.classList.add("blurred");
}

function removeOverlay() {
    if (overlay) {
        overlay.remove();
        overlay = null;
    }
    document.documentElement.classList.remove("blurred");
}

function createOverlay() {
    overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backdropFilter = "blur(6px)";
    overlay.style.zIndex = "999999";
    overlay.classList.add("extension-ui");
}
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

    document.getElementById("continueBtn").onclick = () => {
        if (mode === "soft") {
            const goal = document.getElementById("goalInput").value.trim();
            chrome.runtime.sendMessage({ action: "soft_override", goal });
        }

        chrome.runtime.sendMessage({ action: "nudge_continue" });
    };

    document.getElementById("breakBtn").onclick = () => {
        chrome.runtime.sendMessage({ action: "nudge_break" });
    };
}
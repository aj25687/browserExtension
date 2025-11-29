console.log("Content script running:", location.hostname);

let blurLayer = null;
let popupContainer = null;

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

function injectBreakPopup() {
    if (popupContainer) return;

    popupContainer = document.createElement("div");
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
            pointer-events: auto;
            text-align: center;
        ">
            <h2>Take a break?</h2>
            <button id="breakContinue">Keep Going</button>
            <button id="breakStop">Take Break</button>
        </div>
    `;

    document.body.appendChild(popupContainer);

    document.getElementById("breakContinue").onclick = () => {
        blurLayer.remove();
        blurLayer = null;
        popupContainer.remove();
        popupContainer = null;
    };

    document.getElementById("breakStop").onclick = () => {
        location.href = "about:blank";
    };
}

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "applyBlock") {
        injectBlur();
        injectBreakPopup();
    }
});
// nudge.js
// This runs INSIDE nudge.html when it's injected by the content script.

window.addEventListener("DOMContentLoaded", () => {
    const continueBtn = document.getElementById("continue");
    const breakBtn = document.getElementById("break");

    // Tell content.js to clear blur and close popup
    continueBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "nudge_continue" });
    });

    // Tell content.js to enforce a break
    breakBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "nudge_break" });
    });
});
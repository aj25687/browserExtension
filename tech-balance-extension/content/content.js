// Content script loaded on all pages
console.log("Tech Balance content script running on:", window.location.hostname);

let overlayInjected = false;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === "limitReached") {
    showNudgeOverlay(msg.domain, msg.limitMinutes);
  } else if (msg?.action === "unpauseDomain") {
    removeOverlay();
  }
});

// show overlay by injecting web accessible nudge.html
async function showNudgeOverlay(domain, limitMinutes) {
  if (overlayInjected) return; // avoid duplicates

  overlayInjected = true;

  try {
    const resp = await fetch(chrome.runtime.getURL("alerts/nudge.html"));
    const html = await resp.text();
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    // wrapper styles: ensure fixed top
    wrapper.id = "tech-balance-wrapper";
    document.documentElement.appendChild(wrapper);

    // load css
    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = chrome.runtime.getURL("alerts/nudge.css");
    document.head.appendChild(cssLink);

    // add blur to body content behind overlay
    document.documentElement.style.filter = "blur(4px)";
    document.documentElement.style.transition = "filter 0.2s";

    bindNudgeEvents(wrapper, domain, limitMinutes);
  } catch (e) {
    console.error("Failed to inject nudge", e);
  }
}

function removeOverlay() {
  const w = document.getElementById("tech-balance-wrapper");
  if (w) w.remove();
  document.documentElement.style.filter = "";
  overlayInjected = false;
}

function bindNudgeEvents(wrapper, domain, limitMinutes) {
  const contBtn = wrapper.querySelector("#continue");
  const breakBtn = wrapper.querySelector("#break");
  const extend5 = wrapper.querySelector("#extend5");
  const extend15 = wrapper.querySelector("#extend15");

  if (contBtn) {
    contBtn.addEventListener("click", async () => {
      // user keeps going for 5 minutes by default. You can change behavior
      await chrome.runtime.sendMessage({ action: "extendDomain", domain, extraMinutes: 5 });
      removeOverlay();
      // also tell background to save current running time so new limit applies fresh
      await chrome.runtime.sendMessage({ action: "saveTimeNow" });
    });
  }

  if (extend5) {
    extend5.addEventListener("click", async () => {
      await chrome.runtime.sendMessage({ action: "extendDomain", domain, extraMinutes: 5 });
      removeOverlay();
      await chrome.runtime.sendMessage({ action: "saveTimeNow" });
    });
  }

  if (extend15) {
    extend15.addEventListener("click", async () => {
      await chrome.runtime.sendMessage({ action: "extendDomain", domain, extraMinutes: 15 });
      removeOverlay();
      await chrome.runtime.sendMessage({ action: "saveTimeNow" });
    });
  }

  if (breakBtn) {
    breakBtn.addEventListener("click", async () => {
      // pause this domain for 10 minutes, send to new tab with break content
      await chrome.runtime.sendMessage({ action: "pauseDomain", domain, pauseMinutes: 10 });
      removeOverlay();
      window.open("about:blank", "_blank");
    });
  }

  // also remove overlay if user navigates away
  window.addEventListener("beforeunload", () => {
    removeOverlay();
  });
}
/**
 * Extension Action Popup Script
 */

declare const chrome: any;

document.addEventListener("DOMContentLoaded", () => {
  const scanBtn = document.getElementById("btn-scan") as HTMLButtonElement;
  const clearBtn = document.getElementById("btn-clear") as HTMLButtonElement;
  const demoBtn = document.getElementById("btn-demo") as HTMLButtonElement;
  const statusEl = document.getElementById("status-text") as HTMLElement;

  if (scanBtn) {
    scanBtn.addEventListener("click", async () => {
      statusEl.textContent = "Scanning active tab...";
      if (typeof chrome !== "undefined" && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          chrome.tabs.sendMessage(
            tab.id,
            { type: "TRIGGER_PERCEPTION_CYCLE", cycle_id: `manual-scan-${Date.now()}` },
            (response: any) => {
              statusEl.textContent = "Protection active. Overlay refreshed!";
              setTimeout(() => {
                statusEl.textContent = "Privacy Boundary Armed (Fail-Closed)";
              }, 2000);
            }
          );
        }
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      if (typeof chrome !== "undefined" && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { type: "CLEAR_OVERLAYS" }, () => {
            statusEl.textContent = "Overlays cleared.";
          });
        }
      }
    });
  }

  if (demoBtn) {
    demoBtn.addEventListener("click", () => {
      if (typeof chrome !== "undefined" && chrome.tabs && chrome.runtime) {
        chrome.tabs.create({ url: chrome.runtime.getURL("demo.html") });
      }
    });
  }
});

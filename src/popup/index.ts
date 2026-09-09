import { VoiceManager } from "../voice/voice-manager.js";

declare const chrome: any;

const voiceManager = new VoiceManager();

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const taskInput = document.getElementById("task-input") as HTMLInputElement;
  const voiceBtn = document.getElementById("btn-voice-input") as HTMLButtonElement;
  const submitBtn = document.getElementById("btn-submit") as HTMLButtonElement;
  const statusText = document.getElementById("status-text") as HTMLElement;
  const statusDot = document.getElementById("status-dot") as HTMLElement;
  const togglePii = document.getElementById("toggle-pii-boxes") as HTMLInputElement;
  const vaultCount = document.getElementById("vault-count") as HTMLElement;
  const btnOpenVault = document.getElementById("btn-open-vault") as HTMLButtonElement;
  const btnSettingsToggle = document.getElementById("btn-settings-toggle") as HTMLButtonElement;
  const settingsPanel = document.getElementById("settings-panel") as HTMLElement;
  const endpointInput = document.getElementById("endpoint-input") as HTMLInputElement;
  const apiKeyInput = document.getElementById("api-key-input") as HTMLInputElement;
  const btnSaveSettings = document.getElementById("btn-save-settings") as HTMLButtonElement;
  const settingsStatus = document.getElementById("settings-status") as HTMLElement;

  // Load Cloud Reasoning Settings
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get(["planner_endpoint", "planner_api_key"], (cfg: any) => {
      if (endpointInput) endpointInput.value = cfg?.planner_endpoint || "http://127.0.0.1:8000/v1/plan";
      if (apiKeyInput && cfg?.planner_api_key) apiKeyInput.value = cfg.planner_api_key;
    });
  }

  if (btnSettingsToggle && settingsPanel) {
    btnSettingsToggle.addEventListener("click", () => {
      settingsPanel.classList.toggle("open");
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener("click", () => {
      const endpoint = (endpointInput?.value || "").trim() || "http://127.0.0.1:8000/v1/plan";
      const apiKey = (apiKeyInput?.value || "").trim();

      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.set({ planner_endpoint: endpoint, planner_api_key: apiKey }, () => {
          if (settingsStatus) {
            settingsStatus.textContent = "Saved ✓";
            setTimeout(() => {
              if (settingsStatus) settingsStatus.textContent = "";
            }, 2000);
          }
        });
      }
    });
  }

  function setStatus(text: string, state: "ready" | "busy" | "listening" = "ready") {
    if (statusText) statusText.textContent = text;
    if (statusDot) {
      statusDot.className = "status-dot";
      if (state === "busy") statusDot.classList.add("busy");
      if (state === "listening") statusDot.classList.add("listening");
    }
  }

  // ==========================================
  // Option 1: Task Input (Text & Microphone)
  // ==========================================
  if (voiceBtn) {
    voiceBtn.addEventListener("click", async () => {
      setStatus("Listening...", "listening");
      voiceBtn.classList.add("recording");

      try {
        const res = await voiceManager.startListening();
        voiceBtn.classList.remove("recording");

        if (res.success && res.transcript) {
          if (taskInput) {
            taskInput.value = res.transcript;
            taskInput.focus();
          }
          setStatus("Voice captured", "ready");
        } else {
          setStatus(res.error ? `Voice error: ${res.error}` : "Voice cancelled", "ready");
          if (taskInput) taskInput.focus();
        }
      } catch (err: any) {
        voiceBtn.classList.remove("recording");
        setStatus("Voice unavailable", "ready");
      }
    });
  }

  async function handleTaskSubmit() {
    const goal = (taskInput?.value || "").trim();
    if (!goal) {
      taskInput?.focus();
      return;
    }

    setStatus("Processing...", "busy");
    if (submitBtn) submitBtn.disabled = true;

    try {
      let currentUrl = "";
      let activeTabId: number | null = null;

      if (typeof chrome !== "undefined" && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          currentUrl = tab.url || "";
          activeTabId = tab.id || null;
        }
      }

      // 1. Trigger perception cycle on active tab so page is scanned & sanitized
      if (activeTabId && typeof chrome !== "undefined" && chrome.tabs) {
        try {
          await chrome.tabs.sendMessage(activeTabId, {
            type: "TRIGGER_PERCEPTION_CYCLE",
            cycle_id: `user-task-${Date.now()}`
          });
        } catch {
          // Content script may not be loaded on internal browser pages
        }
      }

      // 2. Start agent task in background controller
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          { type: "START_TASK", goal, url: currentUrl },
          (res: any) => {
            if (submitBtn) submitBtn.disabled = false;
            if (res?.success) {
              if (res?.outcome?.requiresIntervention) {
                setStatus("Paused: Enter Password on Page", "busy");
              } else if (res?.outcome?.isTerminal) {
                setStatus("Task Completed", "ready");
              } else {
                setStatus("Running", "busy");
              }
            } else {
              setStatus(res?.error ? `Error: ${res.error}` : "Failed", "ready");
            }
            updateVaultCount();
          }
        );
      } else {
        if (submitBtn) submitBtn.disabled = false;
        setStatus("Ready", "ready");
      }
    } catch (err) {
      if (submitBtn) submitBtn.disabled = false;
      setStatus("Error", "ready");
    }
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", handleTaskSubmit);
  }

  if (taskInput) {
    taskInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleTaskSubmit();
      }
    });
  }

  // ==========================================
  // Option 2: Visual Highlight Boxes Toggle
  // ==========================================
  if (togglePii) {
    // Load persisted state
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["pii_overlays_enabled"], (res: any) => {
        if (typeof res?.pii_overlays_enabled === "boolean") {
          togglePii.checked = res.pii_overlays_enabled;
        }
      });
    }

    togglePii.addEventListener("change", async () => {
      const enabled = togglePii.checked;
      if (typeof chrome !== "undefined") {
        // Save user preference
        if (chrome.storage?.local) {
          chrome.storage.local.set({ pii_overlays_enabled: enabled });
        }
        // Send state to active tab content script
        if (chrome.tabs) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: "SET_OVERLAYS_ENABLED",
              enabled
            });
          }
        }
      }
    });
  }

  // ==========================================
  // Option 3: Server Transmission Vault Launcher
  // ==========================================
  if (btnOpenVault) {
    btnOpenVault.addEventListener("click", () => {
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.create({ url: chrome.runtime.getURL("vault.html") });
      } else {
        window.open("vault.html", "_blank");
      }
    });
  }

  function updateVaultCount() {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["vault_transmissions"], (res: any) => {
        const list = res?.vault_transmissions || [];
        if (vaultCount) vaultCount.textContent = `${list.length}`;
      });
    }
  }

  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes: any, area: string) => {
      if (area === "local" && changes.vault_transmissions) {
        const list = changes.vault_transmissions.newValue || [];
        if (vaultCount) vaultCount.textContent = `${list.length}`;
      }
    });
  }

  updateVaultCount();
});

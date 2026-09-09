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
  const vaultContainer = document.getElementById("vault-container") as HTMLElement;
  const vaultCount = document.getElementById("vault-count") as HTMLElement;
  const clearVaultBtn = document.getElementById("btn-clear-vault") as HTMLButtonElement;

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
              setStatus("Completed", "ready");
            } else {
              setStatus("Processed", "ready");
            }
            loadVaultTransmissions();
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
  // Option 3: Server Transmission Vault
  // ==========================================
  function renderVault(transmissions: any[]) {
    if (!vaultContainer) return;
    if (vaultCount) vaultCount.textContent = `${transmissions.length}`;

    if (!transmissions || transmissions.length === 0) {
      vaultContainer.innerHTML = `
        <div class="vault-empty">
          <span>No server transmissions yet.</span>
          <span style="font-size: 11px;">Run a task to inspect outbound sanitized payloads.</span>
        </div>
      `;
      return;
    }

    vaultContainer.innerHTML = "";

    transmissions.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "vault-card";

      const tokenChips = (item.tokenManifest || [])
        .slice(0, 4)
        .map((t: string) => `<span class="token-chip">${t}</span>`)
        .join("");

      const moreTokens = (item.tokenManifest?.length || 0) > 4
        ? `<span class="token-chip">+${item.tokenManifest.length - 4} more</span>`
        : "";

      const sampleJson = item.sanitizedDomSample || JSON.stringify(item.rawPayload || item, null, 2);

      card.innerHTML = `
        <div class="vault-card-header">
          <span class="vault-time">${item.timestamp || "Just now"}</span>
          <span class="vault-tag">${item.entitiesRedactedCount || item.entities?.length || 0} Redacted</span>
        </div>
        <div class="vault-url" title="${item.url || ""}">${item.url || "Active Page"}</div>
        <div class="tokens-list">
          ${tokenChips || '<span class="token-chip" style="background: rgba(255,255,255,0.05); color: #94a3b8;">No sensitive tokens in payload</span>'}
          ${moreTokens}
        </div>
        <button class="inspect-btn" id="inspect-btn-${index}">Inspect Outbound Payload</button>
        <pre class="payload-json" id="payload-${index}">${sampleJson}</pre>
      `;

      const inspectBtn = card.querySelector(`#inspect-btn-${index}`) as HTMLButtonElement;
      const payloadPre = card.querySelector(`#payload-${index}`) as HTMLElement;

      inspectBtn?.addEventListener("click", () => {
        const isOpen = payloadPre.classList.toggle("open");
        inspectBtn.textContent = isOpen ? "Hide Outbound Payload" : "Inspect Outbound Payload";
      });

      vaultContainer.appendChild(card);
    });
  }

  function loadVaultTransmissions() {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["vault_transmissions"], (res: any) => {
        const list = res?.vault_transmissions || [];
        renderVault(list);
      });
    } else {
      renderVault([]);
    }
  }

  if (clearVaultBtn) {
    clearVaultBtn.addEventListener("click", () => {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.remove(["vault_transmissions"], () => {
          renderVault([]);
        });
      } else {
        renderVault([]);
      }
    });
  }

  // Listen for background updates to the vault
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes: any, area: string) => {
      if (area === "local" && changes.vault_transmissions) {
        renderVault(changes.vault_transmissions.newValue || []);
      }
    });
  }

  // Initial load
  loadVaultTransmissions();
});

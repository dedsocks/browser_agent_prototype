/**
 * Dedicated Vault Interface Controller
 * Renders full-screen transmission audit history with searchable and inspectable payloads.
 */

declare const chrome: any;

document.addEventListener("DOMContentLoaded", () => {
  const vaultContainer = document.getElementById("vault-container") as HTMLElement;
  const vaultCount = document.getElementById("vault-count") as HTMLElement;
  const clearVaultBtn = document.getElementById("btn-clear-vault") as HTMLButtonElement;

  function renderVault(transmissions: any[]) {
    if (!vaultContainer) return;
    if (vaultCount) {
      vaultCount.textContent = `${transmissions.length} Record${transmissions.length === 1 ? "" : "s"}`;
    }

    if (!transmissions || transmissions.length === 0) {
      vaultContainer.innerHTML = `
        <div class="empty-state">
          <div>No server transmissions recorded yet.</div>
          <div style="font-size: 12px; margin-top: 6px;">Run a task with the browser agent to inspect transmitted payloads.</div>
        </div>
      `;
      return;
    }

    vaultContainer.innerHTML = "";

    transmissions.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "vault-card";

      const tokenChips = (item.tokenManifest || [])
        .map((t: string) => `<span class="token-chip">${t}</span>`)
        .join("");

      const sampleJson = item.sanitizedDomSample || JSON.stringify(item.rawPayload || item, null, 2);

      card.innerHTML = `
        <div class="card-top">
          <span class="card-time">${item.timestamp || "Just now"} • Cycle ID: ${item.cycleId || "N/A"}</span>
          <span class="redact-pill">${item.entitiesRedactedCount ?? item.entities?.length ?? 0} Sensitive Fields Redacted</span>
        </div>
        <div class="card-url" title="${item.url || ""}">${item.url || "Active Web Page"}</div>
        <div class="tokens-wrap">
          ${tokenChips || '<span class="token-chip" style="background: rgba(255,255,255,0.05); color: #94a3b8;">No sensitive entities detected</span>'}
        </div>
        <button class="inspect-btn" id="inspect-btn-${index}">Inspect Outbound Schema 1.5.0 Payload</button>
        <pre class="json-preview" id="payload-${index}">${sampleJson}</pre>
      `;

      const inspectBtn = card.querySelector(`#inspect-btn-${index}`) as HTMLButtonElement;
      const payloadPre = card.querySelector(`#payload-${index}`) as HTMLElement;

      inspectBtn?.addEventListener("click", () => {
        const isOpen = payloadPre.classList.toggle("open");
        inspectBtn.textContent = isOpen ? "Hide Outbound Payload" : "Inspect Outbound Schema 1.5.0 Payload";
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

  // Real-time updates from background
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes: any, area: string) => {
      if (area === "local" && changes.vault_transmissions) {
        renderVault(changes.vault_transmissions.newValue || []);
      }
    });
  }

  loadVaultTransmissions();
});

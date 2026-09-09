/**
 * Content Script Entrypoint
 * Bridges the live DOM, DOM extractor, background privacy boundary,
 * and the non-destructive audit overlay.
 */

import { extractDomSnapshot } from "./dom-extractor.js";
import { auditOverlayManager } from "./audit-overlay.js";
import { handleDomSnapshotRequest } from "../background/index.js";
import {
  ProcessDomSnapshotRequest,
  DomSanitizationSuccessResponse,
  DomSanitizationFailureResponse
} from "../common/types.js";

declare const chrome: any;

function applyResponse(response: DomSanitizationSuccessResponse | DomSanitizationFailureResponse) {
  if (!response) return;

  if (response.type === "DOM_SANITIZATION_SUCCESS") {
    auditOverlayManager.renderMarkersImmediate(response.overlay_markers);
  } else if (response.type === "DOM_SANITIZATION_FAILURE") {
    console.warn("[Privacy Boundary] DOM sanitization halted:", response.diagnostic_message);
    auditOverlayManager.clear();
  }
}

/**
 * Triggers a complete client-side perception extraction pass.
 * Collects snapshot and requests background sanitization and overlay rendering.
 * Gracefully falls back to direct in-memory sanitization if extension messaging is unavailable.
 */
export async function triggerPerceptionPass(cycleId: string): Promise<void> {
  const snapshot = extractDomSnapshot(document.body);

  const request: ProcessDomSnapshotRequest = {
    type: "PROCESS_DOM_SNAPSHOT",
    cycle_id: cycleId,
    url: typeof window !== "undefined" ? window.location.href : "",
    timestamp: Date.now(),
    dom_snapshot: snapshot
  };

  // 1. Try Extension Message Channel if active
  if (typeof chrome !== "undefined" && chrome.runtime?.id && chrome.runtime?.sendMessage) {
    try {
      chrome.runtime.sendMessage(
        request,
        (response: DomSanitizationSuccessResponse | DomSanitizationFailureResponse) => {
          if (chrome.runtime?.lastError || !response) {
            // Background worker unavailable or restricted origin (e.g. file:// without permission)
            handleDomSnapshotRequest(request).then(applyResponse);
            return;
          }
          applyResponse(response);
        }
      );
      return;
    } catch {
      // Fall through to local fallback
    }
  }

  // 2. Local In-Memory Fallback (standalone, test pages, or file:// protocol)
  const localResponse = await handleDomSnapshotRequest(request);
  applyResponse(localResponse);
}

// Auto-initialize audit overlay container on load
if (typeof window !== "undefined" && typeof document !== "undefined") {
  auditOverlayManager.ensureContainer();

  // Expose global controller for testing and debug
  (window as any).__privacyBoundary = {
    trigger: triggerPerceptionPass,
    clear: () => auditOverlayManager.clear(),
    manager: auditOverlayManager
  };

  // Run initial scan on load with staggered retries for single-page applications (SPAs)
  const runInitial = () => {
    triggerPerceptionPass(`page-load-${Date.now()}`);
    // Staggered retries to catch late-hydrated React/Vue/Angular forms
    setTimeout(() => triggerPerceptionPass(`spa-hydration-300-${Date.now()}`), 300);
    setTimeout(() => triggerPerceptionPass(`spa-hydration-1000-${Date.now()}`), 1000);
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    runInitial();
  } else {
    window.addEventListener("DOMContentLoaded", runInitial);
    window.addEventListener("load", runInitial);
  }

  // Live real-time updates on input, focus, DOM mutation, scroll, or resize
  let updateTimeout: any = null;
  const scheduleUpdate = () => {
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
      triggerPerceptionPass(`live-update-${Date.now()}`);
    }, 100);
  };

  // Form & user interaction listeners
  document.addEventListener("input", scheduleUpdate, { passive: true });
  document.addEventListener("focusin", scheduleUpdate, { passive: true });
  document.addEventListener("change", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("popstate", scheduleUpdate, { passive: true });
  window.addEventListener("hashchange", scheduleUpdate, { passive: true });

  // Observe dynamic DOM changes (e.g. login dialogs, modal forms, SPA routing)
  if (typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver((mutations) => {
      // Ignore mutations stemming exclusively from our own overlay container
      const isInternal = mutations.every(m => {
        const target = m.target as HTMLElement;
        return target && (target.id === "__privacy_audit_overlay" || target.closest?.("#__privacy_audit_overlay"));
      });
      if (!isInternal) {
        scheduleUpdate();
      }
    });

    const targetNode = document.body || document.documentElement;
    if (targetNode) {
      observer.observe(targetNode, { childList: true, subtree: true, attributes: true, attributeFilter: ["value", "type", "class", "style"] });
    }
  }

  // Listen for agent perception triggers via chrome.runtime
  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(
      (msg: any, _sender: any, sendResponse: (response?: any) => void) => {
        if (msg?.type === "TRIGGER_PERCEPTION_CYCLE" && msg.cycle_id) {
          triggerPerceptionPass(msg.cycle_id).then(() => sendResponse({ status: "ACK" }));
          return true;
        }
        if (msg?.type === "CLEAR_OVERLAYS") {
          auditOverlayManager.clear();
          sendResponse({ status: "CLEARED" });
          return false;
        }
      }
    );
  }
}

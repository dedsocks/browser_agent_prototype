/**
 * Background Service Worker & Message Router
 * Coordinates DOM snapshot processing, PII detection, manifest generation,
 * fail-closed verification, and overlay marker dispatch.
 * Implements Constitution Principle IV (Background Isolation) & Principle V (Fail-Closed).
 */

import { AgentController } from "../agent/controller.js";
import { MockPlannerClient } from "../agent/planner-client.js";
import {
  handleDomSnapshotRequest,
  setIncrementalCache,
  getIncrementalCache
} from "./snapshot-processor.js";

export { handleDomSnapshotRequest, setIncrementalCache, getIncrementalCache };

declare const chrome: any;

let activeController: AgentController | null = null;

export function getActiveController(): AgentController | null {
  return activeController;
}

export function initControllerWithPlanner(planner: any): AgentController {
  activeController = new AgentController({
    planner,
    snapshotProvider: async () => {
      // In extension context, query active tab and request snapshot
      if (typeof chrome !== "undefined" && chrome.tabs?.query) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          const res = await chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_PERCEPTION_CYCLE", cycle_id: `cycle_${Date.now()}` });
          return res?.dom_snapshot;
        }
      }
      throw new Error("No active browser tab accessible");
    },
    targetResolver: async (target) => {
      if (typeof chrome !== "undefined" && chrome.tabs?.query) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          return await chrome.tabs.sendMessage(tab.id, { type: "RESOLVE_TARGET_ELEMENT", target });
        }
      }
      return { found: false, isInteractive: false, isVisible: false, isCredentialField: false };
    },
    actionExecutor: async (action, validationResult) => {
      if (typeof chrome !== "undefined" && chrome.tabs?.query) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          return await chrome.tabs.sendMessage(tab.id, { type: "EXECUTE_ACTION", action, validationResult });
        }
      }
      return { success: false, error: "No active tab", durationMs: 0 };
    },
    interventionUiTrigger: (ctx) => {
      if (typeof chrome !== "undefined" && chrome.tabs?.query) {
        chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]: any) => {
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_INTERVENTION_UI", context: ctx });
          }
        });
      }
    },
    interventionUiClearer: () => {
      if (typeof chrome !== "undefined" && chrome.tabs?.query) {
        chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]: any) => {
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { type: "CLEAR_INTERVENTION_UI" });
          }
        });
      }
    }
  });
  return activeController;
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(
    (message: any, _sender: any, sendResponse: (response?: any) => void) => {
      if (message?.type === "PROCESS_DOM_SNAPSHOT") {
        handleDomSnapshotRequest(message).then(sendResponse);
        return true; // Keep message channel open for async response
      }

      if (message?.type === "START_TASK") {
        if (!activeController) {
          initControllerWithPlanner(new MockPlannerClient([]));
        }
        const session = activeController!.startTask(message.goal, message.url || "");
        // Immediately run first perception-action cycle to sanitize and transmit
        activeController!.runNextCycle().then((outcome) => {
          sendResponse({ success: true, session, outcome });
        }).catch((err) => {
          sendResponse({ success: false, error: err?.message, session });
        });
        return true;
      }

      if (message?.type === "GET_VAULT_TRANSMISSIONS") {
        if (typeof chrome !== "undefined" && chrome.storage?.local) {
          chrome.storage.local.get(["vault_transmissions"], (res: any) => {
            sendResponse({ transmissions: res?.vault_transmissions || [] });
          });
          return true;
        }
        sendResponse({ transmissions: [] });
        return false;
      }

      if (message?.type === "CLEAR_VAULT") {
        if (typeof chrome !== "undefined" && chrome.storage?.local) {
          chrome.storage.local.remove(["vault_transmissions"], () => {
            sendResponse({ success: true });
          });
          return true;
        }
        sendResponse({ success: true });
        return false;
      }

      if (message?.type === "PAUSE_TASK") {
        activeController?.pauseTask();
        sendResponse({ success: true, state: activeController?.getState() });
        return false;
      }

      if (message?.type === "RESUME_TASK") {
        const res = activeController?.resumeTask(message.currentUrl, message.confirmedDivergence);
        sendResponse(res || { success: false });
        return false;
      }

      if (message?.type === "ABORT_TASK") {
        activeController?.abortTask();
        sendResponse({ success: true, state: "IDLE" });
        return false;
      }

      if (message?.type === "GET_TASK_STATE") {
        sendResponse({
          state: activeController?.getState() || "IDLE",
          session: activeController?.getActiveSession() || null
        });
        return false;
      }

      if (message?.type === "RUN_NEXT_CYCLE") {
        activeController?.runNextCycle().then(sendResponse);
        return true;
      }
    }
  );
}

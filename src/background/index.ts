/**
 * Background Service Worker & Message Router
 * Coordinates DOM snapshot processing, PII detection, manifest generation,
 * fail-closed verification, and overlay marker dispatch.
 * Implements Constitution Principle IV (Background Isolation) & Principle V (Fail-Closed).
 */

import { AgentController } from "../agent/controller.js";
import { RemoteVlmPlannerClient, MockPlannerClient } from "../agent/planner-client.js";
import {
  handleDomSnapshotRequest,
  setIncrementalCache,
  getIncrementalCache
} from "./snapshot-processor.js";
import { offscreenManager } from "./offscreen-manager.js";

export { handleDomSnapshotRequest, setIncrementalCache, getIncrementalCache, offscreenManager };

declare const chrome: any;

let activeController: AgentController | null = null;

export function getActiveController(): AgentController | null {
  return activeController;
}

export function isRestrictedUrl(url?: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().trim();
  return (
    lower.startsWith("chrome://") ||
    lower.startsWith("chrome-extension://") ||
    lower.startsWith("edge://") ||
    lower.startsWith("devtools://") ||
    lower.startsWith("view-source:") ||
    lower.startsWith("about:") ||
    lower.startsWith("https://chrome.google.com/webstore") ||
    lower.startsWith("https://chromewebstore.google.com")
  );
}

export function waitForTabComplete(tabId: number, timeoutMs = 15000): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.tabs?.onUpdated) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let timer: any = null;
    const listener = (tid: number, changeInfo: any) => {
      if (tid === tabId && changeInfo.status === "complete") {
        if (timer) clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeoutMs);
  });
}

export function initControllerWithPlanner(planner: any): AgentController {
  activeController = new AgentController({
    planner,
    snapshotProvider: async () => {
      // In extension context, query active tab and request snapshot
      if (typeof chrome !== "undefined" && chrome.tabs?.query) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          // Internal browser pages (chrome://, etc.) cannot have content scripts injected.
          // Supply a navigation-ready initial snapshot so the planner can issue a 'navigate' action.
          if (isRestrictedUrl(tab.url)) {
            console.log(`[Agent] Active tab is on restricted URL (${tab.url}). Supplying virtual navigation snapshot.`);
            return {
              root_node_id: "restricted_browser_page",
              url: tab.url || "chrome://newtab",
              nodes: [
                {
                  node_id: "restricted_browser_page",
                  tag: "div",
                  attributes: {
                    id: "restricted_browser_page",
                    "data-notice": "Chrome internal page. Direct DOM inspection is restricted."
                  },
                  text: `Active tab is on an internal browser URL (${tab.url || "chrome://newtab"}). Direct DOM access is restricted by Chrome security. If the user's task requires visiting a website, return a 'navigate' action with the target URL.`,
                  bounds: { x: 0, y: 0, width: 1280, height: 800 },
                  children_ids: []
                }
              ]
            };
          }

          try {
            const res = await chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_PERCEPTION_CYCLE", cycle_id: `cycle_${Date.now()}` });
            if (res?.dom_snapshot) return res.dom_snapshot;
          } catch {
            // Tab was opened before extension reload; inject content script on-demand if permitted
            if (chrome.scripting && !isRestrictedUrl(tab.url)) {
              try {
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ["dist/content.bundle.js"]
                });
                await new Promise(r => setTimeout(r, 250));
                const res = await chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_PERCEPTION_CYCLE", cycle_id: `cycle_${Date.now()}` });
                if (res?.dom_snapshot) return res.dom_snapshot;
              } catch (injectErr: any) {
                console.warn("[Background] Content script injection skipped:", injectErr?.message);
              }
            }
          }
        }
      }
      throw new Error("No active browser tab accessible");
    },
    targetResolver: async (target) => {
      if (typeof chrome !== "undefined" && chrome.tabs?.query) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          if (isRestrictedUrl(tab.url)) {
            return {
              found: false,
              isInteractive: false,
              isVisible: false,
              isCredentialField: false,
              error: `Target elements cannot be inspected on internal browser page (${tab.url})`
            };
          }
          try {
            return await chrome.tabs.sendMessage(tab.id, { type: "RESOLVE_TARGET_ELEMENT", target });
          } catch (e: any) {
            return {
              found: false,
              isInteractive: false,
              isVisible: false,
              isCredentialField: false,
              error: e?.message
            };
          }
        }
      }
      return { found: false, isInteractive: false, isVisible: false, isCredentialField: false };
    },
    actionExecutor: async (action, validationResult) => {
      if (typeof chrome !== "undefined" && chrome.tabs?.query) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          // Handle 'navigate' actions directly via chrome.tabs.update
          if (action.type === "navigate" && action.value) {
            const startTime = Date.now();
            console.log(`[Agent] Navigating tab ${tab.id} to:`, action.value);
            await chrome.tabs.update(tab.id, { url: action.value });
            await waitForTabComplete(tab.id);
            await new Promise(r => setTimeout(r, 500)); // Allow DOM to settle

            // Ensure content script is available on the newly loaded page
            if (chrome.scripting && !isRestrictedUrl(action.value)) {
              try {
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ["dist/content.bundle.js"]
                });
                await new Promise(r => setTimeout(r, 200));
              } catch {
                // Content script may already be auto-injected by manifest
              }
            }
            return { success: true, durationMs: Date.now() - startTime };
          }

          if (isRestrictedUrl(tab.url)) {
            return {
              success: false,
              error: `Cannot execute action '${action.type}' on restricted browser page (${tab.url}). Please navigate to a standard website first.`,
              durationMs: 0
            };
          }

          try {
            return await chrome.tabs.sendMessage(tab.id, { type: "EXECUTE_ACTION", action, validationResult });
          } catch (err: any) {
            return { success: false, error: err?.message || "Failed to dispatch action to tab", durationMs: 0 };
          }
        }
      }
      return { success: false, error: "No active tab", durationMs: 0 };
    },
    interventionUiTrigger: (ctx) => {
      if (typeof chrome !== "undefined" && chrome.tabs?.query) {
        chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]: any) => {
          if (tab?.id && !isRestrictedUrl(tab.url)) {
            chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_INTERVENTION_UI", context: ctx }).catch(() => {});
          }
        });
      }
    },
    interventionUiClearer: () => {
      if (typeof chrome !== "undefined" && chrome.tabs?.query) {
        chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]: any) => {
          if (tab?.id && !isRestrictedUrl(tab.url)) {
            chrome.tabs.sendMessage(tab.id, { type: "CLEAR_INTERVENTION_UI" }).catch(() => {});
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

      if (message?.type === "DETECT_PAGE_FACES") {
        offscreenManager.requestFaceDetectionForImages(message.payload?.images || []).then((results) => {
          sendResponse({ success: true, results });
        }).catch((err: any) => {
          sendResponse({ success: false, error: err?.message });
        });
        return true;
      }

      if (message?.type === "START_TASK") {
        if (typeof chrome !== "undefined" && chrome.storage?.local) {
          chrome.storage.local.get(["planner_endpoint", "planner_api_key"], (cfg: any) => {
            const endpointUrl = cfg?.planner_endpoint || "http://127.0.0.1:8000/v1/plan";
            const apiKey = cfg?.planner_api_key || undefined;

            console.log("[Agent] Starting task with planner endpoint:", endpointUrl);
            initControllerWithPlanner(new RemoteVlmPlannerClient({ endpointUrl, apiKey }));

            const session = activeController!.startTask(message.goal, message.url || "");
            console.log("[Agent] Session started:", session.sessionId, "Goal:", message.goal);
            activeController!.runAutonomousLoop().then((outcome) => {
              console.log("[Agent] Autonomous loop completed:", JSON.stringify(outcome));
              sendResponse({ success: true, session, outcome });
            }).catch((err) => {
              console.error("[Agent] Autonomous loop error:", err?.message);
              sendResponse({ success: false, error: err?.message, session });
            });
          });
          return true;
        } else {
          const endpointUrl = "http://127.0.0.1:8000/v1/plan";
          console.log("[Agent] Starting task (no chrome.storage) with endpoint:", endpointUrl);
          initControllerWithPlanner(new RemoteVlmPlannerClient({ endpointUrl }));
          const session = activeController!.startTask(message.goal, message.url || "");
          console.log("[Agent] Session started:", session.sessionId, "Goal:", message.goal);
          activeController!.runAutonomousLoop().then((outcome) => {
            console.log("[Agent] Autonomous loop completed:", JSON.stringify(outcome));
            sendResponse({ success: true, session, outcome });
          }).catch((err) => {
            console.error("[Agent] Autonomous loop error:", err?.message);
            sendResponse({ success: false, error: err?.message, session });
          });
          return true;
        }
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
        if (res?.success) {
          activeController?.runAutonomousLoop().then(loopRes => {
            sendResponse({ ...res, loopRes });
          }).catch(err => {
            sendResponse({ ...res, error: err?.message });
          });
          return true;
        }
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

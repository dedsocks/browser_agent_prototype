/**
 * Background Service Worker & Message Router
 * Coordinates DOM snapshot processing, PII detection, manifest generation,
 * fail-closed verification, and overlay marker dispatch.
 * Implements Constitution Principle IV (Background Isolation) & Principle V (Fail-Closed).
 */

import {
  ProcessDomSnapshotRequest,
  DomSanitizationSuccessResponse,
  DomSanitizationFailureResponse,
  DetectedEntity,
  RedactionCategory,
  AuditOverlayMarker,
  BoundingBox
} from "../common/types.js";
import { CATEGORY_COLOR_MAP, CATEGORY_LABEL_MAP, CATEGORY_TOKEN_MAP } from "../common/constants.js";
import { snapshotToTree } from "../content/dom-extractor.js";
import { detectPiiInText } from "../privacy/regex-engine.js";
import { buildRedactionManifest } from "../privacy/manifest-builder.js";
import { buildSanitizedPayload } from "../privacy/tokenizer.js";
import { verifyPreTransmission } from "../privacy/verifier.js";

declare const chrome: any;

/**
 * Core processing routine for DOM snapshots received from content scripts.
 */
export async function handleDomSnapshotRequest(
  request: ProcessDomSnapshotRequest
): Promise<DomSanitizationSuccessResponse | DomSanitizationFailureResponse> {
  const startTime = Date.now();
  const { cycle_id, dom_snapshot } = request;

  try {
    const entities: DetectedEntity[] = [];
    const scrubbedLabelIds = new Set<string>();

    // 1. Identify sensitive elements and text nodes in snapshot
    for (const node of dom_snapshot.nodes) {
      const textToScan = node.value || node.text || "";
      const matches = detectPiiInText(textToScan);

      let primaryCategory: RedactionCategory | null = matches.length > 0 ? matches[0].category : null;
      let primaryConfidence = matches.length > 0 ? matches[0].confidence : 0;

      // Attribute inspection for password, credential, and sensitive fields
      const type = (node.attributes.type || "").toLowerCase();
      const name = (node.attributes.name || "").toLowerCase();
      const id = (node.attributes.id || node.node_id || "").toLowerCase();
      const autocomplete = (node.attributes.autocomplete || "").toLowerCase();
      const placeholder = (node.placeholder || node.attributes.placeholder || "").toLowerCase();
      const ariaLabel = (node.attributes["aria-label"] || "").toLowerCase();
      const title = (node.attributes.title || "").toLowerCase();

      const combinedMeta = `${name} ${id} ${placeholder} ${ariaLabel} ${title} ${autocomplete}`;

      if (!primaryCategory) {
        if (
          type === "password" ||
          autocomplete.includes("password") ||
          autocomplete.includes("one-time-code") ||
          /pass|pwd|passwd|secret|token|apikey|api_key|api-key|auth|pin|otp|access_token|private_key|credential/.test(combinedMeta)
        ) {
          primaryCategory = RedactionCategory.CREDENTIAL;
          primaryConfidence = 0.99;
        } else if (
          autocomplete.includes("cc-") ||
          /card|cvv|cvc|expir|credit|debit|account_num/.test(combinedMeta)
        ) {
          primaryCategory = RedactionCategory.FINANCIAL;
          primaryConfidence = 0.95;
        } else if (
          /ssn|pan|tax_id|social_sec|identity_num|national_id/.test(combinedMeta)
        ) {
          primaryCategory = RedactionCategory.IDENTITY;
          primaryConfidence = 0.95;
        } else if (
          type === "email" ||
          autocomplete.includes("email") ||
          /\bemail\b|\bmail\b/.test(combinedMeta)
        ) {
          primaryCategory = RedactionCategory.CONTACT;
          primaryConfidence = 0.90;
        }
      }

      if (primaryCategory) {
        const token = CATEGORY_TOKEN_MAP[primaryCategory as keyof typeof CATEGORY_TOKEN_MAP];

        const bounds: BoundingBox = {
          x: node.bounds.x,
          y: node.bounds.y,
          width: node.bounds.width,
          height: node.bounds.height,
          top: node.bounds.y,
          left: node.bounds.x,
          bottom: node.bounds.y + node.bounds.height,
          right: node.bounds.x + node.bounds.width
        };

        const associatedLabels: string[] = [];
        // Match label with for attribute or aria-labelledby
        for (const otherNode of dom_snapshot.nodes) {
          if (otherNode.tag === "label" && otherNode.attributes["for"] === node.node_id) {
            associatedLabels.push(otherNode.node_id);
            scrubbedLabelIds.add(otherNode.node_id);
          }
        }

        entities.push({
          id: `ent_${node.node_id}_${entities.length + 1}`,
          category: primaryCategory,
          token,
          nodeId: node.node_id,
          bounds,
          associatedLabelNodeIds: associatedLabels,
          confidence: primaryConfidence,
          verified: false
        });
      }
    }

    // 2. Build RedactionManifest
    const manifest = buildRedactionManifest({
      cycleId: cycle_id,
      entities,
      labelsScrubbedCount: scrubbedLabelIds.size
    });

    // 3. Structural Tokenization
    const domTree = snapshotToTree(dom_snapshot);
    const durationMs = Date.now() - startTime;
    const payload = buildSanitizedPayload({
      cycleId: cycle_id,
      entities,
      domTree,
      durationMs,
      scrubbedLabelNodeIds: scrubbedLabelIds
    });

    // 4. Pre-Transmission Zero-Leakage Verification
    const verification = verifyPreTransmission(payload, manifest);

    if (!verification.valid) {
      return {
        type: "DOM_SANITIZATION_FAILURE",
        cycle_id,
        error_code: verification.errorCode === "LEAK_DETECTED" ? "LEAK_DETECTED" : "INTERNAL_FAULT",
        diagnostic_message: verification.diagnosticMessage || "Verification failed",
        action: "HALT_TASK_SESSION"
      };
    }

    // 5. Construct Overlay Markers (skip hidden inputs)
    const overlayMarkers: AuditOverlayMarker[] = entities
      .filter(e => {
        const node = dom_snapshot.nodes.find(n => n.node_id === e.nodeId);
        return node?.attributes?.type !== "hidden";
      })
      .map(e => ({
        entity_id: e.id,
        category: e.category,
        color: CATEGORY_COLOR_MAP[e.category] || "#FF0000",
        bounds: {
          x: e.bounds.x,
          y: e.bounds.y,
          width: e.bounds.width,
          height: e.bounds.height
        },
        label: CATEGORY_LABEL_MAP[e.category] || "Protected"
      }));

    return {
      type: "DOM_SANITIZATION_SUCCESS",
      cycle_id,
      overlay_markers: overlayMarkers,
      status: "VERIFIED"
    };
  } catch (err: any) {
    return {
      type: "DOM_SANITIZATION_FAILURE",
      cycle_id,
      error_code: "INTERNAL_FAULT",
      diagnostic_message: err?.message || "Internal sanitization error",
      action: "HALT_TASK_SESSION"
    };
  }
}

// Browser Extension message listener setup & Agent Controller coordinator
import { AgentController } from "../agent/controller.js";
import { MockPlannerClient } from "../agent/planner-client.js";

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
        sendResponse({ success: true, session });
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

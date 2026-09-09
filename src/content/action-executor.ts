/**
 * Live DOM Action Executor
 * Safely dispatches validated browser actions (click, type, scroll, navigate)
 * and renders Human Intervention UI prompts.
 * Implements Constitution Principle XIV (Local Action Validation & Browser Execution)
 * and Principle XIII (Human-in-the-Loop Secret Handling).
 */

import { AgentAction, ValidationResult, HumanInterventionContext } from "../common/types.js";
import { resolveTargetElement } from "./target-resolver.js";

export interface DomExecutionResult {
  success: boolean;
  error?: string;
  durationMs: number;
}

/**
 * Dispatches a validated action to the live DOM.
 */
export async function executeDomAction(
  action: AgentAction,
  validationResult: ValidationResult
): Promise<DomExecutionResult> {
  const startTime = Date.now();

  if (!validationResult.isValid) {
    return {
      success: false,
      error: `Validation failed: ${validationResult.diagnosticMessage || validationResult.errorCode}`,
      durationMs: Date.now() - startTime
    };
  }

  try {
    switch (action.type) {
      case "click": {
        let el: HTMLElement | null = null;
        if (action.target?.nodeId) {
          el = document.getElementById(action.target.nodeId);
        }
        if (!el && action.target?.cssSelector) {
          el = document.querySelector(action.target.cssSelector) as HTMLElement;
        }

        if (!el) {
          const res = resolveTargetElement(action.target);
          if (res.found && res.nodeId) {
            el = document.getElementById(res.nodeId);
          }
        }

        if (!el) {
          return {
            success: false,
            error: "Target element could not be resolved on live DOM for click",
            durationMs: Date.now() - startTime
          };
        }

        // Focus element before click
        el.focus();
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        el.click();
        return { success: true, durationMs: Date.now() - startTime };
      }

      case "type": {
        let el: HTMLInputElement | HTMLTextAreaElement | null = null;
        if (action.target?.nodeId) {
          el = document.getElementById(action.target.nodeId) as any;
        }
        if (!el && action.target?.cssSelector) {
          el = document.querySelector(action.target.cssSelector) as any;
        }

        if (!el) {
          return {
            success: false,
            error: "Target input element not found for typing",
            durationMs: Date.now() - startTime
          };
        }

        el.focus();
        el.value = action.value || "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return { success: true, durationMs: Date.now() - startTime };
      }

      case "scroll": {
        const x = action.scrollOffset?.x ?? 0;
        const y = action.scrollOffset?.y ?? 0;
        window.scrollBy(x, y);
        return { success: true, durationMs: Date.now() - startTime };
      }

      case "navigate": {
        if (!action.value) {
          return {
            success: false,
            error: "No navigation URL provided",
            durationMs: Date.now() - startTime
          };
        }
        window.location.href = action.value;
        return { success: true, durationMs: Date.now() - startTime };
      }

      default:
        return {
          success: false,
          error: `Unsupported action type: ${(action as any).type}`,
          durationMs: Date.now() - startTime
        };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Error executing DOM action",
      durationMs: Date.now() - startTime
    };
  }
}

/**
 * Renders a prominent non-destructive intervention guidance banner.
 */
export function triggerInterventionUi(context: HumanInterventionContext): void {
  clearInterventionUi();

  const banner = document.createElement("div");
  banner.id = "agent-intervention-banner";
  banner.setAttribute(
    "style",
    "position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 2147483647; " +
      "background: #1A202C; color: #ED8936; border: 2px solid #DD6B20; border-radius: 8px; " +
      "padding: 12px 20px; font-family: sans-serif; font-size: 14px; font-weight: bold; " +
      "box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4); display: flex; align-items: center; gap: 12px;"
  );

  banner.innerHTML = `
    <span>⚠️ <strong>Human Intervention Required</strong>: ${context.promptMessage}</span>
    <span style="color: #A0AEC0; font-size: 12px;">(Automated perception paused. Complete input and click Resume)</span>
  `;

  document.body.appendChild(banner);

  // If target field is known, highlight it
  if (context.targetFieldId) {
    const el = document.getElementById(context.targetFieldId);
    if (el) {
      el.style.outline = "3px solid #DD6B20";
      el.focus();
    }
  }
}

/**
 * Removes intervention banner and highlights.
 */
export function clearInterventionUi(): void {
  const banner = document.getElementById("agent-intervention-banner");
  if (banner) {
    banner.remove();
  }
}

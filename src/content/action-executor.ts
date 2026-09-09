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

function showActionToast(message: string) {
  if (typeof document === "undefined") return;
  let toast = document.getElementById("__agent_action_toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "__agent_action_toast";
    toast.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: #1e1b4b;
      color: #c7d2fe;
      border: 1px solid #6366f1;
      border-radius: 999px;
      padding: 6px 16px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-weight: 500;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      z-index: 2147483646;
      pointer-events: none;
      transition: opacity 0.2s, transform 0.2s;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = `🤖 Agent: ${message}`;
  toast.style.opacity = "1";
  toast.style.transform = "translateX(-50%) translateY(0)";

  setTimeout(() => {
    if (toast) {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(-6px)";
    }
  }, 1800);
}

function flashElement(el: HTMLElement) {
  const origOutline = el.style.outline;
  const origBoxShadow = el.style.boxShadow;
  el.style.outline = "2px solid #6366f1";
  el.style.boxShadow = "0 0 12px rgba(99, 102, 241, 0.6)";
  setTimeout(() => {
    el.style.outline = origOutline;
    el.style.boxShadow = origBoxShadow;
  }, 600);
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

        if (!el && action.target) {
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

        showActionToast(`Clicking ${el.tagName.toLowerCase()}${el.id ? ` #${el.id}` : ""}`);
        flashElement(el);

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

        if (!el && action.target) {
          const res = resolveTargetElement(action.target);
          if (res.found && res.nodeId) {
            el = document.getElementById(res.nodeId) as any;
          }
        }

        if (!el) {
          return {
            success: false,
            error: "Target input element not found for typing",
            durationMs: Date.now() - startTime
          };
        }

        showActionToast(`Typing into ${el.tagName.toLowerCase()}${el.id ? ` #${el.id}` : ""}`);
        flashElement(el);

        el.focus();
        const valueToType = action.value || "";
        
        // Support React/Vue framework controlled inputs
        const prototype = Object.getPrototypeOf(el);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        if (prototypeValueSetter) {
          prototypeValueSetter.call(el, valueToType);
        } else {
          el.value = valueToType;
        }

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
    "position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 2147483647; " +
      "background: #181f2f; color: #f8fafc; border: 2px solid #ea580c; border-radius: 10px; " +
      "padding: 12px 20px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; font-weight: 500; " +
      "box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 14px;"
  );

  banner.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 18px;">🔒</span>
      <div>
        <div style="font-weight: 700; color: #fb923c;">Human Intervention Required</div>
        <div style="font-size: 11px; color: #94a3b8;">${context.promptMessage}</div>
      </div>
    </div>
    <button id="__btn_resume_agent_task" style="background: #ea580c; color: white; border: none; border-radius: 6px; padding: 7px 14px; font-weight: 600; font-size: 12px; cursor: pointer; transition: background 0.2s;">
      Resume Task ➔
    </button>
  `;

  document.body.appendChild(banner);

  const resumeBtn = banner.querySelector("#__btn_resume_agent_task");
  if (resumeBtn) {
    resumeBtn.addEventListener("click", () => {
      clearInterventionUi();
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: "RESUME_TASK",
          currentUrl: window.location.href,
          confirmedDivergence: true
        });
      }
    });
  }

  // If target field is known, highlight it
  if (context.targetFieldId) {
    const el = document.getElementById(context.targetFieldId) || (document.querySelector(`[name="${context.targetFieldId}"]`) as HTMLElement | null);
    if (el) {
      el.style.outline = "3px solid #ea580c";
      el.setAttribute("data-agent-intervention-highlight", "true");
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
  const highlighted = document.querySelectorAll("[data-agent-intervention-highlight]");
  highlighted.forEach(el => {
    (el as HTMLElement).style.outline = "";
    el.removeAttribute("data-agent-intervention-highlight");
  });
}

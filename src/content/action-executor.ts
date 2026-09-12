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
 * Resolves a DOM element by nodeId, checking both the real `id` attribute
 * and the `data-priv-node-id` attribute stamped by dom-extractor for generated IDs.
 */
function getElementByNodeId(nodeId: string): HTMLElement | null {
  return (
    document.getElementById(nodeId) ||
    (document.querySelector(`[data-priv-node-id="${nodeId}"]`) as HTMLElement | null)
  );
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
        // Determine the click coordinates.
        // Priority: explicit x/y from action → computed element center → (0,0) fallback
        let clickX = action.target?.x;
        let clickY = action.target?.y;

        let el: HTMLElement | null = null;

        // Strategy 1: Coordinate-based resolution via elementFromPoint.
        // Only used when the planner explicitly provided x/y coordinates (not computed from bounds).
        // This is the MOST RELIABLE method for canvas-based apps (Google Docs, Sheets, Drive)
        // because it hits the exact visual element, bypassing DOM structure assumptions.
        // We skip body/html hits — those indicate JSDOM or a miss, not a real element.
        if (clickX !== undefined && clickY !== undefined) {
          const hit = document.elementFromPoint(clickX, clickY) as HTMLElement | null;
          const hitTag = hit?.tagName?.toLowerCase();
          if (hit && hitTag !== "body" && hitTag !== "html") {
            el = hit;
          }
        }

        // Strategy 2: CSS selector / nodeId fallback
        if (!el && action.target?.nodeId) {
          el = getElementByNodeId(action.target.nodeId);
        }
        if (!el && action.target?.cssSelector) {
          try {
            el = document.querySelector(action.target.cssSelector) as HTMLElement;
          } catch { /* invalid selector */ }
        }

        // Strategy 3: resolveTargetElement (text matching, XPath, shadow DOM)
        if (!el && action.target) {
          const res = resolveTargetElement(action.target);
          if (res.found && res.nodeId) {
            el = getElementByNodeId(res.nodeId);
          }
        }

        if (!el) {
          // Last resort: if we have coordinates, still try to dispatch events
          // at those coordinates even without a resolved element
          if (clickX !== undefined && clickY !== undefined) {
            showActionToast(`Clicking at (${Math.round(clickX)}, ${Math.round(clickY)})`);
            const evInit = {
              bubbles: true, cancelable: true,
              clientX: clickX, clientY: clickY,
              screenX: clickX, screenY: clickY,
              isPrimary: true
            };
            if (typeof PointerEvent !== "undefined") {
              document.dispatchEvent(new PointerEvent("pointerdown", evInit));
              document.dispatchEvent(new PointerEvent("pointerup", evInit));
            }
            document.dispatchEvent(new MouseEvent("click", { ...evInit, detail: 1 }));
            return { success: true, durationMs: Date.now() - startTime };
          }
          return {
            success: false,
            error: "Target element could not be resolved on live DOM for click",
            durationMs: Date.now() - startTime
          };
        }

        // Compute click coordinates from element if not provided
        if (clickX === undefined || clickY === undefined) {
          const rect = el.getBoundingClientRect();
          clickX = Math.round(rect.left + rect.width / 2);
          clickY = Math.round(rect.top + rect.height / 2);
        }

        showActionToast(`Clicking ${el.tagName.toLowerCase()}${el.id ? ` #${el.id}` : ""} at (${Math.round(clickX)}, ${Math.round(clickY)})`);
        flashElement(el);

        // Full W3C pointer + mouse event sequence with real coordinates.
        // Google Docs and similar apps dispatch-listen to these events
        // and use clientX/clientY to determine what was clicked inside the canvas.
        // Note: view:window is intentionally omitted — JSDOM does not support it
        // and the real browser infers it automatically.
        const coordInit: MouseEventInit & PointerEventInit = {
          bubbles: true,
          cancelable: true,
          clientX: clickX,
          clientY: clickY,
          screenX: clickX,
          screenY: clickY,
          detail: 1,
          button: 0,
          buttons: 1,
          isPrimary: true,
        };

        el.focus();
        // Guard PointerEvent dispatches — JSDOM does not implement PointerEvent.
        // In real Chrome the full sequence is required for Google Docs / Drive.
        const hasPointerEvent = typeof PointerEvent !== "undefined";
        if (hasPointerEvent) {
          el.dispatchEvent(new PointerEvent("pointerover",  { ...coordInit, cancelable: false }));
          el.dispatchEvent(new PointerEvent("pointerenter", { ...coordInit, bubbles: false, cancelable: false }));
        }
        el.dispatchEvent(new MouseEvent("mouseover",  { ...coordInit, cancelable: false }));
        el.dispatchEvent(new MouseEvent("mouseenter", { ...coordInit, bubbles: false, cancelable: false }));
        el.dispatchEvent(new MouseEvent("mousemove",  { ...coordInit }));
        if (hasPointerEvent) {
          el.dispatchEvent(new PointerEvent("pointerdown", { ...coordInit }));
        }
        el.dispatchEvent(new MouseEvent("mousedown", { ...coordInit }));
        if (hasPointerEvent) {
          el.dispatchEvent(new PointerEvent("pointerup", { ...coordInit }));
        }
        el.dispatchEvent(new MouseEvent("mouseup", { ...coordInit }));
        el.dispatchEvent(new MouseEvent("click",   { ...coordInit }));

        // Canvas-based editors also need explicit focus events after click
        if (el.tagName.toLowerCase() === "canvas" ||
            el.getAttribute("contenteditable") ||
            el.getAttribute("role") === "textbox") {
          el.dispatchEvent(new FocusEvent("focus",   { bubbles: false }));
          el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        }

        return { success: true, durationMs: Date.now() - startTime };
      }

      case "type": {
        let el: HTMLInputElement | HTMLTextAreaElement | null = null;
        if (action.target?.nodeId) {
          el = getElementByNodeId(action.target.nodeId) as any;
        }
        if (!el && action.target?.cssSelector) {
          el = document.querySelector(action.target.cssSelector) as any;
        }

        if (!el && action.target) {
          const res = resolveTargetElement(action.target);
          if (res.found && res.nodeId) {
            el = getElementByNodeId(res.nodeId) as any;
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

      case "key_sequence": {
        // Resolve optional focus target (e.g. the Google Docs canvas)
        let focusTarget: HTMLElement | null = null;
        if (action.target?.nodeId) {
          focusTarget = getElementByNodeId(action.target.nodeId);
        }
        if (!focusTarget && action.target?.cssSelector) {
          try {
            focusTarget = document.querySelector(action.target.cssSelector) as HTMLElement;
          } catch {}
        }
        if (!focusTarget && action.target) {
          const res = resolveTargetElement(action.target);
          if (res.found && res.nodeId) {
            focusTarget = getElementByNodeId(res.nodeId);
          }
        }

        if (focusTarget) {
          flashElement(focusTarget);
          focusTarget.focus();
          // Extra events for canvas-based editors
          if (focusTarget.tagName.toLowerCase() === "canvas") {
            focusTarget.dispatchEvent(new FocusEvent("focus", { bubbles: false }));
            focusTarget.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
          }
        }

        // Build the list of keys to dispatch
        // action.keys takes priority; otherwise expand each character of action.value
        const keysToDispatch: string[] = action.keys && action.keys.length > 0
          ? action.keys
          : Array.from(action.value || "");

        if (keysToDispatch.length === 0) {
          return { success: false, error: "key_sequence: no keys or value provided", durationMs: Date.now() - startTime };
        }

        showActionToast(`Typing ${keysToDispatch.length} key(s) via key_sequence`);

        // Map of special key names to their KeyboardEvent key/code/keyCode values
        const SPECIAL_KEYS: Record<string, { key: string; code: string; keyCode: number }> = {
          Enter:       { key: "Enter",      code: "Enter",        keyCode: 13  },
          Tab:         { key: "Tab",        code: "Tab",          keyCode: 9   },
          Backspace:   { key: "Backspace",  code: "Backspace",    keyCode: 8   },
          Delete:      { key: "Delete",     code: "Delete",       keyCode: 46  },
          Escape:      { key: "Escape",     code: "Escape",       keyCode: 27  },
          ArrowLeft:   { key: "ArrowLeft",  code: "ArrowLeft",    keyCode: 37  },
          ArrowRight:  { key: "ArrowRight", code: "ArrowRight",   keyCode: 39  },
          ArrowUp:     { key: "ArrowUp",    code: "ArrowUp",      keyCode: 38  },
          ArrowDown:   { key: "ArrowDown",  code: "ArrowDown",    keyCode: 40  },
          Home:        { key: "Home",       code: "Home",         keyCode: 36  },
          End:         { key: "End",        code: "End",          keyCode: 35  },
          PageUp:      { key: "PageUp",     code: "PageUp",       keyCode: 33  },
          PageDown:    { key: "PageDown",   code: "PageDown",     keyCode: 34  },
          Space:       { key: " ",          code: "Space",        keyCode: 32  },
          "Control+a": { key: "a",          code: "KeyA",         keyCode: 65  },
          "Control+c": { key: "c",          code: "KeyC",         keyCode: 67  },
          "Control+v": { key: "v",          code: "KeyV",         keyCode: 86  },
          "Control+z": { key: "z",          code: "KeyZ",         keyCode: 90  },
        };

        const eventTarget: EventTarget = (document.activeElement as HTMLElement) || document;

        for (const k of keysToDispatch) {
          const special = SPECIAL_KEYS[k];
          const isCtrlCombo = k.startsWith("Control+");

          if (special) {
            const init: KeyboardEventInit = {
              key: special.key,
              code: special.code,
              keyCode: special.keyCode,
              which: special.keyCode,
              bubbles: true,
              cancelable: true,
              ctrlKey: isCtrlCombo,
            };
            eventTarget.dispatchEvent(new KeyboardEvent("keydown", init));
            eventTarget.dispatchEvent(new KeyboardEvent("keypress", init));
            eventTarget.dispatchEvent(new KeyboardEvent("keyup", init));
          } else {
            // Single printable character
            const charCode = k.charCodeAt(0);
            const charInit: KeyboardEventInit = {
              key: k,
              code: `Key${k.toUpperCase()}`,
              keyCode: charCode,
              which: charCode,
              charCode,
              bubbles: true,
              cancelable: true,
            };
            eventTarget.dispatchEvent(new KeyboardEvent("keydown", charInit));
            eventTarget.dispatchEvent(new KeyboardEvent("keypress", charInit));

            // beforeinput + input InputEvents for canvas-based editors (Google Docs, Sheets)
            // These editors intercept the InputEvent pipeline to update their internal model.
            try {
              (eventTarget as HTMLElement).dispatchEvent?.(new InputEvent("beforeinput", {
                inputType: "insertText",
                data: k,
                bubbles: true,
                cancelable: true,
              }));
              (eventTarget as HTMLElement).dispatchEvent?.(new InputEvent("input", {
                inputType: "insertText",
                data: k,
                bubbles: true,
              }));
            } catch { /* element may not support InputEvent */ }

            eventTarget.dispatchEvent(new KeyboardEvent("keyup", charInit));
          }

          // Small delay between key events to allow the editor's JS handlers to process
          await new Promise(r => setTimeout(r, 15));
        }

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
    const el = getElementByNodeId(context.targetFieldId) || (document.querySelector(`[name="${context.targetFieldId}"]`) as HTMLElement | null);
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

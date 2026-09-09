/**
 * Live DOM Target Element Resolver & Geometric Verification
 * Re-resolves proposed targets against the active live DOM.
 * Implements Constitution Article XIV (Action allowlisting & target identity checks).
 */

import { TargetSelector, ResolveTargetElementResponse, SimpleBounds } from "../common/types.js";
import { CREDENTIAL_INPUT_PATTERNS } from "../common/constants.js";
import { resolveElementInShadowRoots } from "./shadow-dom-extractor.js";

/**
 * Checks if a DOM element is visible in the viewport.
 */
export function isElementVisible(el: HTMLElement): boolean {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  // In JSDOM getBoundingClientRect may be 0, so check style attributes
  const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
  if (rect.width === 0 && rect.height === 0 && el.offsetParent === null && el.tagName !== "BODY" && el.tagName !== "HTML") {
    // If offsetParent is null and element is not detached/body/html, it may be hidden
    if (style.display === "none" || (el.getAttribute("style") || "").includes("display: none")) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if an element is a credential or secret input.
 */
export function isCredentialInput(el: HTMLElement): boolean {
  const tagName = el.tagName.toLowerCase();
  if (tagName !== "input" && tagName !== "textarea") return false;

  const type = (el.getAttribute("type") || "").toLowerCase();
  if (type === "password") return true;

  const autocomplete = (el.getAttribute("autocomplete") || "").toLowerCase();
  const name = (el.getAttribute("name") || "").toLowerCase();
  const id = (el.getAttribute("id") || "").toLowerCase();
  const ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase();
  const placeholder = (el.getAttribute("placeholder") || "").toLowerCase();

  const combined = `${type} ${autocomplete} ${name} ${id} ${ariaLabel} ${placeholder}`;
  return CREDENTIAL_INPUT_PATTERNS.some(pattern => pattern.test(combined));
}

/**
 * Re-resolves target element on the live document and gathers geometric bounds.
 */
export function resolveTargetElement(target?: TargetSelector): ResolveTargetElementResponse {
  if (!target) {
    return {
      found: false,
      isInteractive: false,
      isVisible: false,
      isCredentialField: false,
      error: "No target selector provided"
    };
  }

  let element: HTMLElement | null = null;

  // 1. Try by nodeId or ID
  if (target.nodeId) {
    element = document.getElementById(target.nodeId) ||
      document.querySelector(`[data-agent-node-id="${target.nodeId}"]`) as HTMLElement ||
      document.querySelector(`[id="${target.nodeId}"]`) as HTMLElement;
  }

  // 2. Try CSS Selector
  if (!element && target.cssSelector) {
    try {
      element = document.querySelector(target.cssSelector) as HTMLElement;
    } catch {
      // Invalid selector syntax
    }
  }

  // 3. Try XPath
  if (!element && target.xpath) {
    try {
      const xpathResult = document.evaluate(
        target.xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      element = xpathResult.singleNodeValue as HTMLElement;
    } catch {
      // Invalid xpath
    }
  }

  // 4. Try matching text content if specified
  if (!element && target.expectedText) {
    const buttonsAndLinks = Array.from(document.querySelectorAll("button, a, input[type='submit'], [role='button']")) as HTMLElement[];
    element = buttonsAndLinks.find(el => (el.textContent || (el as HTMLInputElement).value || "").trim().toLowerCase() === target.expectedText!.trim().toLowerCase()) || null;
  }

  // 5. Try resolving within open/attached Shadow DOM roots
  if (!element && (target.nodeId || target.cssSelector)) {
    element = resolveElementInShadowRoots(target.nodeId || target.cssSelector!);
  }

  if (!element) {
    return {
      found: false,
      isInteractive: false,
      isVisible: false,
      isCredentialField: false,
      error: `Element not found for target: ${JSON.stringify(target)}`
    };
  }

  const rect = element.getBoundingClientRect ? element.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 };
  const currentBounds: SimpleBounds = {
    x: (rect as any).left ?? rect.x ?? 0,
    y: (rect as any).top ?? rect.y ?? 0,
    width: rect.width || 0,
    height: rect.height || 0
  };

  const visible = isElementVisible(element);
  const credential = isCredentialInput(element);
  const tag = element.tagName.toLowerCase();
  const isInteractive = ["a", "button", "input", "select", "textarea"].includes(tag) ||
    element.hasAttribute("onclick") ||
    element.getAttribute("role") === "button";

  return {
    type: "RESOLVE_TARGET_ELEMENT_RESPONSE",
    found: true,
    isInteractive,
    isVisible: visible,
    isCredentialField: credential,
    currentBounds,
    nodeId: element.id || target.nodeId,
    tagName: tag
  };
}

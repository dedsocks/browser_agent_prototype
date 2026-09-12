/**
 * Local Action Validator
 * Enforces action allowlisting, target existence/visibility, geometric sanity checks,
 * and Human-in-the-Loop sensitive credential interception.
 * Implements Constitution Principle XIV (Action Validation) & Principle XIII (Secret Handling).
 */

import { AgentAction, ValidationResult, ResolveTargetElementResponse, ActionType } from "../common/types.js";
import { ALLOWED_ACTION_TYPES, GEOMETRIC_TOLERANCE_RATIO } from "../common/constants.js";

export class ActionValidator {
  /**
   * Validates a proposed action from the reasoning engine against live page state.
   */
  public validateProposedAction(
    action: AgentAction,
    targetInfo?: ResolveTargetElementResponse
  ): ValidationResult {
    // 1. Action Allowlist Check (Constitution Principle XIV)
    if (!action || !ALLOWED_ACTION_TYPES.includes(action.type as ActionType)) {
      return {
        isValid: false,
        errorCode: "UNSUPPORTED_ACTION",
        diagnosticMessage: `Action type '${action?.type}' is not in allowlist (${ALLOWED_ACTION_TYPES.join(", ")})`
      };
    }

    // Scroll and navigate do not strictly require target elements
    if (action.type === "scroll") {
      if (!action.scrollOffset) {
        return {
          isValid: false,
          errorCode: "VALIDATION_FAULT",
          diagnosticMessage: "Scroll action must provide scrollOffset {x, y}"
        };
      }
      return { isValid: true };
    }

    if (action.type === "navigate") {
      if (!action.value || !action.value.startsWith("http")) {
        return {
          isValid: false,
          errorCode: "VALIDATION_FAULT",
          diagnosticMessage: "Navigate action must provide valid http/https URL in value"
        };
      }
      return { isValid: true };
    }

    // key_sequence fires KeyboardEvents on document / focused element — target is optional
    if (action.type === "key_sequence") {
      if (!action.value && (!action.keys || action.keys.length === 0)) {
        return {
          isValid: false,
          errorCode: "VALIDATION_FAULT",
          diagnosticMessage: "key_sequence action must provide either 'value' text or 'keys' array"
        };
      }
      // If a target is given, validate it exists & is visible (non-blocking for canvas)
      if (action.target && targetInfo && !targetInfo.found) {
        // Log but don't fail — we'll still fire events on document
        console.warn("[ActionValidator] key_sequence: target not found, will fire on document");
      }
      return { isValid: true };
    }

    // For click and type, target validation is mandatory
    if (!action.target) {
      return {
        isValid: false,
        errorCode: "TARGET_NOT_FOUND",
        diagnosticMessage: `Action '${action.type}' requires a target selector`
      };
    }

    if (!targetInfo || !targetInfo.found) {
      // If action is a click with explicit viewport coordinates, allow coordinate-based click dispatch
      // (crucial for canvas editors, iframes, and visual elements that cannot be isolated in DOM)
      if (action.type === "click" && action.target?.x !== undefined && action.target?.y !== undefined) {
        return { isValid: true };
      }
      return {
        isValid: false,
        errorCode: "TARGET_NOT_FOUND",
        diagnosticMessage: targetInfo?.error || "Target element could not be found on live DOM"
      };
    }

    if (!targetInfo.isVisible) {
      return {
        isValid: false,
        errorCode: "TARGET_NOT_VISIBLE",
        diagnosticMessage: "Target element is hidden or invisible in the current DOM layout"
      };
    }

    // 2. Sensitive Credential & Secret Protection (Constitution Principle XIII)
    if (action.type === "type" && targetInfo.isCredentialField) {
      return {
        isValid: false,
        requiresIntervention: true,
        errorCode: "SENSITIVE_TARGET_BLOCKED",
        interventionReason: "Password or credential field requires manual user entry per Constitution Article XIII",
        targetElementBounds: targetInfo.currentBounds
      };
    }

    // 3. Geometric Proximity Check if expected bounds were specified
    if (action.target.expectedBounds && targetInfo.currentBounds) {
      const exp = action.target.expectedBounds;
      const curr = targetInfo.currentBounds;

      const deltaX = Math.abs(exp.x - curr.x);
      const deltaY = Math.abs(exp.y - curr.y);
      const maxAllowedDelta = Math.max(exp.width, exp.height, 100) * GEOMETRIC_TOLERANCE_RATIO;

      if (deltaX > maxAllowedDelta || deltaY > maxAllowedDelta) {
        return {
          isValid: false,
          errorCode: "GEOMETRIC_MISMATCH",
          diagnosticMessage: `Target geometric position shifted significantly: expected (${exp.x}, ${exp.y}), found (${curr.x}, ${curr.y})`
        };
      }
    }

    return {
      isValid: true,
      targetElementBounds: targetInfo.currentBounds
    };
  }
}

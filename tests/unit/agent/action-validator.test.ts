import { describe, it, expect } from "vitest";
import { ActionValidator } from "../../../src/agent/action-validator.js";
import { AgentAction, ResolveTargetElementResponse } from "../../../src/common/types.js";

describe("Action Validator (Constitution Article XIV & XIII)", () => {
  const validator = new ActionValidator();

  it("rejects non-allowlisted action types fail-closed", () => {
    const action: any = {
      id: "act_invalid",
      type: "eval_script",
      value: "alert(1)"
    };

    const res = validator.validateProposedAction(action);
    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe("UNSUPPORTED_ACTION");
    expect(res.diagnosticMessage).toContain("not in allowlist");
  });

  it("passes valid 'click' action when target is interactive and visible", () => {
    const action: AgentAction = {
      id: "act_click",
      type: "click",
      target: { nodeId: "btn-login" }
    };

    const targetInfo: ResolveTargetElementResponse = {
      found: true,
      isInteractive: true,
      isVisible: true,
      isCredentialField: false,
      currentBounds: { x: 100, y: 100, width: 80, height: 30 }
    };

    const res = validator.validateProposedAction(action, targetInfo);
    expect(res.isValid).toBe(true);
  });

  it("detects sensitive credential target on 'type' and triggers Human Intervention", () => {
    const action: AgentAction = {
      id: "act_type_pwd",
      type: "type",
      target: { nodeId: "password-input" },
      value: "superSecretPassword123"
    };

    const targetInfo: ResolveTargetElementResponse = {
      found: true,
      isInteractive: true,
      isVisible: true,
      isCredentialField: true,
      currentBounds: { x: 100, y: 140, width: 200, height: 35 }
    };

    const res = validator.validateProposedAction(action, targetInfo);
    expect(res.isValid).toBe(false);
    expect(res.requiresIntervention).toBe(true);
    expect(res.errorCode).toBe("SENSITIVE_TARGET_BLOCKED");
    expect(res.interventionReason).toContain("Password or credential field requires manual user entry");
  });

  it("rejects action if target element cannot be found", () => {
    const action: AgentAction = {
      id: "act_missing",
      type: "click",
      target: { nodeId: "ghost-button" }
    };

    const targetInfo: ResolveTargetElementResponse = {
      found: false,
      isInteractive: false,
      isVisible: false,
      isCredentialField: false,
      error: "Element not found"
    };

    const res = validator.validateProposedAction(action, targetInfo);
    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe("TARGET_NOT_FOUND");
  });

  it("rejects action if target is hidden or invisible", () => {
    const action: AgentAction = {
      id: "act_hidden",
      type: "click",
      target: { nodeId: "hidden-btn" }
    };

    const targetInfo: ResolveTargetElementResponse = {
      found: true,
      isInteractive: true,
      isVisible: false,
      isCredentialField: false
    };

    const res = validator.validateProposedAction(action, targetInfo);
    expect(res.isValid).toBe(false);
    expect(res.errorCode).toBe("TARGET_NOT_VISIBLE");
  });
});

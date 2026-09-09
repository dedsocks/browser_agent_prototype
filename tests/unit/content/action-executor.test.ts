/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { executeDomAction, triggerInterventionUi, clearInterventionUi } from "../../../src/content/action-executor.js";
import { AgentAction, ValidationResult } from "../../../src/common/types.js";

describe("Live DOM Action Executor", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="wrapper" style="height: 1000px;">
        <input type="text" id="username" value="" />
        <button type="button" id="btn-submit">Submit</button>
      </div>
    `;
  });

  it("executes 'click' action on button triggering click event", async () => {
    const btn = document.getElementById("btn-submit") as HTMLButtonElement;
    let clicked = false;
    btn.addEventListener("click", () => {
      clicked = true;
    });

    const action: AgentAction = {
      id: "act_1",
      type: "click",
      target: { cssSelector: "#btn-submit" }
    };
    const valResult: ValidationResult = { isValid: true };

    const result = await executeDomAction(action, valResult);
    expect(result.success).toBe(true);
    expect(clicked).toBe(true);
  });

  it("executes 'type' action on input updating value and dispatching input/change events", async () => {
    const input = document.getElementById("username") as HTMLInputElement;
    let changedValue = "";
    input.addEventListener("input", (e: any) => {
      changedValue = e.target.value;
    });

    const action: AgentAction = {
      id: "act_2",
      type: "type",
      target: { cssSelector: "#username" },
      value: "AgentUser"
    };
    const valResult: ValidationResult = { isValid: true };

    const result = await executeDomAction(action, valResult);
    expect(result.success).toBe(true);
    expect(input.value).toBe("AgentUser");
    expect(changedValue).toBe("AgentUser");
  });

  it("executes 'scroll' action updating window scroll coordinates", async () => {
    const scrollBySpy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});

    const action: AgentAction = {
      id: "act_3",
      type: "scroll",
      scrollOffset: { x: 0, y: 300 }
    };
    const valResult: ValidationResult = { isValid: true };

    const result = await executeDomAction(action, valResult);
    expect(result.success).toBe(true);
    expect(scrollBySpy).toHaveBeenCalledWith(0, 300);
  });

  it("triggers and clears intervention UI indicator", () => {
    triggerInterventionUi({
      cycleId: "c_1",
      targetFieldId: "username",
      secretType: "PASSWORD",
      promptMessage: "Please enter your password",
      timestamp: new Date().toISOString()
    });

    const banner = document.getElementById("agent-intervention-banner");
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain("Human Intervention Required");

    clearInterventionUi();
    expect(document.getElementById("agent-intervention-banner")).toBeNull();
  });
});

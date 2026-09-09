/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { AgentController } from "../../src/agent/controller.js";
import { MockPlannerClient } from "../../src/agent/planner-client.js";
import { extractDomSnapshot } from "../../src/content/dom-extractor.js";
import { resolveTargetElement } from "../../src/content/target-resolver.js";
import { executeDomAction, triggerInterventionUi, clearInterventionUi } from "../../src/content/action-executor.js";
import { TaskState } from "../../src/common/types.js";

describe("Human-in-the-Loop Secret Handling Integration (Constitution Article XIII)", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="checkout-form">
        <input type="text" id="email" value="shopper@test.com" />
        <input type="password" id="password" value="" />
        <button id="pay-btn">Confirm Purchase</button>
      </div>
    `;
  });

  it("suspends autonomous execution when secret field is targeted, waits for user resume, then restarts fresh", async () => {
    const mockSteps = [
      {
        cycle_id: "c_pwd",
        thought: "I should enter the user password",
        is_terminal: false,
        action: {
          id: "act_pwd",
          type: "type" as const,
          target: { cssSelector: "#password" },
          value: "secret_123"
        }
      },
      {
        cycle_id: "c_click",
        thought: "Click confirm button",
        is_terminal: true,
        action: {
          id: "act_click",
          type: "click" as const,
          target: { cssSelector: "#pay-btn" }
        }
      }
    ];

    const planner = new MockPlannerClient(mockSteps);
    const controller = new AgentController({
      planner,
      snapshotProvider: async () => extractDomSnapshot(),
      targetResolver: async (target) => resolveTargetElement(target),
      actionExecutor: async (action, valRes) => executeDomAction(action, valRes),
      interventionUiTrigger: (ctx) => triggerInterventionUi(ctx),
      interventionUiClearer: () => clearInterventionUi()
    });

    controller.startTask("Checkout cart", "https://shop.example.com/checkout");

    // Cycle 1 encounters password target
    const cycle1Result = await controller.runNextCycle();
    expect(cycle1Result.success).toBe(false);
    expect(cycle1Result.requiresIntervention).toBe(true);
    expect(controller.getState()).toBe(TaskState.INTERVENTION_REQUIRED);

    // Live DOM password input must NOT have received automated text
    const pwdInput = document.getElementById("password") as HTMLInputElement;
    expect(pwdInput.value).toBe("");

    // Intervention banner is shown to user
    const banner = document.getElementById("agent-intervention-banner");
    expect(banner).not.toBeNull();

    // User manually types their secret password
    pwdInput.value = "myUserEnteredPassword";

    // User resumes task
    const resumeRes = controller.resumeTask();
    expect(resumeRes.success).toBe(true);
    expect(controller.getState()).toBe(TaskState.OBSERVING);
    expect(document.getElementById("agent-intervention-banner")).toBeNull();

    // Next cycle runs from fresh observation
    const cycle2Result = await controller.runNextCycle();
    expect(cycle2Result.success).toBe(true);
  });
});

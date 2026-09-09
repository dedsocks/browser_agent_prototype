/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { AgentController } from "../../src/agent/controller.js";
import { MockPlannerClient } from "../../src/agent/planner-client.js";
import { extractDomSnapshot } from "../../src/content/dom-extractor.js";
import { resolveTargetElement } from "../../src/content/target-resolver.js";
import { executeDomAction } from "../../src/content/action-executor.js";
import { TaskState, TargetSelector, AgentAction, ValidationResult } from "../../src/common/types.js";

describe("Perception-Reasoning-Action Loop Integration", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
        <h1>Flight Booking Portal</h1>
        <input type="text" id="dest-city" placeholder="Destination City" value="" />
        <button id="search-flights-btn">Search Flights</button>
        <div id="results" style="display:none;">Results loaded</div>
      </div>
    `;
  });

  it("completes full multi-turn cycle: Observe -> Sanitize -> Reason -> Validate -> Execute -> Complete", async () => {
    // Scripted planner steps
    const mockSteps = [
      {
        cycle_id: "c_1",
        thought: "Type 'Paris' into destination input",
        is_terminal: false,
        action: {
          id: "act_1",
          type: "type" as const,
          target: { cssSelector: "#dest-city" },
          value: "Paris"
        }
      },
      {
        cycle_id: "c_2",
        thought: "Click search button",
        is_terminal: false,
        action: {
          id: "act_2",
          type: "click" as const,
          target: { cssSelector: "#search-flights-btn" }
        }
      },
      {
        cycle_id: "c_3",
        thought: "Flights found and displayed",
        is_terminal: true,
        result_summary: "Search completed successfully for Paris flights"
      }
    ];

    const planner = new MockPlannerClient(mockSteps);
    const controller = new AgentController({
      planner,
      // Provide content script handlers in same JS context for tests
      snapshotProvider: async () => extractDomSnapshot(),
      targetResolver: async (target?: TargetSelector) => resolveTargetElement(target),
      actionExecutor: async (action: AgentAction, valRes: ValidationResult) => executeDomAction(action, valRes)
    });

    controller.startTask("Find Paris flights", "https://flights.example.com");

    // Execute step 1
    const step1Outcome = await controller.runNextCycle();
    expect(step1Outcome.success).toBe(true);
    expect(controller.getState()).toBe(TaskState.OBSERVING);
    const input = document.getElementById("dest-city") as HTMLInputElement;
    expect(input.value).toBe("Paris");

    // Execute step 2
    const step2Outcome = await controller.runNextCycle();
    expect(step2Outcome.success).toBe(true);
    expect(controller.getState()).toBe(TaskState.OBSERVING);

    // Execute step 3 (terminal)
    const step3Outcome = await controller.runNextCycle();
    expect(step3Outcome.success).toBe(true);
    expect(controller.getState()).toBe(TaskState.COMPLETED);

    const session = controller.getActiveSession();
    expect(session?.totalCyclesCompleted).toBe(3);
    expect(session?.stepHistory.length).toBe(3);
  });
});

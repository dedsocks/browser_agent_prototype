import { describe, it, expect, vi } from "vitest";
import { AgentController } from "../../../src/agent/controller.js";
import { MockPlannerClient } from "../../../src/agent/planner-client.js";
import { TaskState } from "../../../src/common/types.js";

describe("Agent Controller State Machine", () => {
  it("starts a task in OBSERVING state", async () => {
    const planner = new MockPlannerClient([]);
    const controller = new AgentController({ planner });

    const session = controller.startTask("Book travel ticket", "https://travel.example.com");
    expect(session.goal).toBe("Book travel ticket");
    expect(session.state).toBe(TaskState.OBSERVING);
  });

  it("pauses active task, records pausedUrl, and rejects resume on URL divergence without confirmation", async () => {
    const planner = new MockPlannerClient([]);
    const controller = new AgentController({ planner });

    controller.startTask("Fill tax form", "https://gov.example.com/taxes");
    controller.pauseTask();

    expect(controller.getState()).toBe(TaskState.PAUSED);

    // Resume on different URL
    const resumed = controller.resumeTask("https://phishing.example.com/login", false);
    expect(resumed.success).toBe(false);
    expect(resumed.requiresConfirmation).toBe(true);
    expect(controller.getState()).toBe(TaskState.PAUSED);

    // Resume with explicit confirmation
    const confirmedResume = controller.resumeTask("https://phishing.example.com/login", true);
    expect(confirmedResume.success).toBe(true);
    expect(controller.getState()).toBe(TaskState.OBSERVING);
  });

  it("aborts active task returning to IDLE", () => {
    const planner = new MockPlannerClient([]);
    const controller = new AgentController({ planner });

    controller.startTask("Shopping task", "https://shop.example.com");
    controller.abortTask();

    expect(controller.getState()).toBe(TaskState.IDLE);
    expect(controller.getActiveSession()).toBeNull();
  });
});

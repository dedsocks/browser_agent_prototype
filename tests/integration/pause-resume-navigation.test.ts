import { describe, it, expect } from "vitest";
import { AgentController } from "../../src/agent/controller.js";
import { MockPlannerClient } from "../../src/agent/planner-client.js";
import { TaskState } from "../../src/common/types.js";

describe("Pause, Resume & Navigation Protection Integration (Constitution Article XVI)", () => {
  it("detects URL mismatch when resuming after user manual navigation", async () => {
    const controller = new AgentController({
      planner: new MockPlannerClient([])
    });

    controller.startTask("Book ticket", "https://airline.com/booking");
    controller.pauseTask();

    expect(controller.getState()).toBe(TaskState.PAUSED);

    // User navigates manually to a different website while paused
    const resumeAttempt = controller.resumeTask("https://phishing.com/landing", false);

    expect(resumeAttempt.success).toBe(false);
    expect(resumeAttempt.requiresConfirmation).toBe(true);
    expect(resumeAttempt.warning).toContain("diverged");
    expect(controller.getState()).toBe(TaskState.PAUSED);

    // User explicitly confirms navigation
    const confirmedAttempt = controller.resumeTask("https://phishing.com/landing", true);
    expect(confirmedAttempt.success).toBe(true);
    expect(controller.getState()).toBe(TaskState.OBSERVING);
    expect(controller.getActiveSession()?.activeUrl).toBe("https://phishing.com/landing");
  });
});

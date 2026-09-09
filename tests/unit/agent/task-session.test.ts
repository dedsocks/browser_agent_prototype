import { describe, it, expect } from "vitest";
import { TaskSessionManager } from "../../../src/agent/task-session.js";
import { TaskState } from "../../../src/common/types.js";

describe("Task Session Manager", () => {
  it("initializes new session in IDLE or OBSERVING state", () => {
    const manager = new TaskSessionManager();
    const session = manager.createSession("Book hotel in Seattle", "https://hotels.example.com");

    expect(session.sessionId).toBeDefined();
    expect(session.goal).toBe("Book hotel in Seattle");
    expect(session.state).toBe(TaskState.IDLE);
    expect(session.activeUrl).toBe("https://hotels.example.com");
    expect(session.stepHistory.length).toBe(0);
  });

  it("transitions state correctly and logs step entries", () => {
    const manager = new TaskSessionManager();
    const session = manager.createSession("Search books", "https://books.example.com");

    manager.transitionTo(TaskState.OBSERVING);
    expect(session.state).toBe(TaskState.OBSERVING);

    manager.recordStep({
      stepIndex: 0,
      cycleId: "cycle_1",
      timestamp: new Date().toISOString(),
      state: TaskState.EXECUTING_ACTION,
      actionProposed: {
        id: "act_1",
        type: "type",
        target: { cssSelector: "#query" },
        value: "Science Fiction"
      },
      pageUrl: "https://books.example.com"
    });

    expect(session.stepHistory.length).toBe(1);
    expect(session.totalCyclesCompleted).toBe(1);
  });

  it("handles pause and records pausedUrl", () => {
    const manager = new TaskSessionManager();
    const session = manager.createSession("Test pause", "https://example.com/step1");

    manager.pause();
    expect(session.state).toBe(TaskState.PAUSED);
    expect(session.pausedUrl).toBe("https://example.com/step1");

    // Check URL divergence detection
    const isMismatch = manager.checkUrlDivergence("https://other-site.com");
    expect(isMismatch).toBe(true);
    expect(session.urlMismatchWarning).toBe(true);
  });

  it("completes and fails task appropriately", () => {
    const manager = new TaskSessionManager();
    manager.createSession("Test completion", "https://example.com");

    manager.complete();
    expect(manager.getSession()?.state).toBe(TaskState.COMPLETED);
    expect(manager.getSession()?.completedAt).toBeDefined();

    manager.createSession("Test failure", "https://example.com");
    manager.fail("Pre-transmission verification leak detected");
    expect(manager.getSession()?.state).toBe(TaskState.FAILED);
    expect(manager.getSession()?.error).toContain("verification leak detected");
  });
});

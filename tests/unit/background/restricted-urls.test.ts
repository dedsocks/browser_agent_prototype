import { describe, it, expect, vi } from "vitest";
import { isRestrictedUrl, waitForTabComplete } from "../../../src/background/index.js";
import { AgentController } from "../../../src/agent/controller.js";
import { MockPlannerClient } from "../../../src/agent/planner-client.js";
import { TaskState } from "../../../src/common/types.js";

describe("Restricted URL Protection & Navigation", () => {
  it("correctly flags restricted internal and store URLs", () => {
    expect(isRestrictedUrl("chrome://newtab")).toBe(true);
    expect(isRestrictedUrl("chrome://extensions")).toBe(true);
    expect(isRestrictedUrl("chrome://settings")).toBe(true);
    expect(isRestrictedUrl("chrome-extension://abcdefg/popup.html")).toBe(true);
    expect(isRestrictedUrl("edge://extensions")).toBe(true);
    expect(isRestrictedUrl("devtools://devtools/bundled/inspector.html")).toBe(true);
    expect(isRestrictedUrl("view-source:https://example.com")).toBe(true);
    expect(isRestrictedUrl("about:blank")).toBe(true);
    expect(isRestrictedUrl("https://chromewebstore.google.com/detail/123")).toBe(true);
    expect(isRestrictedUrl("https://chrome.google.com/webstore/category/extensions")).toBe(true);

    // Public websites should NOT be restricted
    expect(isRestrictedUrl("https://example.com")).toBe(false);
    expect(isRestrictedUrl("http://localhost:3000")).toBe(false);
    expect(isRestrictedUrl("https://www.google.com")).toBe(false);
    expect(isRestrictedUrl("")).toBe(false);
    expect(isRestrictedUrl(undefined)).toBe(false);
  });

  it("handles navigation from restricted tab smoothly in perception loop", async () => {
    let currentLiveUrl = "chrome://newtab";

    const planner = new MockPlannerClient([
      // Step 1: on chrome://newtab, planner navigates to public site
      {
        cycle_id: "cycle_1",
        thought: "Navigating to public website from restricted tab",
        is_terminal: false,
        action: {
          id: "act_nav",
          type: "navigate",
          value: "https://www.example.com"
        }
      },
      // Step 2: on example.com, task is completed
      {
        cycle_id: "cycle_2",
        thought: "Task completed on example.com",
        is_terminal: true
      }
    ]);

    const controller = new AgentController({
      planner,
      snapshotProvider: async () => {
        if (isRestrictedUrl(currentLiveUrl)) {
          return {
            root_node_id: "restricted_tab",
            url: currentLiveUrl,
            nodes: [
              {
                node_id: "restricted_tab",
                tag: "div",
                attributes: {},
                text: "Internal browser page",
                bounds: { x: 0, y: 0, width: 1280, height: 800 },
                children_ids: []
              }
            ]
          };
        }
        return {
          root_node_id: "doc_root",
          url: currentLiveUrl,
          nodes: [
            {
              node_id: "doc_root",
              tag: "body",
              attributes: {},
              text: "Welcome to Example Domain",
              bounds: { x: 0, y: 0, width: 1280, height: 800 },
              children_ids: []
            }
          ]
        };
      },
      actionExecutor: async (action) => {
        if (action.type === "navigate" && action.value) {
          currentLiveUrl = action.value;
          return { success: true, durationMs: 15 };
        }
        return { success: true, durationMs: 5 };
      }
    });

    controller.startTask("Visit Example", currentLiveUrl);

    // Cycle 1: navigates
    const res1 = await controller.runNextCycle();
    expect(res1.success).toBe(true);
    expect(res1.isTerminal).toBe(false);
    expect(currentLiveUrl).toBe("https://www.example.com");

    // Cycle 2: completes on example.com
    const res2 = await controller.runNextCycle();
    expect(res2.success).toBe(true);
    expect(res2.isTerminal).toBe(true);
    expect(controller.getState()).toBe(TaskState.COMPLETED);
  });
});

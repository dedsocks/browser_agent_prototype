import { describe, it, expect } from "vitest";
import { MockPlannerClient, RemoteVlmPlannerClient, PlannerRequest, PlannerResponse } from "../../../src/agent/planner-client.js";
import { SanitizedPayloadEnvelope, SemanticToken } from "../../../src/common/types.js";

describe("Planner Client (Schema v1.5.0 Contract)", () => {
  const dummyPayload: SanitizedPayloadEnvelope = {
    schema_version: "1.5.0",
    cycle_id: "cycle_test_001",
    token_manifest: [SemanticToken.FINANCIAL, SemanticToken.CREDENTIAL],
    sanitized_dom_tree: {
      node_id: "root",
      tag: "body",
      bounds: { x: 0, y: 0, width: 800, height: 600 },
      children: []
    },
    metrics: {
      sanitization_duration_ms: 25,
      entities_redacted_count: 2
    }
  };

  const sampleRequest: PlannerRequest = {
    schema_version: "1.5.0",
    session_id: "sess_123",
    cycle_id: "cycle_test_001",
    goal: "Find flights to Tokyo",
    step_index: 0,
    token_manifest: dummyPayload.token_manifest,
    sanitized_payload: dummyPayload
  };

  it("MockPlannerClient returns scripted actions in order and terminates", async () => {
    const mockSteps: PlannerResponse[] = [
      {
        cycle_id: "cycle_test_001",
        thought: "I will type Tokyo in origin field",
        is_terminal: false,
        action: {
          id: "act_1",
          type: "type",
          target: { cssSelector: "#destination" },
          value: "Tokyo"
        }
      },
      {
        cycle_id: "cycle_test_002",
        thought: "Search complete, flights found",
        is_terminal: true,
        result_summary: "Found 5 flights to Tokyo"
      }
    ];

    const planner = new MockPlannerClient(mockSteps);

    const res1 = await planner.planStep(sampleRequest);
    expect(res1.is_terminal).toBe(false);
    expect(res1.action?.type).toBe("type");
    expect(res1.action?.value).toBe("Tokyo");

    const req2 = { ...sampleRequest, cycle_id: "cycle_test_002", step_index: 1 };
    const res2 = await planner.planStep(req2);
    expect(res2.is_terminal).toBe(true);
    expect(res2.result_summary).toContain("Found 5 flights");
  });

  it("RemoteVlmPlannerClient validates schema_version 1.5.0 before transmission", async () => {
    const planner = new RemoteVlmPlannerClient({ endpointUrl: "http://localhost:9999/v1/plan" });

    // With invalid schema_version
    const invalidRequest = { ...sampleRequest, schema_version: "0.9.0" as any };
    await expect(planner.planStep(invalidRequest)).rejects.toThrow("Invalid schema_version");
  });
});

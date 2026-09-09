/**
 * VLM Reasoning Planner Client
 * Transmits Schema v1.5.0 sanitized payload envelopes to reasoning planner.
 * Implements Constitution Principle III (Concrete Sanitization & Server Awareness)
 * and Principle XIV (Browser Agent Architecture & Trust Boundaries).
 */

import { AgentAction, SanitizedPayloadEnvelope } from "../common/types.js";
import { SCHEMA_VERSION } from "../common/constants.js";

export interface PlannerRequest {
  schema_version: "1.5.0";
  session_id: string;
  cycle_id: string;
  goal: string;
  step_index: number;
  token_manifest: string[];
  sanitized_payload: SanitizedPayloadEnvelope;
}

export interface PlannerResponse {
  cycle_id: string;
  thought: string;
  is_terminal: boolean;
  result_summary?: string;
  action?: AgentAction;
}

export interface IPlannerClient {
  planStep(request: PlannerRequest): Promise<PlannerResponse>;
}

/**
 * Deterministic Mock Planner for unit/integration testing and offline operation.
 */
export class MockPlannerClient implements IPlannerClient {
  private steps: PlannerResponse[];
  private currentIndex: number = 0;

  constructor(steps: PlannerResponse[] = []) {
    this.steps = steps;
  }

  public addStep(step: PlannerResponse): void {
    this.steps.push(step);
  }

  public reset(): void {
    this.currentIndex = 0;
  }

  public async planStep(request: PlannerRequest): Promise<PlannerResponse> {
    if (this.currentIndex >= this.steps.length) {
      return {
        cycle_id: request.cycle_id,
        thought: "All scripted steps exhausted; terminating task",
        is_terminal: true,
        result_summary: "Task script completed"
      };
    }

    const step = this.steps[this.currentIndex++];
    return {
      ...step,
      cycle_id: request.cycle_id
    };
  }
}

/**
 * Remote VLM Planner communicating via HTTP POST adhering to Schema 1.5.0.
 */
export class RemoteVlmPlannerClient implements IPlannerClient {
  private endpointUrl: string;
  private apiKey?: string;

  constructor(options: { endpointUrl: string; apiKey?: string }) {
    this.endpointUrl = options.endpointUrl;
    this.apiKey = options.apiKey;
  }

  public async planStep(request: PlannerRequest): Promise<PlannerResponse> {
    // Validate schema version per Constitution Principle III
    if (request.schema_version !== SCHEMA_VERSION) {
      throw new Error(`Invalid schema_version: expected ${SCHEMA_VERSION}, received ${request.schema_version}`);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Schema-Version": SCHEMA_VERSION
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Planner API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as PlannerResponse;
  }
}

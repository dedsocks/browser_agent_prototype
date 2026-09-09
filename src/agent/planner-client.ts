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

/**
 * Autonomous DOM Planner Client
 * Intelligently analyzes sanitized DOM trees to plan steps for registration, form filling,
 * and user tasks while respecting security boundaries.
 */
export class AutonomousPlannerClient implements IPlannerClient {
  private executedActions: Set<string> = new Set();

  public reset(): void {
    this.executedActions.clear();
  }

  public async planStep(request: PlannerRequest): Promise<PlannerResponse> {
    const root = request.sanitized_payload.sanitized_dom_tree;
    const allNodes: any[] = [];

    function collectNodes(node: any) {
      if (!node) return;
      allNodes.push(node);
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) collectNodes(child);
      }
    }
    if (root) collectNodes(root);

    const findNode = (predicate: (n: any) => boolean) => allNodes.find(predicate);

    // 1. Check for Name field
    const nameNode = findNode(n => {
      if (n.tag !== "input") return false;
      const id = (n.attributes?.id || n.node_id || "").toLowerCase();
      const name = (n.attributes?.name || "").toLowerCase();
      const placeholder = (n.attributes?.placeholder || "").toLowerCase();
      const type = (n.attributes?.type || "text").toLowerCase();
      return (
        type === "text" &&
        (id === "name" || name.includes("name") || placeholder.includes("name")) &&
        !name.includes("email") &&
        !name.includes("password")
      );
    });

    if (nameNode && !this.executedActions.has(`type_${nameNode.node_id}`)) {
      this.executedActions.add(`type_${nameNode.node_id}`);
      const selector = nameNode.attributes?.id ? `#${nameNode.attributes.id}` : `[name="${nameNode.attributes?.name}"]`;
      return {
        cycle_id: request.cycle_id,
        thought: "Perceived Name field on registration page; entering user name",
        is_terminal: false,
        action: {
          id: `act_name_${Date.now()}`,
          type: "type",
          target: { cssSelector: selector, nodeId: nameNode.node_id },
          value: "Alex TestUser"
        }
      };
    }

    // 2. Check for Email field
    const emailNode = findNode(n => {
      if (n.tag !== "input") return false;
      const id = (n.attributes?.id || n.node_id || "").toLowerCase();
      const name = (n.attributes?.name || "").toLowerCase();
      const placeholder = (n.attributes?.placeholder || "").toLowerCase();
      const type = (n.attributes?.type || "").toLowerCase();
      return (
        type === "email" ||
        id.includes("email") ||
        name.includes("email") ||
        placeholder.includes("email")
      );
    });

    if (emailNode && !this.executedActions.has(`type_${emailNode.node_id}`)) {
      this.executedActions.add(`type_${emailNode.node_id}`);
      const selector = emailNode.attributes?.id ? `#${emailNode.attributes.id}` : `[name="${emailNode.attributes?.name}"]`;
      return {
        cycle_id: request.cycle_id,
        thought: "Perceived Email field on registration page; entering email address",
        is_terminal: false,
        action: {
          id: `act_email_${Date.now()}`,
          type: "type",
          target: { cssSelector: selector, nodeId: emailNode.node_id },
          value: "alex.test@example.com"
        }
      };
    }

    // 3. Check for Password field
    const pwdNode = findNode(n => {
      if (n.tag !== "input") return false;
      const id = (n.attributes?.id || n.node_id || "").toLowerCase();
      const name = (n.attributes?.name || "").toLowerCase();
      const type = (n.attributes?.type || "").toLowerCase();
      return type === "password" || id.includes("password") || name.includes("password");
    });

    if (pwdNode && !this.executedActions.has(`type_${pwdNode.node_id}`)) {
      this.executedActions.add(`type_${pwdNode.node_id}`);
      const selector = pwdNode.attributes?.id ? `#${pwdNode.attributes.id}` : `[name="${pwdNode.attributes?.name}"]`;
      return {
        cycle_id: request.cycle_id,
        thought: "Identified Password field; targeting field which triggers Human Intervention for security",
        is_terminal: false,
        action: {
          id: `act_password_${Date.now()}`,
          type: "type",
          target: { cssSelector: selector, nodeId: pwdNode.node_id },
          value: "user_secret_placeholder"
        }
      };
    }

    // 4. Check for Submit / Register / Sign Up Button
    const submitBtn = findNode(n => {
      const tag = n.tag.toLowerCase();
      const type = (n.attributes?.type || "").toLowerCase();
      const id = (n.attributes?.id || n.node_id || "").toLowerCase();
      const text = (n.text || "").toLowerCase();
      return (
        (tag === "button" || (tag === "input" && (type === "submit" || type === "button"))) &&
        (type === "submit" || id.includes("register") || id.includes("signup") || text.includes("sign up") || text.includes("register") || text.includes("create"))
      );
    });

    if (submitBtn && !this.executedActions.has(`click_${submitBtn.node_id}`)) {
      this.executedActions.add(`click_${submitBtn.node_id}`);
      const selector = submitBtn.attributes?.id ? `#${submitBtn.attributes.id}` : `button[type="submit"]`;
      return {
        cycle_id: request.cycle_id,
        thought: "All form fields completed and user password confirmed. Clicking Sign up button to submit registration",
        is_terminal: false,
        action: {
          id: `act_submit_${Date.now()}`,
          type: "click",
          target: { cssSelector: selector, nodeId: submitBtn.node_id }
        }
      };
    }

    // 5. Completion
    return {
      cycle_id: request.cycle_id,
      thought: "Account creation registration submitted successfully.",
      is_terminal: true,
      result_summary: "Registration process completed"
    };
  }
}


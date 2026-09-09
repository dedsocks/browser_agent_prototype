# Data Model: Perception-Reasoning-Action Autonomous Loop & Agent Controller

**Feature**: `002-perception-action-loop`  
**Date**: 2026-09-09  

---

## Entities & Type Definitions

### 1. Task Lifecycle States

```typescript
export enum TaskState {
  IDLE = "IDLE",
  OBSERVING = "OBSERVING",
  SANITIZING = "SANITIZING",
  AWAITING_REASONING = "AWAITING_REASONING",
  VALIDATING_ACTION = "VALIDATING_ACTION",
  EXECUTING_ACTION = "EXECUTING_ACTION",
  PAUSED = "PAUSED",
  INTERVENTION_REQUIRED = "INTERVENTION_REQUIRED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED"
}
```

### 2. Proposed Agent Action

```typescript
export type ActionType = "click" | "type" | "scroll" | "navigate";

export interface TargetSelector {
  nodeId?: string;
  cssSelector?: string;
  xpath?: string;
  expectedText?: string;
  expectedBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AgentAction {
  id: string;
  type: ActionType;
  target?: TargetSelector;
  value?: string; // For "type" or "navigate"
  scrollOffset?: { x: number; y: number }; // For "scroll"
  thought?: string;
}
```

### 3. Action Validation Result

```typescript
export interface ValidationResult {
  isValid: boolean;
  errorCode?: "UNSUPPORTED_ACTION" | "TARGET_NOT_FOUND" | "TARGET_NOT_VISIBLE" | "GEOMETRIC_MISMATCH" | "SENSITIVE_TARGET_BLOCKED" | "VALIDATION_FAULT";
  diagnosticMessage?: string;
  requiresIntervention?: boolean;
  interventionReason?: string;
  targetElementBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

### 4. Human Intervention Context

```typescript
export interface HumanInterventionContext {
  cycleId: string;
  targetFieldId?: string;
  targetFieldName?: string;
  secretType: "PASSWORD" | "CREDENTIAL" | "PAYMENT_CARD" | "MFA_CODE" | "MANUAL_CAPTCHA";
  promptMessage: string;
  timestamp: string;
}
```

### 5. Step Log Entry & Audit Record

```typescript
export interface StepLogEntry {
  stepIndex: number;
  cycleId: string;
  timestamp: string;
  state: TaskState;
  actionProposed?: AgentAction;
  validationResult?: ValidationResult;
  executionOutcome?: {
    success: boolean;
    error?: string;
    durationMs: number;
  };
  pageUrl: string;
}
```

### 6. Task Session

```typescript
export interface TaskSession {
  sessionId: string;
  goal: string;
  state: TaskState;
  activeUrl: string;
  pausedUrl?: string;
  urlMismatchWarning?: boolean;
  currentCycleId?: string;
  interventionContext?: HumanInterventionContext;
  stepHistory: StepLogEntry[];
  totalCyclesCompleted: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}
```

---

## State Transition Matrix

| Current State | Event / Trigger | Next State | Notes |
| :--- | :--- | :--- | :--- |
| `IDLE` | `START_TASK(goal)` | `OBSERVING` | Initializes new `TaskSession`. |
| `OBSERVING` | `SNAPSHOT_CAPTURED` | `SANITIZING` | Submits snapshot to background privacy pipeline. |
| `SANITIZING` | `DOM_SANITIZATION_SUCCESS` | `AWAITING_REASONING` | Submits Schema 1.5.0 envelope to planner. |
| `SANITIZING` | `DOM_SANITIZATION_FAILURE` | `FAILED` | Fail-closed halt; records diagnostic abort. |
| `AWAITING_REASONING` | `PLANNER_ACTION_RECEIVED` | `VALIDATING_ACTION` | Evaluates action against safety allowlist. |
| `AWAITING_REASONING` | `PLANNER_TASK_COMPLETED` | `COMPLETED` | Goal reached. |
| `AWAITING_REASONING` | `PLANNER_ERROR` | `FAILED` | Planner unreachable or response malformed. |
| `VALIDATING_ACTION` | `VALIDATION_PASSED` | `EXECUTING_ACTION` | Target re-resolved and bounds verified. |
| `VALIDATING_ACTION` | `VALIDATION_FAILED` | `FAILED` | Fail-closed halt. |
| `VALIDATING_ACTION` | `INTERVENTION_TRIGGERED` | `INTERVENTION_REQUIRED` | Credential/secret detected; suspends perception. |
| `EXECUTING_ACTION` | `EXECUTION_SUCCESS` | `OBSERVING` | Dispatches events on live DOM, restarts loop. |
| `EXECUTING_ACTION` | `EXECUTION_FAILURE` | `FAILED` | DOM dispatch error. |
| *ANY ACTIVE STATE* | `USER_PAUSE` | `PAUSED` | Records `pausedUrl`, settles in-flight actions. |
| `PAUSED` | `USER_RESUME` (same URL) | `OBSERVING` | Discards stale observations, fresh capture. |
| `PAUSED` | `USER_RESUME` (divergent URL) | `PAUSED` | Sets `urlMismatchWarning: true`, prompts user. |
| `INTERVENTION_REQUIRED`| `USER_RESUME` | `OBSERVING` | Fresh observation restart per Principle XV. |
| *ANY STATE* | `USER_ABORT` | `IDLE` | Terminates session and cleans up. |

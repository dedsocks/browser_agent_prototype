# Quickstart: Perception-Reasoning-Action Autonomous Loop & Agent Controller

**Feature**: `002-perception-action-loop`  
**Date**: 2026-09-09  

---

## Overview

This guide details how to verify and exercise the autonomous perception-reasoning-action loop, local action validation, human intervention handling, and pause/resume lifecycle controls.

---

## 1. Prerequisites

- Node.js 18+ installed
- Repository dependencies installed (`npm install`)
- Project builds cleanly (`npm run build` or `npx tsc --noEmit`)

---

## 2. Running Automated Tests

Run the full Vitest suite covering agent controller state transitions, action validation, and mock multi-turn cycles:

```bash
# Run all unit and integration tests
npm test

# Run specifically agent controller & action validation tests
npx vitest run tests/unit/agent/
npx vitest run tests/integration/perception-action-loop.test.ts
npx vitest run tests/integration/human-intervention.test.ts
```

---

## 3. Verification Scenarios

### Scenario A: End-to-End Multi-Step Task Execution
1. Initialize `AgentController` with a `MockPlannerClient` providing 3 sequential steps:
   - Step 1: Type query `"San Francisco flights"` into search input.
   - Step 2: Click the submit button.
   - Step 3: Terminal completion signal (`is_terminal: true`).
2. Verify each step triggers:
   `OBSERVING` → `SANITIZING` → `AWAITING_REASONING` → `VALIDATING_ACTION` → `EXECUTING_ACTION` → `OBSERVING`.
3. Verify that the task transitions to `COMPLETED` and the DOM inputs reflect the simulated typing and click.

### Scenario B: Action Validation Rejecting Dangerous or Mismatched Actions
1. Planner proposes a non-allowlisted action (e.g. `script_eval` or `file_download`).
2. Action Validator intercepts the action.
3. Verify that the validator returns `isValid: false`, `errorCode: "UNSUPPORTED_ACTION"`, and transitions session to `FAILED` fail-closed.

### Scenario C: Human-in-the-Loop Credential Protection
1. Planner proposes an action typing into an input of type `password` or matching credential patterns.
2. Action Validator intercepts the field and flags `requiresIntervention: true`.
3. Verify the agent controller transitions to `INTERVENTION_REQUIRED` and suspends observation.
4. Call `resumeTask()`; verify that the controller discards old state and restarts the cycle fresh from `OBSERVING`.

### Scenario D: Pause and Resume with URL Safety Check
1. Start an automated task on `https://example.com/checkout`.
2. Pause the task.
3. Simulate user navigation to `https://malicious-site.com`.
4. Attempt to resume; verify that the controller detects the URL divergence and flags a warning without executing any actions.

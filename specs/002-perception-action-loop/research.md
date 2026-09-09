# Research: Perception-Reasoning-Action Autonomous Loop & Agent Controller

**Feature**: `002-perception-action-loop`  
**Date**: 2026-09-09  

---

## 1. Agent Controller State Machine Architecture

### Decision
Implement a deterministic Finite State Machine (FSM) managing 10 discrete states:
- `IDLE`: No active task session.
- `OBSERVING`: Capturing DOM snapshot from active tab.
- `SANITIZING`: Running PII detection, tokenization, and verification in background/offscreen.
- `AWAITING_REASONING`: Transmitting Schema 1.5.0 sanitized payload to VLM planner.
- `VALIDATING_ACTION`: Checking action against allowlist, element resolution, and privacy boundaries.
- `EXECUTING_ACTION`: Dispatching DOM events in content script.
- `PAUSED`: Execution paused by user; in-flight actions settled.
- `INTERVENTION_REQUIRED`: Execution suspended for credential or secret entry.
- `COMPLETED`: Task successfully concluded.
- `FAILED`: Task aborted due to fail-closed error or user cancellation.

### Rationale
- Constitution Principle XV mandates a strict sequential cycle: `Observe → Detect → Sanitize → Verify → Transmit → Reason → Validate → Execute → Repeat`.
- An explicit state machine prevents race conditions when users click Pause or Abort during asynchronous operations (e.g. while awaiting planner response or sanitizing DOM).
- Enforces the constitutional rule that resuming from `PAUSED` or `INTERVENTION_REQUIRED` *always* transitions back to `OBSERVING` (discarding stale observation state).

### Alternatives Considered
- *Ad-hoc async/await loop*: Prone to race conditions on cancellation and cannot cleanly enforce pause/resume guarantees.
- *Redux/XState external library*: Adds unwanted bundle size and external dependencies; a pure TypeScript typed FSM provides zero overhead and complete compile-time type safety.

---

## 2. Local Action Validation & Element Re-resolution

### Decision
The Action Validator enforces four strict criteria before any proposed action touches the browser:
1. **Action Allowlisting**: Action type must strictly be one of `["click", "type", "scroll", "navigate"]`.
2. **Target Re-resolution**: The target element must be re-queried on the live DOM using a hierarchical fallback (`nodeId`, `id`, `name`, CSS selector, XPath).
3. **Geometric & Structural Consistency**:
   - Element must be visible (`offsetParent !== null`, `getClientRects().length > 0`, `visibility !== "hidden"`, `display !== "none"`).
   - If expected bounding coordinates were provided, verify center point falls within reasonable proximity (±20% tolerance) to prevent clicking misplaced or dynamically shifted elements.
4. **Sensitive Field Protection**:
   - If the action is `type` and the target is identified as a password, credential, credit card, or secret field, reject autonomous execution and immediately trigger Human Intervention per Principle XIII.

### Rationale
- Constitution Principle XIV states that the cloud reasoning model is an untrusted external planner.
- The browser agent holds sole authority over live action execution.
- Web pages are dynamic; elements can shift, be removed, or be replaced between observation and execution. Live re-resolution guarantees safety and prevents unintended misclicks.

### Alternatives Considered
- *Blind Coordinate Clicking*: Dispatches mouse events directly to `(x, y)`. High risk of misclicking if page scrolls or reflows.
- *Selector-only Matching*: Fails on dynamic single-page applications with generated class names; multi-strategy resolution (`nodeId` + selector + geometry) is much more robust.

---

## 3. Human-in-the-Loop Secret Handling (Constitution Article XIII)

### Decision
When the agent planner proposes filling a credential or payment field, or when the target element matches credential patterns:
1. The controller halts autonomous execution and transitions to `INTERVENTION_REQUIRED`.
2. An `INTERVENTION_REQUESTED` event is dispatched to the extension UI (popup) and content script, highlighting the input field with an amber/blue guidance overlay.
3. Automated observation and network serialization are completely suspended.
4. The user enters their password, MFA code, or card information manually.
5. The user clicks "Resume" in the extension popup.
6. The controller verifies whether the page URL remained consistent, discards all prior observation caches, and immediately restarts the perception loop from Step 1 (`OBSERVING`).

### Rationale
- Principle XIII strictly forbids autonomous typing, inspection, inference, or storage of user-controlled secrets.
- Suspending observation while in intervention mode ensures that user-typed credentials are never captured during or immediately after typing.
- Taking a fresh observation after resume ensures subsequent steps perceive the authenticated page state.

---

## 4. VLM Reasoning Client Interface & Mock Planner

### Decision
Provide a flexible `PlannerClient` interface:
- Standardized request format: serialized `SanitizedPayloadEnvelope` (Schema v1.5.0) with task prompt and previous step history.
- Standardized response format: `{ thought: string, action: AgentAction, is_terminal: boolean, result_summary?: string }`.
- Implementation 1: `RemoteVlmPlannerClient` connects via HTTP/WebSocket to any cloud VLM endpoint adhering to the schema.
- Implementation 2: `MockPlannerClient` executes a configurable script of actions for automated unit/integration tests and offline demonstrations.

### Rationale
- Decouples local agent execution from specific cloud model vendors (OpenAI, Anthropic, Gemini, local Ollama).
- Enables robust, deterministic automated testing without network access or API key dependencies.

---

## 5. Pause/Resume & Navigation Divergence Protection

### Decision
- When paused, in-flight promises settle cleanly or are ignored.
- The controller records the active URL when entering `PAUSED` state.
- Upon user clicking `Resume`, the controller compares the current tab URL with the recorded URL:
  - If domains match and path is unchanged: proceeds directly to fresh observation.
  - If URL has changed: sets state to `PAUSED` with warning flag `URL_MISMATCH` and requires explicit user confirmation: "The page has navigated to [URL]. Resume task on this new page or restart?".

### Rationale
- Constitution Principle XVI explicitly requires that if the user manually navigates to an unrelated URL while paused, resume must prompt for confirmation.

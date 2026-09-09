# Feature Specification: Perception-Reasoning-Action Autonomous Loop & Agent Controller

**Feature Branch**: `002-perception-action-loop`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "Perception-Reasoning-Action autonomous execution loop with action validation, human-in-the-loop secret intervention, and agent lifecycle management based on Constitution Articles XIII, XIV, XV, and XVI."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Autonomous Multi-Step Perception-Action Loop (Priority: P1)

When a user instructs the browser agent to accomplish a task (e.g. "Search for flights to Tokyo" or "Fill out shipping address and proceed to checkout"), the agent initiates an automated, step-by-step cycle: observing the current page, sanitizing and verifying data boundaries locally, submitting the sanitized structural topology to the reasoning engine, receiving a proposed action, validating that the action is safe and matches the live page elements, executing the action on the page, and continuing until the task goal is fulfilled.

**Why this priority**: The continuous perception-reasoning-action loop is the core operational engine of an autonomous browser agent. Without this disciplined loop, the agent cannot interact dynamically with multi-step web applications.

**Independent Test**: Can be independently tested by starting a multi-step task on a mock multi-page form, verifying each discrete cycle (observe -> detect -> sanitize -> verify -> transmit -> reason -> validate -> execute -> repeat) executes sequentially to successful task completion without exposing unmasked sensitive data.

**Acceptance Scenarios**:

1. **Given** an active browser tab and an authorized user task instruction, **When** the agent starts execution, **Then** the system observes the live page, applies local sanitization and verification, transmits the privacy envelope to the reasoning engine, validates the returned step, and executes it.
2. **Given** a multi-turn task requiring successive interactions (e.g., typing a search query, then clicking search results), **When** each action completes, **Then** the agent triggers a fresh observation cycle and updates task status until completion.
3. **Given** a task that reaches its declared objective, **When** the reasoning engine determines the goal is satisfied, **Then** the agent marks the task as completed, stops further autonomous actions, and reports the result to the user.

---

### User Story 2 - Strict Local Action Validation & Safety Allowlisting (Priority: P1)

Before any proposed action from the reasoning engine is executed on the user's browser, the local agent controller validates the action against strict safety rules: only allowlisted action primitives (`click`, `type`, `scroll`, `navigate`) are permitted, the target element must exist on the live page and match the expected structural and geometric fingerprint, and the action must not target sensitive fields autonomously.

**Why this priority**: The reasoning engine is an external planner that could hallucinate invalid coordinates, propose harmful actions, or be influenced by untrusted web page content. Strict client-side validation prevents unintended actions, DOM injection, or unauthorized side effects.

**Independent Test**: Can be independently tested by feeding arbitrary, malformed, non-allowlisted, or geometrically mismatched actions to the validator and verifying that invalid actions are immediately rejected fail-closed, halting execution safely.

**Acceptance Scenarios**:

1. **Given** a proposed action with an unsupported or dangerous primitive (e.g., executing arbitrary script or downloading executable binaries), **When** local action validation executes, **Then** the action is rejected immediately, halting the task session fail-closed.
2. **Given** a proposed action targeting a specific element ID or coordinate, **When** the validator checks the live page, **Then** it re-resolves the target on the live document to verify geometric bounds and structural identity; if the element is absent, mutated, or ambiguous, execution halts fail-closed.
3. **Given** a validated action targeting an authentic interactive element, **When** validation succeeds, **Then** the system triggers the action on the live document and observes the resulting state transition.

---

### User Story 3 - Human-in-the-Loop Secret & Credential Handling (Priority: P1)

When a task encounters a password field, two-factor authentication code, payment card entry, or other sensitive authentication challenge, the agent halts autonomous actions, suspends automated perception and state capture, and transitions to a Human Intervention state requesting the user to enter their credentials directly. Once the user completes the input and clicks resume, the agent takes a fresh observation from scratch before continuing.

**Why this priority**: The agent must never autonomously type, infer, store, or inspect passwords, payment cards, or authentication credentials (Constitution Article XIII). Explicit human intervention safeguards user trust and security.

**Independent Test**: Can be independently tested by running a task that navigates to a checkout or login form; when reaching the credential or payment field, verify that autonomous execution immediately pauses, automated state transmission is suspended, and the agent waits for the user to explicitly resume.

**Acceptance Scenarios**:

1. **Given** an action targeting or encountering a credential or secret entry field, **When** the agent detects the secret requirement, **Then** the agent transitions to Human Intervention state, alerts the user, and suspends autonomous perception.
2. **Given** the agent is in Human Intervention state, **When** the user manually types their password or MFA code and clicks Resume, **Then** the agent clears old observation state, runs a fresh perception and sanitization cycle from scratch, and resumes automation.

---

### User Story 4 - Agent Control Lifecycle: Pause, Resume, Navigation Protection & Abort (Priority: P2)

The user retains complete, continuous control over the agent. At any point during autonomous execution, the user can pause the agent, cleanly abort in-flight cycles, or stop the task entirely. If the user manually navigates to a different web domain or URL while the agent is paused, the agent prompts for confirmation upon resume to prevent executing actions on an unintended page.

**Why this priority**: Autonomous browser agents must remain strictly subordinate to human oversight. Clean pause/resume semantics and navigation guards prevent race conditions and cross-site execution hazards.

**Independent Test**: Can be independently tested by starting an automated session, triggering a pause mid-cycle, navigating to a new URL, clicking resume, and confirming that the agent alerts the user of URL divergence and requires explicit confirmation before proceeding.

**Acceptance Scenarios**:

1. **Given** an agent running a task, **When** the user clicks Pause, **Then** current in-flight actions cleanly settle or cancel, and the agent enters the Paused state without executing further actions.
2. **Given** an agent in Paused state, **When** the user clicks Resume, **Then** the agent discards any stale observation state and initiates a fresh observation cycle from step 1.
3. **Given** the agent is paused and the user navigates to an unrelated URL, **When** the user attempts to resume, **Then** the system detects the URL mismatch, displays a warning, and requires confirmation before resuming or restarting.
4. **Given** any task state, **When** the user clicks Stop/Abort, **Then** the agent immediately terminates the session, clears all active task state, and returns to Idle.

---

### Edge Cases

- What happens if the reasoning service returns an unparseable response, times out, or fails to respond?
  The system transitions to a paused error state, displays a clear error explanation to the user, and offers the option to retry the step or abort.
- What happens if the target element moves, scrolls out of view, or is deleted by dynamic page scripts between observation and execution?
  Target re-resolution on the live document detects the geometric/structural discrepancy and rejects the action before dispatching events, preventing misclicks.
- What happens if a web page triggers an unexpected popup, alert dialog, or new tab redirect?
  The agent detects the window/tab state transition, updates its current observation target, or pauses for user confirmation if the new target crosses external domains.
- What happens if the reasoning engine attempts to execute an action on a redacted region without prior human intervention?
  The validator detects that the target falls within a protected entity's bounding box and blocks the action, requesting human intervention.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST manage discrete task lifecycle states: `IDLE`, `OBSERVING`, `SANITIZING`, `AWAITING_REASONING`, `VALIDATING_ACTION`, `EXECUTING_ACTION`, `PAUSED`, `INTERVENTION_REQUIRED`, `COMPLETED`, and `FAILED`.
- **FR-002**: System MUST execute the strict sequential cycle: `Observe → Detect → Sanitize → Verify → Transmit → Reason → Validate → Execute → Repeat` for each autonomous step.
- **FR-003**: System MUST transmit sanitized structural page representations containing declared schema version `1.5.0` and active token vocabulary manifests to the reasoning planner.
- **FR-004**: System MUST allowlist only four atomic browser action types: `click`, `type`, `scroll`, and `navigate`. Any other proposed action MUST be rejected.
- **FR-005**: System MUST perform live DOM target re-resolution and geometric verification prior to dispatching any browser action to ensure the element exists, is visible, and matches expected dimensions.
- **FR-006**: System MUST suspend autonomous actions and transition to `INTERVENTION_REQUIRED` state whenever a task requires entering passwords, credentials, payment cards, or sensitive secrets.
- **FR-007**: System MUST completely suspend automated perception capture and network transmission while in `INTERVENTION_REQUIRED` state to avoid capturing sensitive user secrets.
- **FR-008**: System MUST restart the perception cycle from step 1 (`Observe`) upon resumption from `PAUSED` or `INTERVENTION_REQUIRED` state, discarding stale observation data.
- **FR-009**: System MUST verify the active page URL when resuming from `PAUSED` state; if the URL has changed, the system MUST require explicit user confirmation before executing any actions.
- **FR-010**: System MUST support instantaneous user abort/cancellation from any active state, returning safely to `IDLE`.
- **FR-011**: System MUST record step audit history including cycle ID, timestamp, sanitized representation summary, proposed action, validation verdict, and execution outcome.

### Key Entities

- **TaskSession**: Represents the overall user instruction, session configuration, current state, active URL, total cycles completed, and step history.
- **AgentAction**: Represents an atomic proposed interaction (`click`, `type`, `scroll`, `navigate`) with target selector, coordinates, text payload, and validation status.
- **ValidationResult**: The verdict produced by client-side action verification, containing pass/fail flag, confidence, and diagnostic reason.
- **InterventionContext**: Information regarding why human intervention was requested (e.g., secret type, target field description) and resumption trigger.
- **StepLogEntry**: Record of a single perception-reasoning-action cycle for auditing and visualization.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of actions proposed by the reasoning engine pass through client-side action validation before browser execution.
- **SC-002**: 0 unauthorized action primitives (non-allowlisted commands) or unverified target elements are permitted to execute on the live document.
- **SC-003**: Zero automated keystrokes or perception captures occur on credential or secret fields, achieving 100% compliance with Human-in-the-Loop secret protection.
- **SC-004**: Upon resume from pause or intervention, 100% of execution cycles perform a fresh page observation without reusing stale data.
- **SC-005**: Action validation and execution overhead adds less than 150ms to the total cycle time.
- **SC-006**: Users can pause, resume, or abort an active task session with instantaneous response (<100ms).

## Assumptions

- The underlying client-side PII redaction pipeline (`specs/001-client-pii-redaction`) provides verified DOM snapshots, manifests, and sanitized payloads.
- The external reasoning service accepts standard JSON payload envelopes adhering to Schema version `1.5.0` and responds with structured action commands.
- For testing and standalone execution, a local mock reasoning planner is available to simulate multi-turn task completion deterministically without requiring external API keys.
- Browser automation actions execute within the current active tab context via content script DOM event dispatching and standard browser navigation APIs.

# Tasks: Perception-Reasoning-Action Autonomous Loop & Agent Controller

**Feature**: Perception-Reasoning-Action Autonomous Loop (`002-perception-action-loop`)  
**Input**: Design artifacts from `/specs/002-perception-action-loop/`  
**Constitution**: Governed by [Constitution v1.5.0](file:///.specify/memory/constitution.md) (Articles XIII, XIV, XV, XVI)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Define common data structures, interfaces, and action types for the agent controller

- [X] T001 [P] Extend shared types with TaskState, AgentAction, TargetSelector, ValidationResult, HumanInterventionContext, StepLogEntry in src/common/types.ts
- [X] T002 [P] Define action constants, allowable action primitives (`click`, `type`, `scroll`, `navigate`), and error codes in src/common/constants.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core action validator, target element resolver, and planner client contracts that MUST be complete before ANY user story can begin

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete

- [X] T003 Implement live DOM target element resolver with geometric bounding box computation and visibility checks in src/content/target-resolver.ts
- [X] T004 [P] Implement unit tests for target resolver in tests/unit/content/target-resolver.test.ts
- [X] T005 Implement PlannerClient interface with MockPlannerClient and RemoteVlmPlannerClient in src/agent/planner-client.ts
- [X] T006 [P] Implement contract tests for planner client matching contracts/vlm-planner-contract.json in tests/unit/agent/planner-client.test.ts

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Autonomous Multi-Step Perception-Action Loop (Priority: P1) 🎯 MVP

**Goal**: Execute repeated `Observe → Detect → Sanitize → Verify → Transmit → Reason → Validate → Execute → Repeat` cycles to autonomous task completion.

**Independent Test**: Execute a multi-turn task with MockPlannerClient; verify state sequence and successful task completion.

### Tests for User Story 1 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T007 [P] [US1] Create unit tests for TaskSession state management in tests/unit/agent/task-session.test.ts
- [X] T008 [P] [US1] Create integration test for multi-step perception-action cycle in tests/integration/perception-action-loop.test.ts

### Implementation for User Story 1

- [X] T009 [US1] Implement TaskSession management and step history logging in src/agent/task-session.ts
- [X] T010 [US1] Implement live DOM action execution (click, type, scroll, navigate) in src/content/action-executor.ts
- [X] T011 [US1] Implement AgentController state machine executing the full perception-reasoning-action loop in src/agent/controller.ts
- [X] T012 [US1] Connect AgentController with background message listener and content script action executor in src/background/index.ts and src/content/index.ts

**Checkpoint**: At this point, User Story 1 (MVP) is fully functional and testable independently.

---

## Phase 4: User Story 2 - Strict Local Action Validation & Safety Allowlisting (Priority: P1)

**Goal**: Enforce local action allowlist (`click`, `type`, `scroll`, `navigate`), verify target existence/geometry on live DOM, and reject unauthorized actions fail-closed.

**Independent Test**: Pass disallowed action types and mismatched element coordinates to ActionValidator; verify immediate rejection without executing actions.

### Tests for User Story 2 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T013 [P] [US2] Create unit tests for action allowlisting and geometric verification in tests/unit/agent/action-validator.test.ts

### Implementation for User Story 2

- [X] T014 [US2] Implement ActionValidator enforcing allowlist, target re-resolution, and geometric tolerance checks in src/agent/action-validator.ts
- [X] T015 [US2] Integrate ActionValidator into AgentController loop before dispatching DOM actions in src/agent/controller.ts

**Checkpoint**: User Stories 1 AND 2 are complete. Untrusted planner actions cannot execute without strict client-side validation.

---

## Phase 5: User Story 3 - Human-in-the-Loop Secret & Credential Handling (Priority: P1)

**Goal**: Detect password/credential/secret fields; suspend autonomous execution and automated perception; prompt user to enter secret manually; take fresh observation on resume.

**Independent Test**: Propose typing into password field; verify controller transitions to `INTERVENTION_REQUIRED`, suspends perception, highlights input, and resumes with fresh capture.

### Tests for User Story 3 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T016 [P] [US3] Create integration tests for credential detection and human intervention lifecycle in tests/integration/human-intervention.test.ts

### Implementation for User Story 3

- [X] T017 [US3] Add sensitive credential detection to ActionValidator in src/agent/action-validator.ts
- [X] T018 [US3] Implement intervention overlay and DOM guidance in src/content/action-executor.ts
- [X] T019 [US3] Implement `INTERVENTION_REQUIRED` state handling, perception suspension, and fresh observation restart in src/agent/controller.ts

**Checkpoint**: User Stories 1, 2, and 3 are complete. 100% compliance with Constitution Article XIII (Zero autonomous secret entry).

---

## Phase 6: User Story 4 - Agent Control Lifecycle: Pause, Resume, Navigation Protection & Abort (Priority: P2)

**Goal**: Support user pause, resume, abort, and URL divergence confirmation when navigating while paused.

**Independent Test**: Pause task, mutate page URL, attempt resume; verify URL divergence warning requires explicit confirmation.

### Tests for User Story 4 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T020 [P] [US4] Create integration test for pause/resume lifecycle and navigation divergence detection in tests/integration/pause-resume-navigation.test.ts

### Implementation for User Story 4

- [X] T021 [US4] Implement pause/resume semantics with fresh observation restarts and URL mismatch detection in src/agent/controller.ts
- [X] T022 [US4] Update popup UI controller to expose Start, Pause, Resume, Abort controls and status badges in src/popup/index.ts and popup.html

---

## Phase 7: Polish & Verification

**Purpose**: System integration, end-to-end regression validation, and clean build

- [X] T023 Run full Vitest test suite (`npm test`) across all unit and integration tests
- [X] T024 Validate complete build output (`npx tsc --noEmit`)
- [X] T025 Update quickstart and documentation with verified run results

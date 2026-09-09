# Implementation Plan: Perception-Reasoning-Action Autonomous Loop & Agent Controller

**Branch**: `002-perception-action-loop` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-perception-action-loop/spec.md`

---

## Summary

Implement the autonomous execution engine and client-side agent controller for the browser agent prototype. This system manages the complete perception-reasoning-action loop: `Observe → Detect → Sanitize → Verify → Transmit → Reason → Validate → Execute → Repeat`. The controller integrates directly with the verified privacy pipeline (`001-client-pii-redaction`), transmits Schema `1.5.0` envelopes to the VLM reasoning planner, strictly validates proposed actions against an allowlist (`click`, `type`, `scroll`, `navigate`), re-resolves target elements geometrically on the live DOM, automatically triggers Human-in-the-Loop intervention for credential/secret handling (Constitution Article XIII), and enforces robust pause/resume lifecycle semantics with fresh observation restarts (Constitution Article XV).

---

## Technical Context

**Language/Version**: TypeScript 5.x / JavaScript ES2022+ (Web Standard APIs)  
**Primary Dependencies**: Zero external runtime dependencies. Development/Testing: `vitest`, `jsdom`, `@types/chrome`.  
**Storage**: `chrome.storage.local` for task state, audit history, and configuration preferences.  
**Testing**: `vitest` (unit tests, state machine tests, action validation tests, mock planner integration tests, human intervention flow tests).  
**Target Platform**: Browser Extension Manifest V3 (Chromium Service Worker & Content Scripts, Firefox MV3 compatible).  
**Project Type**: Browser Extension (Agent Controller in Background, Action Executor in Content Script, UI controls in Popup).  
**Performance Goals**:
- Local Action Validation Latency: <50ms per proposed action.
- Action Execution & DOM Dispatch: <100ms.
- State Transition & Lifecycle Overhead: <10ms.
- Instantaneous Pause / Stop Response: <100ms.
**Constraints**:
- Absolute Zero Autonomous Secret Typing: 0 automated keystrokes on password, PIN, OTP, or payment credential inputs.
- Action Allowlisting: Strict restriction to `click`, `type`, `scroll`, and `navigate`.
- Fail-Closed: Immediate abort if reasoning response is malformed, target cannot be resolved, or sensitive region is targeted without intervention.
- Fresh Observation on Resume: Old perception data must be completely discarded when resuming from pause or intervention.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate / Principle | Requirement | Plan Compliance Status |
| :--- | :--- | :--- |
| **Principle I: Zero Raw Data Transmission** | Never transmit unmasked pixels, plaintext PII, or raw voice. | **PASS** — Transmits only sanitized payloads verified by Feature 001 pipeline. |
| **Principle III: Concrete Sanitization & Server Awareness** | Declare schema version and token vocabulary manifest. | **PASS** — Envelopes sent to planner declare `schema_version: "1.5.0"` and token vocabulary manifest. |
| **Principle IV: Background Isolation** | Isolated background controller. | **PASS** — Agent Controller state machine runs in background service worker; DOM actions dispatched to content script. |
| **Principle V: Fail-Closed Protocol** | Halt session if verification or action validation fails. | **PASS** — Malformed action, missing element, or unverified target halts execution fail-closed. |
| **Principle XIII: Human-in-the-Loop Secret Handling** | Never autonomously enter secrets; pause perception; wait for user input. | **PASS** — Controller transitions to `INTERVENTION_REQUIRED`, suspends perception, and awaits manual user entry & explicit resume. |
| **Principle XIV: Browser Agent Architecture & Trust Boundaries** | Cloud planner is untrusted; validate all actions locally before execution. | **PASS** — Local Action Validator enforces allowlist, target existence, and structural/geometric verification. |
| **Principle XV: Perception-Reasoning-Action Loop** | Continuous 8-stage loop; clean pause; resume restarts with fresh observation. | **PASS** — State machine implements strict sequence and always restarts at Step 1 (`Observe`) on resume. |
| **Principle XVI: User Visibility & Agent Control** | User control over start, pause, resume, abort; URL mismatch confirmation. | **PASS** — Full lifecycle controls implemented with URL divergence check on resume. |

---

## Project Structure

### Documentation (this feature)

```text
specs/002-perception-action-loop/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── vlm-planner-contract.json
│   └── action-execution-protocol.md
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
src/
├── agent/
│   ├── controller.ts                # Agent Controller state machine & lifecycle coordinator
│   ├── action-validator.ts          # Action allowlisting, geometry verification & sensitive target checks
│   ├── planner-client.ts            # Schema v1.5.0 client interface with mock & remote planner support
│   └── task-session.ts              # Session state persistence, step history, and lifecycle transitions
├── content/
│   ├── action-executor.ts           # Live DOM event dispatcher (trusted click, type, scroll, navigate)
│   ├── target-resolver.ts           # Resolves element by selector/ID with geometric bounding box check
│   ├── dom-extractor.ts             # (From Feature 001) Captures structural DOM topology
│   ├── audit-overlay.ts             # (From Feature 001) Non-destructive visual indicator overlay
│   └── index.ts                     # Content script router handling EXECUTE_ACTION & INTERVENE
├── background/
│   ├── index.ts                     # MV3 background service worker integrating Controller
│   ├── offscreen-manager.ts         # Offscreen lifecycle
│   └── network-interceptor.ts       # Privacy gatekeeper
├── common/
│   ├── types.ts                     # Expanded types (TaskState, AgentAction, ValidationResult, etc.)
│   └── constants.ts                 # Action types, schema version, error codes
└── popup/
    └── index.ts                     # Popup UI logic with Start, Pause, Resume, Abort controls

tests/
├── unit/
│   ├── agent/
│   │   ├── action-validator.test.ts
│   │   ├── controller.test.ts
│   │   ├── planner-client.test.ts
│   │   └── task-session.test.ts
│   └── content/
│       ├── action-executor.test.ts
│       └── target-resolver.test.ts
└── integration/
    ├── perception-action-loop.test.ts
    ├── human-intervention.test.ts
    └── pause-resume-navigation.test.ts
```

---

## Phases

### Phase 0: Research
- State Machine design for multi-turn browser automation.
- DOM action dispatching & synthetic event fidelity across standard browsers.
- Real-time geometric element re-resolution and stability checking.
- Safe mock reasoning planner design for automated regression testing.

### Phase 1: Design & Contracts
- `data-model.md`: TaskSession, AgentAction, ValidationResult, HumanInterventionContext, StepLog.
- `contracts/vlm-planner-contract.json`: Formal JSON Schema for VLM reasoning request & action response.
- `contracts/action-execution-protocol.md`: Message contract between Background Controller and Content Script Executor.
- `quickstart.md`: Developer guide and automated test verification procedures.

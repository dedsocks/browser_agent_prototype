# Tasks: Client-Side PII Redaction Pipeline

**Feature**: Client-Side PII Redaction Pipeline (`001-client-pii-redaction`)  
**Input**: Design artifacts from `/specs/001-client-pii-redaction/`  
**Constitution**: Governed by [Constitution v1.5.0](file:///.specify/memory/constitution.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, Manifest V3 configuration, and testing framework setup

- [ ] T001 Initialize TypeScript project configuration and Manifest V3 extension structure in package.json and tsconfig.json
- [ ] T002 [P] Define WebExtension manifest configuration supporting Chromium chrome.offscreen and Firefox MV3 in manifest.json
- [ ] T003 [P] Configure Vitest test runner and JSDOM test environment in vitest.config.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data models, constants, and algorithmic building blocks that MUST be complete before ANY user story can begin

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete

- [ ] T004 [P] Define shared types, interfaces, and state models in src/common/types.ts per data-model.md
- [ ] T005 [P] Define semantic token constants and schema version header ("1.5.0") in src/common/constants.ts
- [ ] T006 Implement adversarial input normalizer (NFKC normalization, homoglyph mapping, zero-width stripping) in src/privacy/normalizer.ts
- [ ] T007 [P] Implement Luhn and Verhoeff checksum validation algorithms in src/privacy/checksums.ts
- [ ] T008 Implement unit tests for normalizer and checksums in tests/unit/normalizer.test.ts and tests/unit/checksums.test.ts

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Local Textual PII Detection & Structural Tokenization (Priority: P1) 🎯 MVP

**Goal**: Detect sensitive textual PII (financial, identity, contact, credentials) and replace with uniform semantic placeholder tokens in serialized payloads without altering the live DOM.

**Independent Test**: Render mock HTML forms containing payment cards, SSNs, and credentials; verify outbound payload tokenizes values to `<REDACTED_*>` while live DOM text and inputs remain completely untouched.

### Tests for User Story 1 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T009 [P] [US1] Create unit tests for regex engine and PII detection in tests/unit/regex-engine.test.ts
- [ ] T010 [P] [US1] Create contract test for serialized payload envelope against contracts/payload-schema.json in tests/contract/payload-serialization.test.ts
- [ ] T011 [P] [US1] Create live DOM integrity tests asserting unmutated input values and elements in tests/unit/dom-integrity.test.ts

### Implementation for User Story 1

- [ ] T012 [US1] Implement high-precision regex detection engine for cards, SSNs, PANs, emails, phones, and credentials in src/privacy/regex-engine.ts
- [ ] T013 [US1] Implement redaction manifest generator in src/privacy/manifest-builder.ts
- [ ] T014 [US1] Implement structural semantic tokenizer and serialization transformer in src/privacy/tokenizer.ts
- [ ] T015 [US1] Implement DOM extractor capturing non-sensitive DOM hierarchy and geometry in src/content/dom-extractor.ts

**Checkpoint**: At this point, User Story 1 (MVP) is fully functional and testable independently

---

## Phase 4: User Story 2 - Fail-Closed Halt & Pre-Transmission Verification (Priority: P1)

**Goal**: Verify zero-leakage before network transmission; immediately halt the task session and alert the user if verification fails or times out.

**Independent Test**: Inject synthetic unmasked PII and engine faults; verify network transmission is blocked, session emits `PRIVACY_ABORT`, and zero unverified bytes are transmitted.

### Tests for User Story 2 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T016 [P] [US2] Create integration test for fail-closed protocol and fault injection in tests/integration/fail-closed.test.ts

### Implementation for User Story 2

- [ ] T017 [US2] Implement pre-transmission zero-leakage scanner and manifest verifier in src/privacy/verifier.ts
- [ ] T018 [US2] Implement network transmission gatekeeper intercepting outbound requests in src/background/network-interceptor.ts
- [ ] T019 [US2] Implement background message router and fail-closed session abort handler in src/background/index.ts

**Checkpoint**: User Stories 1 AND 2 are complete. Outbound network transmission is strictly guarded by fail-closed verification.

---

## Phase 5: User Story 3 - Visual Redaction & VLM Contextual Blindness (Priority: P2)

**Goal**: Strip adjacent descriptive labels from the structural tree and apply opaque bounding box masking to visual identifiers.

**Independent Test**: Load page with "SSN:" label next to input and canvas/portrait image; verify label is scrubbed in serialized tree and visual bounding box is fully opaque.

### Tests for User Story 3 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T020 [P] [US3] Create unit test for adjacent label stripping in tests/unit/label-stripper.test.ts

### Implementation for User Story 3

- [ ] T021 [US3] Implement adjacent label identifier and scrubber (spatial proximity + ARIA associations) in src/privacy/label-stripper.ts
- [ ] T022 [US3] Integrate label scrubber into structural tokenizer in src/privacy/tokenizer.ts
- [ ] T023 [US3] Implement offscreen worker visual mask processor for canvas/opaque elements in src/background/offscreen-manager.ts

**Checkpoint**: VLM Contextual Blindness and visual redaction are active and testable independently.

---

## Phase 6: User Story 4 - Real-Time Non-Destructive Audit Overlay (Priority: P3)

**Goal**: Render real-time color-coded visual indicator overlays over protected DOM elements within a <50ms render budget.

**Independent Test**: Trigger scan on multi-input page; verify high-contrast overlay bounding boxes appear without layout shift and paint within <50ms.

### Tests for User Story 4 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T024 [P] [US4] Create unit and performance benchmark tests for overlay rendering in tests/unit/audit-overlay.test.ts

### Implementation for User Story 4

- [ ] T025 [US4] Implement non-destructive audit overlay manager in src/content/audit-overlay.ts
- [ ] T026 [US4] Implement throttled/coalesced requestAnimationFrame render loop in src/content/audit-overlay.ts
- [ ] T027 [US4] Wire content script message listener for overlay coordinates in src/content/index.ts

**Checkpoint**: All 4 user stories are independently functional and verified against requirements.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end integration validation, demographic parity benchmarks, and documentation alignment

- [ ] T028 [P] Create end-to-end integration test covering perception-action cycle per quickstart.md in tests/integration/full-pipeline.test.ts
- [ ] T029 Benchmark False Negative Rate (FNR) parity and precision/recall against synthetic test dataset in tests/unit/detection/benchmark.test.ts
- [ ] T030 [P] Verify documentation and schema conformance across contracts/ and specs/001-client-pii-redaction/

---

## Dependencies & Execution Order

### Phase Dependencies

```
[ Phase 1: Setup ]
       │
       ▼
[ Phase 2: Foundational ] (BLOCKS all User Stories)
       │
       ├──► [ Phase 3: User Story 1 (P1) 🎯 MVP ]
       │           │
       │           ▼
       ├──► [ Phase 4: User Story 2 (P1) Fail-Closed ]
       │           │
       │           ▼
       ├──► [ Phase 5: User Story 3 (P2) Contextual Blindness ]
       │           │
       │           ▼
       └──► [ Phase 6: User Story 4 (P3) Audit Overlay ]
                   │
                   ▼
       [ Phase 7: Polish & Benchmarks ]
```

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 (Foundational). Delivers MVP text PII detection and tokenization.
- **User Story 2 (P1)**: Depends on US1 tokenizer and manifest models. Implements fail-closed verifier and network gatekeeper.
- **User Story 3 (P2)**: Depends on US1 structural tree tokenizer. Adds adjacent label stripping and offscreen visual masking.
- **User Story 4 (P3)**: Depends on US1 DOM extractor bounds. Adds non-destructive audit overlay and <50ms paint loop.
- **Polish (Phase 7)**: Depends on completion of all desired user stories.

### Parallel Opportunities

- **Phase 1 (Setup)**: `T002` (manifest.json) and `T003` (vitest.config.ts) can execute in parallel.
- **Phase 2 (Foundational)**: `T004` (types.ts), `T005` (constants.ts), and `T007` (checksums.ts) can execute in parallel.
- **User Story 1 (Tests)**: `T009`, `T010`, and `T011` can be written in parallel.
- **Across Stories**: Once Phase 2 is complete, US1 and US2 foundation can be developed in tandem if multiple agents or developers collaborate.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup (`T001`–`T003`)
2. Complete Phase 2: Foundational (`T004`–`T008`)
3. Complete Phase 3: User Story 1 (`T009`–`T015`)
4. **STOP and VALIDATE**: Run `npx vitest run tests/unit/regex-engine.test.ts tests/contract/payload-serialization.test.ts` to prove independent functionality.

### Incremental Delivery
1. Foundation Ready: Setup + Foundational passed.
2. Increment 1 (MVP): Text detection + semantic tokenization verified.
3. Increment 2: Fail-closed network gatekeeper integrated; zero-leakage enforced.
4. Increment 3: VLM contextual blindness (adjacent label stripping) + visual masking enabled.
5. Increment 4: Real-time visual audit overlay rendered within <50ms budget.
6. Final: Full pipeline integration & demographic parity benchmark suites executed.

# Tasks: Local Vision Processing & Shadow DOM Privacy Engine

**Feature**: Local Vision Processing & Shadow DOM Privacy Engine (`004-local-vision-processing`)  
**Input**: Design artifacts from `/specs/004-local-vision-processing/`  
**Constitution**: Governed by [Constitution v1.5.0](file:///.specify/memory/constitution.md) (Articles II, IV, V)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions for visual execution tiers, process results, and shadow DOM nodes

- [ ] T001 [P] Define VisionTier, VisionProcessResult, and ShadowDomNodeInfo in src/common/types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Shadow DOM recursive extraction and visual mask validation

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete

- [ ] T002 Implement recursive Shadow DOM extractor in src/content/shadow-dom-extractor.ts
- [ ] T003 [P] Implement unit tests for Shadow DOM extractor in tests/unit/content/shadow-dom.test.ts

**Checkpoint**: Foundation ready

---

## Phase 3: User Story 1 - Shadow DOM Privacy Sanitization (Priority: P1) 🎯 MVP

**Goal**: Inspect and extract open/accessible shadow roots and include shadow inputs in privacy sanitization and target resolution.

### Implementation for User Story 1

- [ ] T004 [US1] Integrate shadow-dom-extractor into dom-extractor.ts and target-resolver.ts

---

## Phase 4: User Story 2 & 3 - Two-Tier Local Vision Processing with WebGPU, WASM Fallback & Masking (Priority: P1 & P2)

**Goal**: Execute local vision processing with WebGPU Tier 1, graceful degradation to WASM/CPU Tier 2, fail-closed termination on dual fault, and solid opaque canvas masking.

### Tests for User Story 2 & 3 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T005 [P] [US2] Create unit tests for two-tier vision engine and WebGPU -> WASM fallback in tests/unit/vision/vision-engine.test.ts
- [ ] T006 [P] [US3] Create unit tests for mask opacity verification in tests/unit/vision/mask-verification.test.ts
- [ ] T007 [P] [US2] Create integration test for opaque elements fail-closed fallback in tests/integration/opaque-elements-fallback.test.ts

### Implementation for User Story 2 & 3

- [ ] T008 [US2] Implement LocalVisionEngine with WebGPU and WASM execution tiers in src/vision/vision-engine.ts
- [ ] T009 [US3] Connect LocalVisionEngine with offscreen-manager.ts for canvas masking and validation

---

## Phase 5: Polish & Verification

- [ ] T010 Run full Vitest test suite (`npm test`)
- [ ] T011 Verify full build output (`npm run build`)

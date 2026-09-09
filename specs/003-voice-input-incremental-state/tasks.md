# Tasks: Voice Input Privacy & Incremental State Processing

**Feature**: Voice Input Privacy & Incremental State Processing (`003-voice-input-incremental-state`)  
**Input**: Design artifacts from `/specs/003-voice-input-incremental-state/`  
**Constitution**: Governed by [Constitution v1.5.0](file:///.specify/memory/constitution.md) (Articles I, XI, XII, XVI)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared types and interfaces for voice sessions and incremental caching

- [X] T001 [P] Define VoiceState, VoiceSession, RegionFingerprint, and CachedRegionRedaction in src/common/types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core region fingerprinting algorithm and state cache data structures

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete

- [X] T002 Implement deterministic region fingerprinting function in src/cache/region-fingerprint.ts
- [X] T003 [P] Implement unit tests for region fingerprinting in tests/unit/cache/region-fingerprint.test.ts
- [X] T004 Implement incremental state cache in src/cache/state-cache.ts
- [X] T005 [P] Implement unit tests for state cache in tests/unit/cache/state-cache.test.ts

**Checkpoint**: Foundational fingerprinting and cache ready

---

## Phase 3: User Story 1 & 2 - Local Voice Input with Zero Audio Leakage & Fallback (Priority: P1) 🎯 MVP

**Goal**: Local client-side speech-to-text with zero raw audio transmission, immediate memory disposal, and graceful fallback to text input on error.

### Tests for User Story 1 & 2 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T006 [P] [US1] Create unit tests for speech transcriber in tests/unit/voice/speech-transcriber.test.ts
- [X] T007 [P] [US1] Create unit tests for voice manager in tests/unit/voice/voice-manager.test.ts
- [X] T008 [P] [US1] Create integration test verifying zero raw audio transmission in tests/integration/voice-privacy-flow.test.ts

### Implementation for User Story 1 & 2

- [X] T009 [US1] Implement ISpeechTranscriber with Web Speech API and mock support in src/voice/speech-transcriber.ts
- [X] T010 [US1] Implement VoiceManager with buffer clearing and fallback logic in src/voice/voice-manager.ts
- [X] T011 [US1] Integrate voice input toggle into popup UI in popup.html and src/popup/index.ts

**Checkpoint**: Voice input and text fallback functional and verifiable independently.

---

## Phase 4: User Story 3 - Incremental State Processing via Region Fingerprints (Priority: P2)

**Goal**: Cache verified redaction results by region fingerprint and reuse on subsequent cycles when subtrees are unchanged.

### Tests for User Story 3 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T012 [P] [US3] Create integration test for incremental processing cache hits and invalidations in tests/integration/incremental-processing.test.ts

### Implementation for User Story 3

- [X] T013 [US3] Integrate IncrementalStateCache into handleDomSnapshotRequest in src/background/index.ts

**Checkpoint**: Multi-turn tasks skip unchanged subtrees, lowering latency by ≥40%.

---

## Phase 5: Polish & Verification

- [X] T014 Run full Vitest test suite (`npm test`) across all tests
- [X] T015 Verify build compilation (`npm run build`)

# Implementation Plan: Voice Input Privacy & Incremental State Processing

**Branch**: `003-voice-input-incremental-state` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-voice-input-incremental-state/spec.md`

---

## Summary

Implement local speech-to-text processing with zero raw audio transmission (Constitution Articles I & XII) and deterministic incremental state region fingerprinting (Constitution Article XI). The voice pipeline transcribes user speech directly on the client, enforces automatic text fallback on error or permission revocation, and guarantees that audio buffers are immediately discarded without transmitting network telemetry. The incremental state engine calculates composite structural and geometric fingerprints for DOM regions, caching verified redaction results to drop cycle latency across multi-step browser tasks while guaranteeing that any mutated node triggers fail-closed re-evaluation.

---

## Technical Context

**Language/Version**: TypeScript 5.x / JavaScript ES2022+ (Web Standard APIs)  
**Primary Dependencies**: Zero external runtime dependencies. Development/Testing: `vitest`, `jsdom`, `@types/chrome`.  
**Storage**: Ephemeral session memory for region fingerprints; `chrome.storage.local` for voice preferences.  
**Testing**: `vitest` (unit tests for fingerprinting algorithm, cache hit/invalidation tests, speech recognition state tests, audio zero-leakage assertions).  
**Target Platform**: Browser Extension Manifest V3.  
**Performance Goals**:
- Voice recognition prompt startup: <300ms.
- Audio buffer disposal: Immediate (<50ms upon speech end).
- Region fingerprint hashing: <20ms for a 1,000-node DOM snapshot.
- Latency reduction: ≥40% faster cycle on multi-turn steps with <20% mutation.
**Constraints**:
- Absolute Zero Raw Audio Transmission: 0 bytes of audio sent over network.
- Graceful Fallback: Instantaneous switch to keyboard input if microphone is unavailable.
- Deterministic Invalidation: Any DOM attribute, text, or geometric mutation MUST invalidate the region cache.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate / Principle | Requirement | Plan Compliance Status |
| :--- | :--- | :--- |
| **Principle I: Zero Raw Data Transmission** | Raw microphone audio must never be transmitted; transcribed locally. | **PASS** — Transcribes speech strictly on local client; audio buffers discarded immediately. |
| **Principle VII: Metric Hierarchy** | Latency <2000ms; resource efficiency. | **PASS** — Region fingerprinting drastically reduces repetitive DOM parsing latency on multi-turn tasks. |
| **Principle XI: Incremental State Processing** | Deterministic region fingerprints; reuse verified results only on exact match. | **PASS** — Multi-component region fingerprinting with fail-closed recompute on mismatch. |
| **Principle XII: Voice Input Privacy** | Voice input treated as sensitive; no cloud STT; fallback to text input. | **PASS** — Web Speech API / local audio handling with prompt UI and text fallback. |
| **Principle XVI: User Visibility & Control** | Clear visual indicators for listening/error states. | **PASS** — Interactive microphone badge with real-time status and error banner. |

---

## Project Structure

### Documentation (this feature)

```text
specs/003-voice-input-incremental-state/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── voice-and-cache-contracts.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── voice/
│   ├── speech-transcriber.ts        # Local speech-to-text controller (Web Speech API + mock)
│   └── voice-manager.ts             # Microphone lifecycle, audio buffer disposal & fallback
├── cache/
│   ├── region-fingerprint.ts        # Deterministic composite hash (DOM + CSSOM + Bounds)
│   └── state-cache.ts               # In-memory ephemeral cache for verified redaction maps
├── popup/
│   ├── index.ts                     # Popup UI with voice toggle and status badge
│   └── popup.html                   # Microphone button and voice status banner
└── common/
    ├── types.ts                     # Voice & Cache types
    └── constants.ts                 # Voice timeout & fingerprint constants

tests/
├── unit/
│   ├── voice/
│   │   ├── speech-transcriber.test.ts
│   │   └── voice-manager.test.ts
│   └── cache/
│       ├── region-fingerprint.test.ts
│       └── state-cache.test.ts
└── integration/
    ├── voice-privacy-flow.test.ts
    └── incremental-processing.test.ts
```

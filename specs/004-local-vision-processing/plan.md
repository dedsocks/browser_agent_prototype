# Implementation Plan: Local Vision Processing & Shadow DOM Privacy Engine

**Branch**: `004-local-vision-processing` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-local-vision-processing/spec.md`

---

## Summary

Implement local visual processing for opaque elements (HTML5 Canvas) and deep Shadow DOM recursive extraction (Constitution Article II, IV, and V). The vision pipeline provides a resilient two-tier execution engine: attempting hardware-accelerated WebGPU compute first (Tier 1), automatically degrading to WebAssembly (WASM/CPU) execution (Tier 2) upon WebGPU unavailability or device loss, and enforcing strict fail-closed session termination if both local runtimes fail. For visual components, solid opaque bounding box masking is applied directly to pixel buffers with automated opacity verification scanners before serialization. The DOM extractor is extended to traverse open and accessible shadow roots recursively so custom components are safely parsed and tokenized.

---

## Technical Context

**Language/Version**: TypeScript 5.x / JavaScript ES2022+ (Web Standard APIs)  
**Primary Dependencies**: Zero external runtime dependencies. Development/Testing: `vitest`, `jsdom`, `@types/chrome`.  
**Storage**: Ephemeral frame buffers in memory; offscreen canvas contexts.  
**Testing**: `vitest` (unit tests for WebGPU/WASM pipeline fallback, shadow DOM extraction, and visual mask opacity verification).  
**Target Platform**: Browser Extension Manifest V3 (`chrome.offscreen` for Chromium, background script for Firefox).  
**Performance Goals**:
- WebGPU to WASM fallback time: <50ms.
- Visual mask application: <30ms per canvas frame.
- Shadow DOM recursive traversal: <20ms for nested component hierarchies.
**Constraints**:
- Absolute Zero Raw Opaque Visual Transmission: 0 unmasked canvas pixels or uninspected opaque elements transmitted.
- Fail-Closed: Outbound transmission blocked if both WebGPU and WASM runtimes fail.
- 100% Solid Opacity: Visual bounding boxes must have alpha = 255 with zero bleed.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate / Principle | Requirement | Plan Compliance Status |
| :--- | :--- | :--- |
| **Principle I: Zero Raw Data Transmission** | Never transmit unmasked pixels. | **PASS** — Opaque canvas regions masked with solid black rectangles; opacity verified. |
| **Principle II: Local Vision Processing & Fallback** | Opaque elements processed locally (WebGPU -> WASM). | **PASS** — Two-tier engine executes WebGPU first, then degrades to WASM CPU; never clouds offload. |
| **Principle IV: Background Isolation** | Heavy vision processing in background/offscreen. | **PASS** — Offscreen manager coordinates visual processing. |
| **Principle V: Fail-Closed Protocol** | Halt session if local vision runtimes fail. | **PASS** — Immediate abort if both WebGPU and WASM runtimes are unavailable. |

---

## Project Structure

### Documentation (this feature)

```text
specs/004-local-vision-processing/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── vision-and-shadow-contracts.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── vision/
│   ├── vision-engine.ts             # Two-tier WebGPU -> WASM fallback vision engine
│   ├── webgpu-detector.ts           # WebGPU pipeline and compute abstraction
│   └── wasm-detector.ts             # WebAssembly CPU fallback detector
├── content/
│   ├── shadow-dom-extractor.ts      # Recursive open/closed Shadow DOM traversal
│   ├── dom-extractor.ts             # Enhanced with Shadow DOM support
│   └── target-resolver.ts           # Enhanced to resolve inside shadow roots
└── background/
    └── offscreen-manager.ts         # Visual mask rendering & opacity verification

tests/
├── unit/
│   ├── vision/
│   │   ├── vision-engine.test.ts
│   │   └── mask-verification.test.ts
│   └── content/
│       └── shadow-dom.test.ts
└── integration/
    └── opaque-elements-fallback.test.ts
```

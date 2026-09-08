# Implementation Plan: Client-Side PII Redaction Pipeline

**Branch**: `001-client-pii-redaction` | **Date**: 2026-09-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-client-pii-redaction/spec.md`

---

## Summary

Implement the client-side privacy boundary for the browser agent prototype. The pipeline operates entirely locally within the browser extension to intercept DOM state, perform adversarial normalization, execute high-precision regex and checksum algorithms (Luhn, Verhoeff) to detect sensitive textual and visual PII, scrub adjacent identifying labels, replace sensitive data with fixed semantic tokens (`<REDACTED_FINANCIAL>`, `<REDACTED_IDENTITY>`, `<REDACTED_CONTACT>`, `<REDACTED_CREDENTIAL>`), and verify zero-leakage before network serialization under a strict fail-closed protocol. Real-time non-destructive audit overlays communicate protection status to the user within a <50ms frame budget.

---

## Technical Context

**Language/Version**: TypeScript 5.x / JavaScript ES2022+ (Web Standard APIs)  
**Primary Dependencies**: None for runtime core (zero-dependency for maximum execution speed, security, and low footprint). Development/Testing: `vitest`, `jsdom`, `@types/chrome`.  
**Storage**: Ephemeral in-memory per perception cycle; `chrome.storage.local` for extension configuration and user preferences.  
**Testing**: `vitest` (unit tests, contract tests against JSON Schema, and synthetic fault-injection suites).  
**Target Platform**: Browser Extension Manifest V3 (Chromium with `chrome.offscreen`, Firefox MV3 with background script polyfill).  
**Project Type**: Browser Extension (Content Scripts, Background Service Worker, Offscreen Document).  
**Performance Goals**:
- PII Redaction Pipeline Latency: <500ms per cycle (comfortably within total 2000ms perception-action cycle).
- Live DOM Audit Overlay Paint Time: <50ms.
- Precision & Recall: ≥95% across all benchmarked PII categories.
**Constraints**:
- Absolute Zero Raw Data Transmission: 0% plaintext PII or unmasked raw pixels in outbound network requests.
- Non-Destructive DOM: Live webpage DOM nodes, user inputs, and layouts must never be altered by sanitization.
- Fail-Closed: Outbound transmission blocked and session aborted if verification fails or times out.
**Scale/Scope**: Real-time evaluation across diverse web forms, single-page apps (SPAs), checkout flows, and complex nested DOM trees.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate / Principle | Requirement | Plan Compliance Status |
| :--- | :--- | :--- |
| **Principle I: Zero Raw Data Transmission** | Never transmit unmasked pixels, plaintext PII, or raw voice. | **PASS** — Serialized payload replaces sensitive text with tokens; verification scanner asserts 0 raw matches. |
| **Principle II: Local Vision Processing & Fallback** | Opaque elements processed locally (WebGPU -> WASM). | **PASS** — Offscreen document houses local vision routines; zero opaque pixels transmitted raw. |
| **Principle III: Concrete Sanitization & Server Awareness** | Solid bounding boxes, fixed semantic tokens, `schema_version` header. | **PASS** — Token manifest and version `1.5.0` header declared; DOM untouched. |
| **Principle IV: Background Isolation** | Heavy compute isolated in background/offscreen contexts. | **PASS** — Processing executed in `chrome.offscreen` / background service worker. |
| **Principle V: Fail-Closed Protocol** | Halt session and alert user upon verification failure. | **PASS** — Pre-transmission verification gate drops unverified payloads and emits `PRIVACY_ABORT`. |
| **Principle VI: Bias Mitigation & Robustness** | Adversarial input normalization and demographic parity. | **PASS** — Normalization layer handles homoglyphs/zero-width evasion; test suites audit demographic splits. |
| **Principle VII: Metric Hierarchy** | Redaction Accuracy (≥95%) > Latency (<2000ms) > Resources. | **PASS** — Algorithmic checksums guarantee high precision/recall; fast execution (<500ms). |
| **Principle VIII: VLM Contextual Blindness** | Strip adjacent identifying labels (SSN, Card Number). | **PASS** — Label stripper identifies and masks associated labels/placeholders/ARIA descriptors. |
| **Principle IX: Real-Time Auditability** | Visual overlay indicating protected areas (<50ms budget). | **PASS** — Content script renders non-destructive overlay container via coalesced `requestAnimationFrame`. |
| **Principle X: Comprehensive Dynamic PII Scope** | Core + Extended PII scopes covered. | **PASS** — Payment cards (Luhn), national IDs (SSN, PAN, Aadhaar Verhoeff), emails, phones, credentials. |

---

## Project Structure

### Documentation (this feature)

```text
specs/001-client-pii-redaction/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── payload-schema.json
│   └── internal-messaging.md
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
src/
├── background/
│   ├── index.ts                     # MV3 background service worker
│   ├── offscreen-manager.ts         # Offscreen document lifecycle & message routing
│   └── network-interceptor.ts       # Gatekeeper enforcing pre-transmission verification
├── privacy/
│   ├── normalizer.ts                # NFKC normalization, homoglyph & evasion defense
│   ├── regex-engine.ts              # High-precision pattern matching (cards, IDs, contact)
│   ├── checksums.ts                 # Luhn & Verhoeff checksum algorithms
│   ├── label-stripper.ts            # VLM Contextual Blindness adjacent label scrubber
│   ├── tokenizer.ts                 # Structural semantic token replacer (<REDACTED_*>)
│   ├── manifest-builder.ts          # Generates and tracks RedactionManifest
│   └── verifier.ts                  # Fail-closed zero-leakage pre-transmission gate
├── content/
│   ├── dom-extractor.ts             # Captures structural DOM topology & bounding boxes
│   ├── audit-overlay.ts             # Non-destructive <50ms visual indicator overlay
│   └── index.ts                     # Content script entrypoint
└── common/
    ├── types.ts                     # Shared interfaces & data models
    └── constants.ts                 # Semantic token definitions & schema version (1.5.0)

tests/
├── unit/
│   ├── normalizer.test.ts
│   ├── checksums.test.ts
│   ├── regex-engine.test.ts
│   ├── label-stripper.test.ts
│   ├── verifier.test.ts
│   └── audit-overlay.test.ts
├── contract/
│   └── payload-serialization.test.ts
└── integration/
    ├── fail-closed.test.ts
    └── full-pipeline.test.ts
```

**Structure Decision**: Browser extension multi-context layout separating Content Scripts (DOM extraction, audit UI), Privacy Engine (normalization, regex, checksums, tokenization, verification), and Background Service Worker (offscreen lifecycle, network transmission gatekeeper).

---

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations. All architectural patterns strictly adhere to Constitution v1.5.0 principles.*

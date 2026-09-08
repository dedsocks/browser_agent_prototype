<!--
Sync Impact Report
- Version change: v1.1.0 -> v1.2.0
- Modified principles:
  - III. Concrete Sanitization Schema & Structural Tokens — clarified that
    fixed-length placeholder tokens apply ONLY to serialized network payloads,
    not to live DOM rendering; separated visual (overlay) from serialized
    (token) redaction surfaces
  - V. Fail-Closed Protocol — removed undefined HMAC requirement; specified
    that manifest integrity is enforced by construction within the trusted
    background/offscreen context (Article IV); added escape-hatch clause for
    future architectures requiring cross-context transmission with explicit
    crypto.subtle signing requirement if that boundary is ever needed
  - VII. Metric Hierarchy & Evaluation Trade-offs — reduced Tier 2 (WASM)
    latency ceiling from 5000ms to 3000ms; made Extended Scope optional/
    degradable on Tier 2 with user-facing "reduced coverage" indicator when
    skipped, rather than silent budget violation
- Added sections:
  - None (existing sections amended in place)
- Removed sections:
  - None
- Follow-up TODOs:
  - Team to validate that manifest construction/consumption stays entirely
    within the trusted background/offscreen context before merging Article V
  - Team to implement and test "reduced coverage" overlay indicator for when
    Extended Scope is skipped on Tier 2 (Article VII, IX)
  - Team to profile WASM-only PII detection on target fallback hardware to
    confirm 3000ms budget is achievable for Core Scope
-->

# Browser Agent Prototype Constitution

## Core Principles

### I. Zero Raw Data Transmission
The extension MUST NEVER serialize or transmit unmasked pixel data or plaintext Personally Identifiable Information (PII) to the backend. Structural DOM tags, ARIA roles, and non-sensitive layout coordinates are permitted for transmission ONLY after passing the same sanitization pipeline as visible text — ARIA labels, `title` attributes, `alt` text, and other accessibility metadata frequently contain free-text user data (e.g., `aria-label="Delete John's payment method"`) and MUST be scrubbed or tokenized before serialization, not transmitted as-is.
*Rationale*: Absolute client-side data privacy is the primary directive. Structural mapping is necessary for the VLM to function, but "structural" does not mean "unexamined" — accessibility metadata is a common overlooked leak path and must go through the same gate as visible content.

### II. Local Vision Processing & Fallback
Opaque elements (such as Shadow DOM subtrees and HTML5 Canvas components) MUST be processed entirely on the local client device. The local inference engine MUST attempt WebGPU execution first, with a mandatory graceful degradation to WebAssembly (WASM/XNNPACK) CPU execution for older hardware, constrained environments, or unsupported browsers.
*Rationale*: Opaque elements cannot be inspected via standard DOM queries and must not be transmitted raw. Local hardware acceleration ensures interactive performance while WASM ensures universal browser compatibility.

### III. Concrete Sanitization Schema & Structural Tokens
Redaction MUST be structural and concrete and MUST NOT destructively modify the live DOM. Visual PII MUST be obfuscated using solid opaque bounding boxes rendered as a non-destructive overlay (see Article IX) directly on top of the live DOM — the underlying element's text content, HTML structure, and layout box MUST NOT be altered in the rendered page. Textual PII MUST be replaced with strict semantic placeholder tokens (e.g., `<REDACTED_FINANCIAL>`, `<REDACTED_IDENTITY>`) ONLY within the serialized network payload sent to the backend, using fixed, category-based lengths to prevent length-based inference of the underlying value. These tokens MUST NEVER be written back into the live DOM or any user-facing rendering context.
*Rationale*: Separating "what the user sees" (a non-destructive overlay, layout-preserving) from "what the backend receives" (a tokenized payload) avoids both visual disruption and length-based side-channel leakage, without conflating the two redaction surfaces.

### IV. Cross-Browser Background Execution Isolation
Heavy visual DOM processing, feature extraction, and local neural inference MUST execute within an isolated background execution context (`chrome.offscreen` in Chromium MV3; background scripts or hidden window polyfills in Firefox MV3). On Firefox, where no `chrome.offscreen` equivalent exists, implementations MUST additionally verify that heavy inference does not block the extension's own message-routing loop — page-thread isolation alone is insufficient if the background script's event loop stalls, since this would delay the Fail-Closed Protocol (Article V) and Real-Time Auditability overlay (Article IX) equally.
*Rationale*: Offloading compute-heavy vision and redaction models prevents main-thread starvation, eliminates UI jitter, and complies with browser MV3 extension execution constraints. Firefox's architecture requires an explicit responsiveness check that Chrome's offscreen API provides implicitly.

### V. Fail-Closed Protocol
If the local inference engine fails on both WebGPU and WASM runtimes, or fails to produce a verified redaction map, the agent MUST immediately halt the current task session and alert the user. Verification takes the form of a redaction manifest (listing each redacted region/field, its category, and a completion flag), constructed and consumed entirely within the trusted background/offscreen execution context defined in Article IV, without passing through the content script or any page-adjacent context. Given this closed trust boundary, manifest integrity MUST be enforced by construction — the network call module MUST only accept manifest objects produced by the inference module's completion callback within the same execution context, with no serialization/deserialization step that would expose the manifest to interception by a page script.

IF a future architecture requires the manifest or the sanitized payload to cross into a less-trusted context (e.g., relayed through a content script or a third-party service), that build MUST instead sign the manifest using the Web Cryptography API (`crypto.subtle`) with a non-extractable, session-scoped key generated inside the background/offscreen context and never exposed to the content script; the signing scheme and key rotation policy must be documented before that architecture is implemented.

Under no circumstances may the system fall back to transmitting unverified or raw data.
*Rationale*: Cryptographic signing defends against tampering across a trust boundary. The current architecture (Article IV) keeps manifest creation and consumption inside a single trusted context, so integrity is enforced by execution-context isolation rather than cryptography, avoiding an unnecessary key-management attack surface. The escape hatch is specified in case the architecture evolves to require cross-context transmission.

### VI. Bias Mitigation & Adversarial Robustness
The local redaction pipeline MUST incorporate structural robustness interventions (e.g., input normalization, adversarial noise defense). PII detection models MUST be benchmarked to guarantee statistical parity in False Negative Rates (FNR) across diverse demographic markers (e.g., across the Fitzpatrick skin type scale for visual face detection). Benchmark datasets MUST include a real-world-sourced validation subset with documented, lawful consent for use in bias testing — synthetic data alone is INSUFFICIENT to claim demographic parity, as it may not reflect real-world detection failure modes.
*Rationale*: Privacy protection must be egalitarian. Disparities in redaction accuracy across demographic lines constitute critical safety flaws, and unvalidated synthetic-only benchmarks risk overstating fairness guarantees.

### VII. Metric Hierarchy & Evaluation Trade-offs
When engineering decisions require balancing competing objectives, teams and agents MUST strictly adhere to the following priority hierarchy:
1. **Redaction Precision and Recall** (non-negotiable minimum threshold: ≥95%)
2. **End-to-End Latency** (budget below, tiered by execution path)
3. **Client-Side Resource Utilization** (CPU, memory, GPU allocation)

Latency budget applies per single perception-action cycle, defined as: one DOM/visual snapshot in → one sanitized payload out → one returned action. Multi-step agent tasks consist of multiple such cycles and are not subject to a single aggregate budget.
- **Tier 1 (WebGPU path)**: < 2000ms per cycle, full Core + Extended PII scope.
- **Tier 2 (WASM fallback path)**: < 3000ms per cycle, Core Scope only by default. Extended Scope detection MAY run on Tier 2 ONLY if it does not push the cycle past 3000ms total; if Extended Scope would exceed the budget, it MUST be SKIPPED for that cycle, and the user-facing overlay (Article IX) MUST visibly indicate "reduced coverage" for that action. The ≥95% precision/recall floor applies to whichever scope is actually run.

*Rationale*: A 5-second latency ceiling compounds into unusable multi-step workflows. Trading Extended Scope for speed under weak hardware — visibly, not silently — keeps the agent usable end-to-end while being honest about reduced protection rather than quietly violating the latency budget.

### VIII. VLM Contextual Blindness
The redaction pipeline MUST strip adjacent identifying labels (e.g., masking the "SSN:" or "Card Number:" text alongside the respective input field) and rely primarily on structural layout and sanitized ARIA attributes. Label identification MUST use a maintained denylist of known-sensitive label patterns (e.g., "SSN", "CVV", "password", "card number", "DOB") combined with a semantic classifier confidence threshold for novel/localized labels; labels below the confidence threshold default to REDACTED, not passed through, per the Fail-Closed principle (Article V).
*Rationale*: Advanced VLMs can infer high-probability sensitive payloads from neighboring label context even when the value field itself is redacted. A concrete denylist-plus-classifier mechanism, defaulting closed on ambiguity, makes this article implementable and auditable rather than left to implementer judgment.

### IX. Real-Time Local Auditability & Render Budget
The client extension MUST render real-time DOM overlays (e.g., colored bounding boxes and status indicators) that visually reflect sanitized elements directly to the user. Each individual overlay update MUST execute within a strict render budget of <50ms to prevent main-thread UI freezing. On high-mutation-rate pages (e.g., live-updating SPAs), overlay updates MUST be debounced/throttled to a maximum of one batched update per 100ms, rather than firing per individual DOM mutation, to keep cumulative overlay work within budget without disabling auditability. The overlay MUST also display real-time status indicators including "reduced coverage" warnings when Extended Scope is skipped due to Tier 2 latency constraints (Article VII).
*Rationale*: User trust requires visible auditability, but transparency must not compromise responsive web interaction, and an undebounced overlay on a fast-mutating page could itself become a performance liability. Clear coverage-status indicators prevent silent degradation of privacy protection and keep the user informed of capability trade-offs.

### X. Comprehensive Dynamic PII Scope
The privacy filter MUST combine high-precision regex matching with local semantic classification models to detect and redact PII across two tiers:
- **Core Scope (MUST, always active)**: human faces, password/credential fields, email addresses, global payment cards (15–19 digits, major networks).
- **Extended Scope (MUST on Tier 1; optional/degradable on Tier 2 per Article VII)**: government-issued identification numbers (SSN, PAN, Aadhaar, and equivalents), phone numbers, and other locale-specific identifiers.

On the WASM fallback path (Article VII, Tier 2), Extended Scope detection MAY run as a secondary pass after Core Scope, provided the combined cycle still meets the Tier 2 latency budget and the ≥95% precision/recall floor for both tiers. If Extended Scope would cause a Tier 2 cycle to exceed 3000ms, Extended Scope MUST be skipped and the user must be notified via the overlay (Article IX).
*Rationale*: Standardizes baseline coverage across international identifier formats and multi-modal (visual + textual) data representations. Tier 2 degradation is explicit and user-visible, not a silent compromise of privacy.

## Performance Budgets & System Constraints

- **Redaction Accuracy**: Precision ≥ 95% and Recall ≥ 95% across all active PII categories (Core always; Extended where it runs).
- **Cycle Latency**: Tier 1 (WebGPU) < 2000ms; Tier 2 (WASM fallback) < 3000ms with Core Scope, or < 3000ms total (Core + Extended combined) if Extended Scope is included, per single perception-action cycle.
- **DOM Overlay Budget**: < 50ms per individual update; batched to ≤1 update per 100ms on high-mutation pages.
- **Hardware Acceleration Path**: Primary: WebGPU; Secondary Fallback: WebAssembly (WASM with XNNPACK).
- **Supported Extension Targets**: Chromium Manifest V3 (`chrome.offscreen` API) and Firefox Manifest V3 (background scripts / polyfilled hidden document contexts, with explicit message-routing responsiveness verification per Article IV).

## Development Workflow & Quality Gates

1. **Pre-Transmission Serialization Gates**: Automated unit and integration tests MUST assert that no serialized network request payload contains raw base64/binary image buffers, unmasked PII strings, unscrubbed ARIA/accessibility metadata, or unredacted placeholder tokens with original PII values.
2. **DOM Integrity Gates**: Tests MUST verify that no redaction process modifies the live DOM's text content, HTML structure, or layout boxes; redaction MUST be overlay-only or payload-only, never both.
3. **Adversarial & Demographic Parity Auditing**: Local vision and text redaction models MUST pass automated evaluation suites testing false negative rates across diverse synthetic AND real-world-sourced (consented) data and demographic distributions.
4. **Fail-Closed Failure Injection**: Integration suites MUST include fault injection tests simulating WebGPU and WASM crashes, and manifest-construction failures, to verify that the agent halts the task session and alerts the user rather than leaking state. Tests MUST verify that manifest construction and consumption never leave the trusted background/offscreen context.
5. **Main Thread Non-Blocking Verification**: Profiling benchmarks MUST verify that offscreen visual inference does not block main-thread UI interactions beyond the 50ms overlay rendering budget, and (Firefox) that background-script message routing remains responsive during inference.
6. **Tiered Latency Verification**: Profiling benchmarks MUST separately verify Tier 1 (WebGPU, full scope) and Tier 2 (WASM, Core-only and Core+Extended) latency budgets on representative hardware for each tier. Tier 2 must be tested on actual fallback-class hardware, not just a CPU-only build on modern machines.
7. **Scope Degradation Testing**: Tests MUST verify that when Extended Scope is skipped on Tier 2, the user-facing "reduced coverage" indicator is displayed and the cycle latency remains under 3000ms. Tests MUST measure end-to-end latency of multi-step tasks to confirm that Tier 2 degradation does not become unusably slow in realistic workflows.

## Governance

This Constitution represents the supreme operational and architectural contract for the browser agent prototype. All features, tasks, models, and code changes MUST comply with the rules established herein.
- **Supremacy**: In any conflict between performance optimization and privacy directives, the privacy directives take absolute precedence.
- **Amendment Process**: Amendments to this constitution require documentation of the proposed changes, justification under the metric hierarchy, verification of zero-leakage compliance, and a semantic version bump.
- **Semantic Versioning**:
  - *MAJOR*: Incompatible governance alterations, changes to core privacy directives, or modifications to the metric hierarchy.
  - *MINOR*: Additions of new principles, structural sections, expanded PII scope, or changes to latency budgets.
  - *PATCH*: Clarifications, wording refinements, or non-semantic formatting corrections.
- **Compliance Audits**: Pull requests and autonomous code generations MUST be audited against these principles before merging or task completion.

**Version**: 1.2.0 | **Ratified**: 2026-09-08 | **Last Amended**: 2026-09-08
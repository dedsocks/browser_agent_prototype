<!--
Sync Impact Report
- Version change: v1.4.0 -> v1.5.0
- Modified principles:
  - III. Concrete Sanitization Schema, Structural Tokens & Server Awareness — added a mandatory structured payload metadata header (`schema_version`, token vocabulary manifest) guaranteeing server-side redaction awareness and alignment.
  - VII. Metric Hierarchy & Evaluation Trade-offs — incorporated Structural Mapping Accuracy (satisfying the hackathon's 25% evaluation weighting) directly into Tier 1 priority alongside PII Redaction Precision and Recall.
- Added sections:
  - None (existing sections amended in place)
- Removed sections:
  - None
- Follow-up TODOs:
  - Define the formal JSON schema contract for the server-side VLM payload metadata header in the API specification.
-->

# Browser Agent Prototype Constitution

## Core Principles

### I. Zero Raw Data Transmission

The extension MUST NEVER serialize or transmit unmasked pixel data, raw audio containing user speech, or plaintext Personally Identifiable Information (PII) to the backend or any cloud service.

Structural DOM tags, ARIA roles, and non-sensitive layout coordinates are permitted for transmission ONLY after passing the same sanitization pipeline as visible text. ARIA labels, `title` attributes, `alt` text, and other accessibility metadata frequently contain free-text user data and MUST be scrubbed or tokenized before serialization, not transmitted as-is.

Voice input MUST be treated as potentially sensitive visual-equivalent user data. Raw microphone audio MUST NOT be transmitted to cloud speech-to-text or reasoning services. Speech transcription MUST occur locally before any resulting instruction is processed by the agent.

The resulting transcription MUST pass through the same privacy and task-input controls as typed user instructions. Voice input MUST NOT create a bypass around the privacy boundary.

Raw audio MUST be discarded immediately after local transcription unless it is explicitly required for a user-visible local function.

**Rationale**: The extension's primary security property is that private browser state and private user input never cross the local privacy boundary in raw form. This includes information originating from the microphone, not only information originating from the webpage.

---

### II. Local Vision Processing & Fallback

Opaque elements such as Shadow DOM subtrees and HTML5 Canvas components MUST be processed entirely on the local client device.

The local inference engine MUST attempt WebGPU execution first, with a mandatory graceful degradation to WebAssembly (WASM/XNNPACK) CPU execution for older hardware, constrained environments, or unsupported browsers.

No opaque visual content may be transmitted to a cloud service merely because the local vision pipeline cannot directly inspect it through standard DOM APIs.

**Rationale**: Opaque browser content must remain inside the trusted local processing boundary. Hardware acceleration improves responsiveness while WASM provides a compatibility fallback.

---

### III. Concrete Sanitization Schema, Structural Tokens & Server Awareness

Redaction MUST be structural and concrete and MUST NOT destructively modify the live DOM.

Visual PII MUST be obfuscated using solid opaque bounding boxes rendered as a non-destructive overlay directly on top of the live DOM. The underlying element's text content, HTML structure, and layout box MUST NOT be altered.

Textual PII MUST be replaced with strict semantic placeholder tokens such as `<REDACTED_FINANCIAL>` or `<REDACTED_IDENTITY>` ONLY within the serialized network payload sent to the backend. Placeholder tokens MUST use fixed, category-based representations that prevent length-based inference of the underlying value. These tokens MUST NEVER be written back into the live DOM or any user-facing rendering context.

**Server-Side Redaction Awareness Protocol**: Every serialized payload transmitted to the cloud reasoning service MUST contain a standardized metadata header declaring the active `schema_version` (e.g., `1.5.0`) and an enumerated manifest of token types used in that transmission. The server-side VLM prompt and ingestion pipeline MUST be configured to ingest this header, ensuring the model understands the semantic meaning of each placeholder without attempting to guess or reconstruct hidden content.

Every perception-action cycle MUST independently pass through the sanitization and verification pipeline before network transmission. A previously sanitized state MUST NOT automatically be considered safe for a later cycle unless the requirements of Article XI are satisfied.

**Rationale**: The system maintains two distinct redaction surfaces. Establishing an explicit payload schema contract ensures the centralized VLM interprets masked elements correctly to generate valid UI automation commands.

---

### IV. Cross-Browser Background Execution Isolation

Heavy visual DOM processing, feature extraction, local neural inference, sanitization, manifest generation, and speech-to-text processing MUST execute within an isolated background execution context.

Chromium MV3 implementations SHOULD use `chrome.offscreen` where appropriate. Firefox MV3 implementations MAY use background scripts or hidden document polyfills where required. On Firefox, implementations MUST additionally verify that heavy inference does not block the extension's message-routing loop.

The architecture MUST maintain a logical separation between:
1. **Agent Controller** — manages task state, user instructions, agent actions, intervention, and lifecycle.
2. **Privacy Boundary** — performs local observation sanitization, PII detection, redaction verification, and fail-closed enforcement.
3. **User Interface** — provides text/voice input, status, audit overlays, warnings, and human intervention controls.

The cloud reasoning service MUST NOT be treated as a replacement for any of these local responsibilities.

**Rationale**: Browser-agent execution, privacy enforcement, and UI responsiveness have different security and performance requirements and must not become one uncontrolled execution path.

---

### V. Fail-Closed Protocol

If the local inference engine fails on both WebGPU and WASM runtimes, or fails to produce a verified redaction map, the agent MUST immediately halt the current automated task session and alert the user.

Verification MUST use a redaction manifest listing each redacted region or field, its category, and its completion/verification state. The redaction manifest MUST be constructed and consumed entirely within the trusted background/offscreen execution context whenever the current architecture permits this.

The network transmission layer MUST accept sanitized payloads only after successful completion of the local privacy verification process. If a future architecture requires the manifest or sanitized payload to cross into a less-trusted execution context, that architecture MUST introduce an appropriate integrity mechanism (`crypto.subtle`) and MUST undergo explicit security review and constitutional amendment before implementation.

Under no circumstances may the system fall back to transmitting unverified or raw data.

**Rationale**: Privacy verification is a prerequisite for network transmission, not a best-effort feature. Architectural changes that introduce new trust boundaries require explicit security review rather than silently weakening the existing model.

---

### VI. Bias Mitigation & Adversarial Robustness

The local redaction pipeline MUST incorporate structural robustness interventions such as input normalization and adversarial noise defense.

PII detection models MUST be benchmarked to evaluate False Negative Rates (FNR) across diverse demographic distributions, including relevant visual diversity such as Fitzpatrick skin types for face detection. Benchmark datasets MUST include a real-world-sourced validation subset with documented, lawful consent for use in bias testing. Synthetic data alone is INSUFFICIENT to claim real-world demographic robustness.

**Rationale**: A privacy system that systematically fails to detect sensitive information for particular groups is itself a privacy failure.

---

### VII. Metric Hierarchy & Evaluation Trade-offs

When engineering decisions require balancing competing objectives, teams and agents MUST adhere to the following priority hierarchy, aligned with hackathon evaluation weights:

1. **Structural Context Accuracy & Redaction Precision/Recall**
   * Structural Mapping Accuracy (eval weight: 25%): Non-sensitive DOM hierarchy, element coordinates, and layout representation MUST achieve high fidelity so the VLM can successfully navigate and interact.
   * PII Detection Recall & Precision (eval weight: 20%): Minimum target ≥95% across active categories.
   * Redaction Precision (eval weight: 20%): Minimum target ≥95% (zero bleed, non-destructive bounding box accuracy).
2. **End-to-End Latency** (eval weight: 15%)
   * Tier 1 (WebGPU): <2000ms per perception-action cycle (Full Core + Extended Scope).
   * Tier 2 (WASM fallback): <3000ms per perception-action cycle (Core Scope mandatory; Extended Scope degradable).
3. **Client-Side Resource Utilization** (eval weight: 20%)
   * CPU, memory, and GPU consumption MUST be profiled to maintain main-thread UI fluidity and prevent memory exhaustion during long-horizon tasks.

**Rationale**: Speed and resource utilization cannot be purchased at the expense of privacy accuracy or structural mapping validity. Aligning the hierarchy directly with evaluation weights ensures maximum scoring potential during evaluation.

---

### VIII. VLM Contextual Blindness

The redaction pipeline MUST strip adjacent identifying labels such as:
* SSN
* Card Number / CVV
* Password
* Date of Birth
* Account Number
* Government IDs (Aadhaar, PAN, etc.)
* Other locale-specific sensitive identifiers

The system MUST consider contextual information surrounding a sensitive field, not merely the field's value. Label identification MUST use a maintained denylist of known-sensitive patterns combined with a semantic classifier for novel or localized labels. Labels or contextual regions below the required confidence threshold MUST default to REDACTED rather than being transmitted.

**Rationale**: A VLM may reconstruct the meaning of a hidden value from nearby labels or contextual information. Protecting the value while exposing its identifying context is insufficient.

---

### IX. Real-Time Local Auditability

The extension MUST provide local auditability that allows the user to understand what information the privacy boundary is protecting.

The UI SHOULD visually represent sanitized regions using non-destructive overlays and MUST provide status information for:
* Active privacy protection
* Processing state
* Verification state
* Reduced coverage
* Human intervention
* Fail-closed state

Audit rendering MUST be asynchronous and MUST NOT block the browser's main interaction path or the extension's control loop. Overlay updates SHOULD be coalesced on high-mutation pages (batched to ≤1 update per 100ms) rather than being triggered synchronously for every individual DOM mutation. Audit indicators MUST NOT themselves expose the sensitive information they are intended to protect.

**Rationale**: Auditability is required for user trust, but the audit layer must not become a performance bottleneck or an additional privacy leak.

---

### X. Comprehensive Dynamic PII Scope

The privacy filter MUST combine high-precision pattern matching with local semantic classification models to detect and redact PII across two tiers.

**Core Scope — MUST always be active**
* Human faces
* Password and credential fields
* Email addresses
* Global payment card numbers (15–19 digit formats and major networks)

**Extended Scope — MUST be active on Tier 1 and MAY degrade on Tier 2**
* Government-issued identification numbers (SSN, PAN, Aadhaar, and national equivalents)
* Phone numbers
* Other relevant locale-specific identifiers

On Tier 2, Extended Scope MAY be skipped only when required to remain within the 3000ms latency budget. When Extended Scope is skipped, the user MUST be informed through the local audit UI.

**Rationale**: Core protection must never disappear silently. Performance degradation may reduce coverage only when the user is explicitly informed.

---

### XI. Incremental State Processing

The agent SHOULD support incremental processing for multi-step browser tasks to avoid unnecessarily reprocessing unchanged page state.

When a page changes, the system SHOULD identify the smallest relevant state difference and process only the affected DOM, visual, or accessibility regions where safely possible. Change detection MUST use an explicit region fingerprint covering DOM subtree content, computed CSSOM styling, geometry, accessibility metadata, and visual canvas hashes.

A previously verified redaction result for a region MAY be reused for a subsequent cycle ONLY IF that region's current fingerprint exactly matches its prior fingerprint. If any fingerprint component cannot be computed or compared, that region MUST default to recompute.

**Rationale**: Incremental processing prevents multi-step latency compounding, while deterministic multi-component fingerprinting ensures that gaps fail toward privacy.

---

### XII. Voice Input Privacy

Voice interaction MUST follow the same privacy model as typed user interaction. The browser agent MAY provide a microphone interface for natural-language task instructions.

Raw microphone audio MUST remain local. Speech-to-text MUST occur locally using an implementation compatible with the execution environment. Shipping voice input is contingent on passing a pre-implementation feasibility benchmark on target fallback hardware.

If local speech-to-text is unavailable, fails to initialize, or fails at runtime, the system MUST NOT silently fall back to cloud transcription. Instead, the agent MUST:
1. Immediately disable the voice-input UI control and visibly indicate that voice input is unavailable.
2. Inform the user in the audit UI.
3. Offer typed text input as the fallback path.
4. Allow retrying voice input later without restarting the task session.

**Rationale**: Voice input must not become an accidental exception to the zero-raw-data-transmission rule.

---

### XIII. Human-in-the-Loop Secret Handling

The browser agent MUST NOT autonomously enter, transmit, expose, or infer user-controlled secrets including passwords, MFA codes, payment credentials, private keys, or security answers.

When a task requires a secret, the Agent Controller MUST transition into a **Human Intervention** state:
1. Automated agent actions MUST be suspended.
2. Automated perception and network serialization associated with secret entry MUST be suspended.
3. The agent MUST NOT capture, inspect, store, or transmit the user's secret input.
4. The user MUST enter the secret directly into the browser's designated input.
5. The agent MUST remain paused until the user explicitly completes the intervention and clicks resume.
6. Upon resumption, the privacy pipeline MUST perform a fresh observation and sanitization cycle (Article XV).

**Rationale**: The security boundary must survive the transition between autonomous and human-controlled interaction. Explicit state transitions prevent race conditions in which user credentials are inadvertently captured.

---

### XIV. Browser Agent Architecture & Trust Boundaries

The system MUST be implemented as a browser-agent extension acting as the local execution environment and privacy boundary.

The architecture follows this strict separation:
* **User** → Provides natural-language task (text or local voice transcription).
* **Agent Controller** → Manages task lifecycle, state, and coordination.
* **Privacy Boundary** → Observes DOM/screen, detects PII, sanitizes payloads, and verifies manifests.
* **Cloud LM/VLM** → Untrusted reasoning service receiving sanitized structural payloads and returning proposed actions.
* **Agent Controller** → Validates returned actions locally.
* **Browser** → Executes validated actions.

**Local Action Validation MUST consist of:**
1. **Action allowlisting**: Action type must match permitted primitives (`click`, `type`, `scroll`, `navigate`).
2. **Target existence and identity check**: Target element must be re-resolved on the live DOM to verify geometric and structural consistency.
3. **Targeted re-verification for sensitive targets**: Targets falling within or adjacent to PII/secret regions require a localized redaction check before execution.
4. **Rejection on ambiguity**: Actions failing validation halt the cycle fail-closed per Article V.

**Rationale**: The cloud reasoning model is an untrusted external planner. The local extension maintains exclusive authority over action execution and data boundaries.

---

### XV. Perception-Reasoning-Action Loop

Every autonomous task MUST execute via a repeated privacy-preserving cycle:
`Observe → Detect → Sanitize → Verify → Transmit → Reason → Validate → Execute → Repeat`

**Pause and Resume Semantics:**
* Pausing allows in-flight browser events to finish or cleanly abort without leaving intermediate DOM side-effects.
* Resume MUST NEVER continue from an old observation. Resume MUST always restart the cycle from step 1 (**Observe**), generating a fresh perception, sanitization, and verification pass.

**Rationale**: Continuous verification prevents the agent from operating on stale, altered, or injected DOM states during multi-turn automation.

---

### XVI. User Visibility & Agent Control

The extension MUST provide clear, real-time controls over autonomous execution:
* Task input controls (text, local voice).
* Agent active/paused/stopped status.
* Visual overlays of sanitized regions.
* Human intervention prompts.
* Reduced-coverage alerts.

**Task State Durability:** Pausing a multi-step task preserves overall task intent and history while clearing in-progress perception cycles.
**Navigation While Paused:** If the user manually navigates to an unrelated URL while the agent is paused, resume MUST prompt for user confirmation to restart or abort, preventing accidental execution against unintended sites.

**Rationale**: Autonomous execution must remain subordinate to explicit human intent and oversight at all times.

---

# Performance Budgets & System Constraints

* **Structural Mapping Accuracy**: High-fidelity DOM/layout reconstruction satisfying the 25% evaluation metric weighting.
* **Redaction Accuracy**: Precision ≥95% and Recall ≥95% across all active PII categories.
* **Cycle Latency**:
  * Tier 1 (WebGPU): <2000ms target per cycle.
  * Tier 2 (WASM fallback): <3000ms target per cycle with Core Scope.
* **Extended Scope**: Mandatory on Tier 1; degradable on Tier 2 with mandatory UI notification.
* **Hardware Acceleration**: Primary WebGPU; fallback WebAssembly with XNNPACK.
* **Supported Extension Targets**: Chromium MV3 (`chrome.offscreen`) and Firefox MV3 (background scripts / polyfilled hidden document contexts).
* **Payload Serialization**: Outgoing requests MUST bundle a `schema_version` metadata header and active token vocabulary manifest.

---

# Development Workflow & Quality Gates

1. **Pre-Transmission Serialization Gates**: Automated unit tests MUST verify that no outgoing network payload contains unmasked raw pixels, base64 buffers, unscrubbed ARIA metadata, or raw audio.
2. **Schema & Header Conformance Gates**: Automated tests MUST assert that all network requests contain valid `schema_version` headers matching the server's expected parser specification.
3. **Structural Context Fidelity Benchmarks**: Automated evaluators MUST score structural DOM representation against ground-truth layouts to maintain the 25% accuracy metric.
4. **DOM Integrity Gates**: Tests MUST confirm that live DOM text, layouts, and input values are never destructively overwritten by the sanitization process.
5. **Fail-Closed Failure Injection**: Tests MUST inject synthetic runtime faults (WebGPU crash, WASM OOM, manifest mismatch) to assert that task execution halts immediately without network transmission.
6. **Voice Privacy Gates**: Tests MUST assert that raw microphone audio never leaves client memory and that transcription failures default cleanly to text-only mode.
7. **Adversarial & Demographic Parity Audits**: Inference models MUST be benchmarked against consented, real-world demographic datasets to guarantee parity in False Negative Rates.
8. **Action Validation Gates**: Tests MUST verify rejection of non-allowlisted actions, missing target elements, or unverified actions targeting sensitive fields.

---

# Governance

This Constitution represents the supreme operational and architectural contract for the browser agent prototype.

* **Supremacy**: In any conflict between performance optimization and privacy directives, privacy directives take absolute precedence.
* **Local Authority**: The browser extension retains final authority over privacy enforcement, human intervention, action validation, and browser action execution.
* **Cloud Trust Boundary**: Cloud reasoning services are untrusted recipients of sanitized context and MUST NOT be granted authority to bypass local security controls.
* **Amendment Process**: Amendments require documentation of proposed changes, justification under the metric hierarchy, zero-leakage compliance verification, and a semantic version bump.
* **Semantic Versioning**:
  * **MAJOR**: Incompatible governance alterations or modifications to core privacy directives.
  * **MINOR**: Additions of new principles, structural sections, or expanded PII scope.
  * **PATCH**: Clarifications, wording refinements, or non-semantic formatting corrections.

**Version**: 1.5.0  
**Ratified**: 2026-09-08  
**Last Amended**: 2026-09-08
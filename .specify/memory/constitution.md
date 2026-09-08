<!--
Sync Impact Report

- Version change: v1.3.0 -> v1.4.0

- Modified principles:
  - XI. Incremental State Processing — replaced vague "safe reuse" language
    with a concrete change-detection mechanism (region fingerprinting) and a
    default-to-recompute rule when fingerprinting coverage is incomplete.
  - XII. Voice Input Privacy — downgraded "local STT MUST always succeed" to
    a defined feasibility gate: local STT is a SHOULD-ship feature contingent
    on a pre-implementation benchmark; added explicit graceful-unavailability
    behavior instead of an undefined "MUST NOT fall back" dead end.
  - XIV. Browser Agent Architecture & Trust Boundaries — defined "local action
    validation" concretely (action allowlist + targeted re-verification),
    replacing the previously undefined validation step.
  - XV. Perception-Reasoning-Action Loop — added explicit pause/resume
    semantics: resume MUST always trigger a fresh observation, never resume
    mid-cycle from stale state.
  - XVI. User Visibility & Agent Control — added explicit behavior for
    pause-during-multi-step-task and navigate-away-while-paused cases.

- Added sections:
  - None (existing sections amended in place)

- Removed:
  - None

- Follow-up TODOs:
  - Run the Article XII local-STT feasibility benchmark on target hardware
    before committing to shipping voice input for the hackathon demo.
  - Define the concrete action allowlist referenced in Article XIV.
  - Define the exact fingerprint composition (which DOM/CSSOM/a11y properties)
    referenced in Article XI in the implementation performance specification.
  - Define the 2-3 canonical multi-step benchmark workflows referenced in
    Development Workflow Gate 10.
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

### III. Concrete Sanitization Schema & Structural Tokens

Redaction MUST be structural and concrete and MUST NOT destructively modify the live DOM.

Visual PII MUST be obfuscated using solid opaque bounding boxes rendered as a non-destructive overlay directly on top of the live DOM. The underlying element's text content, HTML structure, and layout box MUST NOT be altered.

Textual PII MUST be replaced with strict semantic placeholder tokens such as `<REDACTED_FINANCIAL>` or `<REDACTED_IDENTITY>` ONLY within the serialized network payload sent to the backend.

Placeholder tokens MUST use fixed, category-based representations that prevent unnecessary length-based inference of the underlying value.

These tokens MUST NEVER be written back into the live DOM or any user-facing rendering context.

Every perception-action cycle MUST independently pass through the sanitization and verification pipeline before network transmission. A previously sanitized state MUST NOT automatically be considered safe for a later cycle unless the requirements of Article XI are satisfied.

**Rationale**: The system has two distinct redaction surfaces:

1. What the user sees — a non-destructive visual overlay.
2. What the cloud receives — a sanitized, tokenized representation.

Separating these surfaces preserves page functionality while preventing sensitive values from entering the cloud reasoning boundary.

---

### IV. Cross-Browser Background Execution Isolation

Heavy visual DOM processing, feature extraction, local neural inference, sanitization, manifest generation, and speech-to-text processing MUST execute within an isolated background execution context.

Chromium MV3 implementations SHOULD use `chrome.offscreen` where appropriate. Firefox MV3 implementations MAY use background scripts or hidden document polyfills where required.

On Firefox, implementations MUST additionally verify that heavy inference does not block the extension's message-routing loop.

The architecture MUST maintain a logical separation between:

1. **Agent Controller** — manages task state, user instructions, agent actions, intervention, and lifecycle.
2. **Privacy Boundary** — performs local observation sanitization, PII detection, redaction verification, and fail-closed enforcement.
3. **User Interface** — provides text/voice input, status, audit overlays, warnings, and human intervention controls.

The cloud reasoning service MUST NOT be treated as a replacement for any of these local responsibilities.

**Rationale**: Browser-agent execution, privacy enforcement, and UI responsiveness have different security and performance requirements and must not become one uncontrolled execution path.

---

### V. Fail-Closed Protocol

If the local inference engine fails on both WebGPU and WASM runtimes, or fails to produce a verified redaction map, the agent MUST immediately halt the current automated task session and alert the user.

Verification MUST use a redaction manifest listing each redacted region or field, its category, and its completion/verification state.

The redaction manifest MUST be constructed and consumed entirely within the trusted background/offscreen execution context whenever the current architecture permits this.

The network transmission layer MUST accept sanitized payloads only after successful completion of the local privacy verification process.

If a future architecture requires the manifest or sanitized payload to cross into a less-trusted execution context, that architecture MUST introduce an appropriate integrity mechanism and MUST undergo explicit security review and constitutional amendment before implementation.

No future architecture may use the existence of such an integrity mechanism as justification for transmitting raw or unverified data.

Under no circumstances may the system fall back to transmitting unverified or raw data.

**Rationale**: Privacy verification is a prerequisite for network transmission, not a best-effort feature. Architectural changes that introduce new trust boundaries require explicit security review rather than silently weakening the existing model.

---

### VI. Bias Mitigation & Adversarial Robustness

The local redaction pipeline MUST incorporate structural robustness interventions such as input normalization and adversarial noise defense.

PII detection models MUST be benchmarked to evaluate False Negative Rates (FNR) across diverse demographic distributions, including relevant visual diversity such as Fitzpatrick skin types for face detection.

Benchmark datasets MUST include a real-world-sourced validation subset with documented, lawful consent for use in bias testing.

Synthetic data alone is INSUFFICIENT to claim real-world demographic robustness.

**Rationale**: A privacy system that systematically fails to detect sensitive information for particular groups is itself a privacy failure.

---

### VII. Metric Hierarchy & Evaluation Trade-offs

When engineering decisions require balancing competing objectives, teams and agents MUST adhere to the following priority hierarchy:

1. **Redaction Precision and Recall** — minimum target ≥95%
2. **End-to-End Latency**
3. **Client-Side Resource Utilization**

Latency budgets apply per single perception-action cycle, defined as:

**observation → local sanitization → verification → sanitized payload → cloud reasoning → returned action**

Multi-step agent tasks consist of multiple cycles and MUST be evaluated both per-cycle and as complete workflows.

**Tier 1 — WebGPU**

* Target: <2000ms per perception-action cycle.
* Full Core + Extended PII scope.

**Tier 2 — WASM fallback**

* Target: <3000ms per perception-action cycle.
* Core Scope MUST remain active.
* Extended Scope MAY run only when the total cycle remains within the budget.
* If Extended Scope must be skipped, the user MUST receive a visible reduced-coverage indication.

Exact UI rendering budgets MUST be defined and benchmarked in the project's performance specification/PRD rather than being treated as synchronous constitutional timing guarantees.

**Rationale**: A privacy constitution should define hard safety boundaries and system-level performance requirements without coupling those guarantees to a specific browser rendering implementation.

---

### VIII. VLM Contextual Blindness

The redaction pipeline MUST strip adjacent identifying labels such as:

* SSN
* Card Number
* CVV
* Password
* Date of Birth
* Account Number
* Aadhaar
* PAN
* Other locale-specific sensitive identifiers

The system MUST consider contextual information surrounding a sensitive field, not merely the field's value.

Label identification MUST use a maintained denylist of known-sensitive patterns combined with a semantic classifier for novel or localized labels.

Labels or contextual regions below the required confidence threshold MUST default to REDACTED rather than being transmitted.

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

Audit rendering MUST be asynchronous and MUST NOT block the browser's main interaction path or the extension's control loop.

Overlay updates SHOULD be coalesced on high-mutation pages rather than being triggered synchronously for every individual DOM mutation.

Exact rendering and batching budgets MUST be defined in the implementation performance specification.

Audit indicators MUST NOT themselves expose the sensitive information they are intended to protect.

**Rationale**: Auditability is required for user trust, but the audit layer must not become a performance bottleneck or an additional privacy leak.

---

### X. Comprehensive Dynamic PII Scope

The privacy filter MUST combine high-precision pattern matching with local semantic classification models to detect and redact PII across two tiers.

**Core Scope — MUST always be active**

* Human faces
* Password and credential fields
* Email addresses
* Global payment card numbers, including 15–19 digit formats and major networks

**Extended Scope — MUST be active on Tier 1 and MAY degrade on Tier 2**

* Government-issued identification numbers
* SSN
* PAN
* Aadhaar
* Locale-specific government identifiers
* Phone numbers
* Other relevant locale-specific identifiers

On Tier 2, Extended Scope MAY be skipped only when required to remain within the latency budget.

When Extended Scope is skipped, the user MUST be informed through the local audit UI.

**Rationale**: Core protection must never disappear silently. Performance degradation may reduce coverage only when the user is explicitly informed.

---

### XI. Incremental State Processing

The agent SHOULD support incremental processing for multi-step browser tasks to avoid unnecessarily reprocessing unchanged page state.

When a page changes, the system SHOULD identify the smallest relevant state difference and process only the affected DOM, visual, or accessibility regions where safely possible.

**Change detection MUST use an explicit region fingerprint**, not an implicit assumption of "unchanged." A fingerprint MUST be computed per candidate region and MUST cover, at minimum: the region's DOM subtree content and attributes, computed/relevant CSSOM styling, geometry (position and dimensions), accessibility tree metadata, and — where the region is a Canvas or other non-DOM-observable surface — a periodic visual hash of its rendered output.

A previously verified redaction result for a region MAY be reused for a subsequent cycle ONLY IF that region's current fingerprint exactly matches its fingerprint at the time of the prior verification.

If any fingerprint component cannot be computed or compared for a given region (e.g., a Canvas visual hash could not be taken, or CSSOM state is unavailable), that region MUST be treated as changed and MUST be recomputed. Incomplete fingerprint coverage is never grounds for assuming safety.

Rendering changes that occur without corresponding DOM mutations, including canvas changes, CSS-driven changes, animations, dynamic visual content, or other browser rendering changes, MUST be caught by the fingerprint's styling and visual-hash components and MUST NOT be assumed safe merely because the DOM tree is unchanged.

**Rationale**: Incremental processing is necessary to prevent multi-step latency from compounding into unusable workflows, but stale redaction state can become a privacy vulnerability. A concrete, multi-component fingerprint — rather than an undefined notion of "unchanged" — makes reuse decisions deterministic and testable, and the default-to-recompute rule ensures that gaps in fingerprint coverage fail toward privacy, not toward performance.

---

### XII. Voice Input Privacy

Voice interaction MUST follow the same privacy model as typed user interaction.

The browser agent MAY provide a microphone interface for natural-language task instructions.

Raw microphone audio MUST remain local.

Speech-to-text MUST occur locally using an implementation compatible with the available execution environment.

**Shipping the voice input feature is contingent on a pre-implementation feasibility benchmark.** Before voice input is enabled for any target browser/hardware combination, the team MUST benchmark local STT accuracy and latency on representative low-end hardware for that combination. Voice input MUST NOT be enabled for a browser/hardware combination that has not passed this benchmark.

The transcribed instruction MUST then enter the normal Agent Controller workflow.

The cloud reasoning service MUST receive only the sanitized task instruction required for reasoning and MUST NOT receive the original audio recording.

If local speech-to-text is unavailable, fails to initialize, or fails at runtime, the system MUST NOT silently fall back to cloud transcription using raw audio. Instead, the agent MUST:

1. Immediately disable the voice-input UI control and visibly indicate that voice input is unavailable.
2. Inform the user, in the audit UI, that voice input is unavailable on this browser/device.
3. Offer typed text input as the continued path for task instructions.
4. Allow the user to retry voice input later without restarting the entire agent session.

**Rationale**: Voice is another input channel into the agent and must not become an accidental exception to the zero-raw-data-transmission rule. Treating local STT as an unconditional MUST without a feasibility gate risks shipping a feature that silently breaks on real hardware; the benchmark-then-enable rule and the defined unavailability behavior turn "voice must work" into "voice is either verified to work, or is cleanly and visibly disabled."

---

### XIII. Human-in-the-Loop Secret Handling

The browser agent MUST NOT autonomously enter, transmit, expose, or infer user-controlled secrets including:

* Passwords
* Authentication codes
* Payment credentials
* Private keys
* Security answers
* Other explicitly designated secrets

When a task requires a secret, the Agent Controller MUST transition into a **Human Intervention** state.

During Human Intervention:

1. Automated agent actions MUST be suspended.
2. Automated perception and network serialization associated with the secret-entry interaction MUST be suspended.
3. The agent MUST NOT capture, inspect, store, or transmit the user's secret input.
4. The user MUST enter the secret directly into the browser's designated input.
5. The agent MUST remain paused until the human intervention state is explicitly completed.
6. The user MUST explicitly resume the agent.
7. Upon resumption, the privacy pipeline MUST perform a fresh observation and sanitization cycle, per Article XV.

The agent MUST NOT rely solely on navigation away from an authentication page to determine that secret handling has ended.

The browser and extension MAY continue normal non-agent functionality during human intervention, but the autonomous agent perception/action pipeline MUST remain suspended.

User-entered secrets MUST NOT be inserted into agent state buffers, cloud prompts, logs, telemetry, screenshots, or intermediate serialized payloads.

**Rationale**: The security boundary must survive the transition between autonomous and human-controlled interaction. Explicit state transitions prevent race conditions in which user keystrokes are accidentally captured by the agent.

---

### XIV. Browser Agent Architecture & Trust Boundaries

The system MUST be implemented as a browser-agent extension.

The extension is the local execution environment and privacy enforcement boundary between the user's browser and the cloud reasoning model.

The architecture MUST follow this conceptual separation:

**User**

→ provides a natural-language task by text or local voice transcription

**Agent Controller**

→ manages the task lifecycle and determines when observation, reasoning, action, or human intervention is required

**Privacy Boundary**

→ observes browser state locally, detects PII, sanitizes content, verifies the redaction state, and enforces fail-closed behavior

**Cloud LM/VLM**

→ receives only sanitized context and provides reasoning/action decisions

**Agent Controller**

→ validates returned actions against current local state and privacy rules

**Browser**

→ receives locally validated actions

The cloud LM/VLM MUST be treated as an untrusted reasoning service.

The cloud reasoning service MUST NOT have authority to:

* Disable privacy protection
* Override fail-closed behavior
* Request raw browser state
* Request raw screenshots
* Request raw microphone audio
* Directly manipulate the browser
* Bypass human intervention
* Override local action validation

**"Local action validation" (referenced above and in Article XV) MUST consist, at minimum, of:**

1. **Action allowlisting** — every returned action MUST match one of a maintained set of permitted action types (e.g., click, type-into-field, scroll, navigate). Actions outside the allowlist MUST be rejected without execution.
2. **Target existence and identity check** — the action's target element MUST be re-resolved against the current live DOM (not the DOM snapshot sent to the cloud) to confirm it still exists and matches the expected element identity/geometry.
3. **Targeted re-verification for sensitive targets** — if the action's target falls within, or would cause navigation/data flow into, a region previously classified as Core or Extended Scope PII (per Article X) or a secret field (per Article XIII), the Privacy Boundary MUST re-run redaction/secret classification on that specific target before the action is permitted to execute, rather than trusting the manifest from a prior cycle.
4. **Rejection on ambiguity** — if allowlisting, target resolution, or targeted re-verification cannot be completed with confidence, the action MUST be rejected and the cycle MUST fail closed per Article V, rather than executing an unverified action.

This targeted re-verification is deliberately scoped to the action's specific target rather than the full page, so it does not require re-running full-page inference on every action and does not conflict with the incremental processing model in Article XI.

The extension MUST retain final authority over privacy enforcement and browser action execution.

**Rationale**: The system is not an LM with a privacy filter attached to it. It is a browser-agent extension in which the local extension controls the boundary between browser state and cloud reasoning. An undefined "validate the action" instruction is not enforceable; a concrete allowlist-plus-targeted-reverification mechanism is implementable, testable, and keeps validation cost proportional to a single action rather than a full-page re-scan.

---

### XV. Perception-Reasoning-Action Loop

Every autonomous task MUST follow a repeated local privacy-preserving perception-reasoning-action loop.

The canonical cycle is:

1. **Receive task**

   * User provides text or locally transcribed voice instructions.

2. **Initialize task**

   * Agent Controller creates a local task state.

3. **Observe**

   * Extension obtains the relevant DOM, accessibility, layout, and visual state locally.

4. **Detect**

   * Local privacy pipeline identifies PII and sensitive contextual information.

5. **Sanitize**

   * Visual regions are protected by overlays.
   * Serialized textual/structural information is tokenized or removed.

6. **Verify**

   * Local verification confirms that the outgoing representation satisfies the privacy boundary.

7. **Transmit**

   * Only verified sanitized context is sent to the cloud reasoning service.

8. **Reason**

   * Cloud LM/VLM determines the next action using the sanitized context.

9. **Validate**

   * Agent Controller checks the returned action against the current local browser state and privacy constraints, per the local action validation mechanism defined in Article XIV.

10. **Execute**

    * The extension performs the permitted browser action locally.

11. **Human Intervention**

    * If a secret or other protected user interaction is required, the system enters the Human Intervention state defined in Article XIII.

12. **Repeat**

    * A new observation/sanitization/verification cycle begins after the action.

Every cycle MUST independently enforce the privacy boundary unless Article XI explicitly permits safe incremental reuse under its fingerprint-match rule.

**Pause and resume semantics:**

* When the user pauses the agent at any point in the cycle (including mid-action), the current cycle's in-flight action MUST be allowed to finish or be safely aborted before the pause takes effect — the agent MUST NOT leave a browser action partially applied.
* Resume MUST NEVER continue a cycle from a paused/stale intermediate step (e.g., resuming directly into step 8 with an old observation). Resume MUST always restart the cycle from step 3 (**Observe**), producing a fresh observation, sanitization, and verification pass, regardless of how much of the previous cycle had completed before the pause.
* This applies uniformly whether the pause was user-initiated (Article XVI), triggered by Human Intervention (Article XIII), or triggered by a fail-closed event (Article V).

The task MUST terminate when:

* The requested task is completed.
* The user explicitly stops the agent.
* The user takes control and ends the task.
* A privacy verification failure occurs.
* The local inference pipeline fails and cannot safely recover.
* The agent determines that continuing would violate a constitutional requirement.

**Rationale**: The privacy boundary is not a one-time preprocessing step. It is continuously enforced throughout autonomous browser operation. Always restarting from a fresh observation on resume closes the gap where a paused agent could otherwise act on stale, potentially invalid state after the page has changed underneath it.

---

### XVI. User Visibility & Agent Control

The extension MUST provide the user with clear local controls over the autonomous agent.

The UI MUST provide, where applicable:

* Text task input
* Local voice input (subject to the feasibility gate in Article XII)
* Agent active/paused state
* Privacy protection status
* Protected-region visualization
* Reduced-coverage warnings
* Human intervention prompts
* Explicit resume control
* Stop/cancel control
* Fail-closed warnings

The user MUST always have a mechanism to stop autonomous execution.

**Pausing a multi-step task:** Pausing MUST NOT discard the overall task state (the user's original instruction and completed-steps history), only the in-progress perception-action cycle, per the pause semantics in Article XV. The user MUST be able to resume the same task rather than being forced to restart it from scratch.

**Navigating away while paused:** If the user manually navigates the browser to a different page while the agent is paused, the current task MUST be treated as invalidated on resume — the Agent Controller MUST NOT attempt to continue the original task against a page it no longer matches. On resume, the agent MUST inform the user that the page changed and MUST require the user to confirm whether to restart the task in the new context or cancel it. This MUST NOT happen silently.

The UI MUST NOT expose protected values merely to explain that they were redacted.

When the system is operating with reduced privacy coverage, the user MUST be informed before or during the affected automated action.

**Rationale**: Autonomous operation does not remove user authority. The user must remain able to understand, pause, resume, and terminate the agent. Preserving task state across a pause avoids frustrating restarts, while treating navigation-while-paused as requiring explicit confirmation prevents the agent from silently acting on a page the user never intended it to continue on.

---

# Performance Budgets & System Constraints

The following requirements define system-level targets. Detailed browser-specific rendering measurements belong in the implementation performance specification.

* **Redaction Accuracy**: Precision ≥95% and Recall ≥95% across all active PII categories.
* **Cycle Latency**:

  * Tier 1 WebGPU: <2000ms target.
  * Tier 2 WASM: <3000ms target with Core Scope.
* **Extended Scope**:

  * Required on Tier 1.
  * Optional on Tier 2 when necessary to preserve the cycle latency budget.
  * Skipping Extended Scope MUST produce a visible reduced-coverage warning.
* **Hardware Acceleration**:

  * Primary: WebGPU.
  * Secondary fallback: WebAssembly/WASM with XNNPACK where applicable.
* **Supported Extension Targets**:

  * Chromium Manifest V3.
  * Firefox Manifest V3.
* **Voice Processing**:

  * Speech-to-text MUST execute locally, gated on the Article XII feasibility benchmark.
  * Raw audio MUST NOT cross the privacy boundary.
  * Voice input MUST degrade to a visibly disabled state, not silent cloud fallback, on any target that fails the benchmark or fails at runtime.
* **Incremental Processing**:

  * Redaction state reuse MUST be governed by the region-fingerprint match rule in Article XI.
  * Incomplete fingerprint coverage MUST default to recompute, never to reuse.
* **Agent Execution**:

  * Autonomous browser actions MUST execute through the local extension.
  * Cloud-generated actions MUST undergo local validation (allowlist + target re-resolution + targeted re-verification) per Article XIV before execution.
* **Human Intervention**:

  * Automated perception/action processing MUST remain suspended while protected secret entry is occurring.
* **Pause/Resume**:

  * Resume MUST always restart from a fresh observation (Article XV); resuming into a stale intermediate step is prohibited.

---

# Development Workflow & Quality Gates

1. **Pre-Transmission Serialization Gates**

   Automated tests MUST assert that no serialized network request contains:

   * Raw base64/binary image buffers.
   * Raw screenshots.
   * Raw microphone audio.
   * Unmasked PII strings.
   * Unscrubbed ARIA/accessibility metadata.
   * Original PII values embedded in placeholder tokens.
   * Protected secret values.

2. **DOM Integrity Gates**

   Tests MUST verify that sanitization does not modify the live DOM's:

   * Text content.
   * HTML structure.
   * Layout boxes.
   * User-entered values.

   Redaction MUST remain overlay-based or payload-based and MUST NOT destructively rewrite the page.

3. **Voice Privacy Gates**

   Tests MUST verify that:

   * Raw microphone audio never enters network requests.
   * Local transcription occurs before cloud reasoning.
   * Failed or unavailable local STT triggers the defined unavailability UI state, not a cloud audio fallback.
   * Voice input remains disabled for any browser/hardware combination that has not passed the Article XII feasibility benchmark.
   * Raw audio is discarded after transcription where no local feature requires retention.

4. **Adversarial & Demographic Robustness Auditing**

   Local vision and text redaction models MUST be evaluated against:

   * Adversarial inputs.
   * Synthetic datasets.
   * Consented real-world validation data.
   * Relevant demographic distributions.

5. **Fail-Closed Failure Injection**

   Integration suites MUST simulate:

   * WebGPU failure.
   * WASM failure.
   * Redaction-map failure.
   * Manifest verification failure.
   * Serialization failure.
   * Background-context failure.
   * Action-validation rejection (allowlist miss, target mismatch, failed re-verification).

   In each case, the agent MUST halt rather than transmit unverified state or execute an unvalidated action.

6. **Human Intervention Race-Condition Testing**

   Tests MUST verify that:

   * Automated perception suspends before protected secret entry.
   * User keystrokes do not enter agent buffers.
   * Secret values do not enter logs or network payloads.
   * Agent execution remains paused until explicit resume.
   * Resumption triggers a fresh privacy verification cycle.

7. **Incremental Processing Verification**

   Tests MUST verify that:

   * Region fingerprints correctly detect DOM, CSSOM, geometry, and accessibility changes.
   * Canvas and other visually dynamic content are caught via the visual-hash fingerprint component.
   * A fingerprint mismatch on any component invalidates and recomputes the region.
   * Incomplete or uncomputable fingerprint components cause recomputation, never reuse.

8. **Main Thread Non-Blocking Verification**

   Profiling MUST verify that:

   * Local inference does not freeze the browser UI.
   * Audit rendering remains asynchronous.
   * Firefox background message routing remains responsive during inference.

9. **Tiered Latency Verification**

   Profiling MUST separately verify:

   * Tier 1 WebGPU with full scope.
   * Tier 2 WASM with Core Scope.
   * Tier 2 WASM with Core + Extended Scope where supported.

   Tier 2 MUST be tested on representative fallback-class hardware.

10. **Multi-Step Workflow Verification**

    Testing MUST evaluate complete multi-step agent tasks rather than only isolated inference cycles, using a defined set of 2-3 canonical benchmark workflows (to be specified in the implementation performance specification) containing approximately 10-15 actions each, to identify compounding latency and stale-state failures.

    Testing MUST also verify pause-mid-task and resume behavior against these workflows, including the navigate-away-while-paused case.

11. **Cloud Trust-Boundary Verification**

    Tests MUST verify that the cloud reasoning service cannot:

    * Request raw browser state.
    * Request raw screenshots.
    * Request raw audio.
    * Disable local privacy controls.
    * Force execution of unvalidated or non-allowlisted actions.
    * Bypass Human Intervention state.

12. **User-Control Verification**

    Tests MUST verify that the user can:

    * Start an agent task.
    * Pause execution without losing task state.
    * Resume after human intervention or a manual pause, always into a fresh observation.
    * Stop the task.
    * Observe privacy status.
    * Observe reduced-coverage warnings.
    * Be prompted for confirmation when navigating away while paused.

---

# Governance

This Constitution represents the supreme operational and architectural contract for the browser agent prototype.

All features, tasks, models, integrations, and code changes MUST comply with the rules established herein.

* **Supremacy**: In any conflict between performance optimization and privacy directives, privacy directives take absolute precedence.

* **Local Authority**: The browser extension retains final authority over privacy enforcement, human intervention, action validation, and browser action execution.

* **Cloud Trust Boundary**: Cloud reasoning services are untrusted recipients of sanitized context and MUST NOT be granted authority to bypass local security controls.

* **Amendment Process**: Amendments require documentation of the proposed changes, justification under the metric hierarchy, verification of zero-leakage compliance, and a semantic version bump.

* **Semantic Versioning**:

  * **MAJOR**: Incompatible governance alterations, changes to core privacy directives, or modifications to the metric hierarchy.
  * **MINOR**: Additions of new principles, structural sections, expanded PII scope, architectural requirements, or changes to latency budgets.
  * **PATCH**: Clarifications, wording refinements, or non-semantic formatting corrections.

* **Compliance Audits**: Pull requests and autonomous code generations MUST be audited against these principles before merging or task completion.

* **Future Architectural Boundaries**: Any architectural change that introduces a new less-trusted execution or communication boundary MUST undergo explicit security review before implementation. Existing privacy guarantees MUST NOT be weakened merely to accommodate architectural convenience.

**Version**: 1.4.0
**Ratified**: 2026-09-08
**Last Amended**: 2026-09-08
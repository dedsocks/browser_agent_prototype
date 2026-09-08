# Phase 0 Research: Client-Side PII Redaction Pipeline

**Feature**: Client-Side PII Redaction Pipeline (`001-client-pii-redaction`)  
**Status**: Completed  
**Alignment**: Constitution v1.5.0 (Principles I–X, XIV, XV)

---

## 1. Local Textual PII Detection & Checksum Validation

### Context
Outbound network payloads sent to cloud reasoning models must never contain plaintext personal, financial, or authentication credentials. The detection engine must be local, deterministic, and achieve ≥95% precision and recall without introducing latency bottlenecks.

### Decision
Implement a tiered detection pipeline:
1. **Adversarial Input Normalization Layer**: Unicode NFKC normalization, homoglyph mapping (converting Cyrillic/Greek lookalikes to Latin), and zero-width/separator stripping.
2. **Deterministic High-Precision Regex & Checksum Engine**:
   - **Payment Cards**: 15–19 digit patterns covering Visa, Mastercard, Amex, Discover, Diners, JCB, UnionPay, coupled with mandatory **Luhn algorithm** verification.
   - **Government Identifiers**:
     - US SSN: 9-digit format (`XXX-XX-XXXX` or 9 continuous digits with standard area/group exclusion rules).
     - Indian PAN: 10-character alphanumeric regex (`[A-Z]{5}[0-9]{4}[A-Z]`).
     - Indian Aadhaar: 12-digit format with **Verhoeff algorithm** checksum verification.
   - **Contact Information**: RFC 5322-compliant email regex; E.164 and localized national phone number regex patterns.
   - **Credentials & Secrets**: Field type inspection (`type="password"`), autocomplete attributes (`current-password`, `new-password`, `cc-csc`), and high-entropy secret token patterns.
3. **Contextual Fallback Engine**: Semantic keyword heuristics for novel/ambiguous fields with conservative redaction bias (defaulting to redacted on low confidence).

### Rationale
- Regex and algorithmic checksum validation (Luhn, Verhoeff) execute in <5ms, consuming virtually zero CPU/GPU resources while ensuring near 100% precision on structured identifiers like credit cards and national IDs.
- Normalization prevents evasion attacks using hidden zero-width spaces or character homoglyphs.

### Alternatives Considered
- *Full Client-Side LLM/NER (e.g., BERT/T5 via ONNX)*: Exceeds the latency budget (>800ms) and consumes excessive client memory (~200MB–500MB), risking browser tab crashes on low-spec client devices. Rejected for baseline text sanitization. Can be evaluated as a deferred enhancement for ambiguous free text in Tier 1 environments.
- *Cloud-Based Sanitization API*: Violates Principle I (Zero Raw Data Transmission) and Constitution Governance rules. Rejected.

---

## 2. Structural Tokenization & Server-Side Redaction Awareness

### Context
Text PII must be masked in outbound payloads without altering the user's live document DOM. Furthermore, the external Vision-Language Model (VLM) must understand that elements are masked to generate correct automation commands without hallucinating or attempting to reconstruct hidden values.

### Decision
- **In-Memory Transformation Only**: The live DOM text nodes, input values, and layout structures remain strictly unaltered.
- **Fixed Semantic Category Tokens**:
  - Financial data: `<REDACTED_FINANCIAL>`
  - Government identity: `<REDACTED_IDENTITY>`
  - Contact details: `<REDACTED_CONTACT>`
  - Passwords & secrets: `<REDACTED_CREDENTIAL>`
- **Length Invariance**: Tokens are constant length strings, preventing character-count inferencing.
- **Server-Side Awareness Header**: Outgoing JSON payloads include a standardized metadata envelope:
  ```json
  {
    "schema_version": "1.5.0",
    "token_manifest": ["<REDACTED_FINANCIAL>", "<REDACTED_IDENTITY>", "<REDACTED_CONTACT>", "<REDACTED_CREDENTIAL>"],
    "sanitized_dom_tree": { ... }
  }
  ```

### Rationale
Satisfies Constitution Principle III: live DOM remains functional for user interaction; remote VLM receives explicit semantic guidance via the header schema, avoiding reasoning loops or hallucinated values.

### Alternatives Considered
- *Random Salt / Variable-Length Hashing*: Exposes string length or character distribution, allowing statistical inference of sensitive fields.
- *Generic `<REDACTED>` for all types*: Robs the VLM of contextual awareness (the model needs to know an input is a payment card vs a postal code to make appropriate form submission decisions).

---

## 3. VLM Contextual Blindness & Adjacent Label Masking

### Context
Modern VLMs can deduce masked values if adjacent descriptive labels (such as "SSN:", "Credit Card Number:", or "Enter Password:") remain visible in the structural DOM tree or ARIA metadata.

### Decision
Implement a Contextual Blindness Filter that:
1. Identifies form inputs that contain redacted PII.
2. Locates associated descriptor elements via:
   - Explicit `<label for="...">` associations.
   - Enclosing `<label>` tags.
   - `aria-label`, `aria-labelledby`, `placeholder`, and `title` attributes.
   - Preceding sibling or adjacent parent text nodes within a 50px spatial proximity threshold.
3. Replaces descriptor labels in the structural tree with generic structural markers (e.g., `<FIELD_LABEL>`) or scrubs the text content entirely from serialized payloads while preserving layout coordinates.

### Rationale
Satisfies Principle VIII: prevents the VLM from reconstructing sensitive identifiers through adjacent textual correlation.

### Alternatives Considered
- *Deleting the label nodes entirely*: Distorts layout geometry and structural coordinates required by the VLM for spatial reasoning (violates 25% Structural Mapping Accuracy metric).

---

## 4. Background Execution Isolation & Cross-Browser Architecture

### Context
Heavy DOM extraction, visual processing, and regex evaluation must execute without blocking the main browser thread or user interactions.

### Decision
- **Chromium MV3**:
  - Content script collects raw DOM snapshot and sends it to the isolated **Background Service Worker** or `chrome.offscreen` document.
  - Offscreen document performs tokenization, manifest generation, and integrity verification.
  - Offscreen document returns the verified sanitized payload to the background worker for outbound transmission, and sends overlay coordinates back to the content script.
- **Firefox MV3**:
  - Uses background scripts / hidden document polyfills for the offscreen processing loop.
- **Message Integrity**:
  - Context messages between content scripts and background services use strongly typed schemas with cycle IDs (`cycle_id`).

### Rationale
Satisfies Principle IV and IX: keeps the browser UI thread fluid, confines PII processing to privileged background contexts, and maintains MV3 compatibility across Chrome and Firefox.

---

## 5. Fail-Closed Protocol & Verification Architecture

### Context
If any stage of the sanitization pipeline fails, times out, or throws an unhandled exception, raw user data must never escape to the network.

### Decision
Implement a multi-stage **Pre-Transmission Verification Gate**:
1. **Redaction Manifest Generation**: The detection stage produces a `RedactionManifest` enumerating every identified sensitive field, its selector/node ID, category, and expected token replacement.
2. **Payload Verification Scan**:
   - Outbound serializer applies replacements.
   - A verification scanner scans the final serialized string against all regex patterns and confirms that (a) 0 unmasked PII matches exist, (b) all manifest entries are present as semantic tokens, and (c) no raw binary/pixel buffers are present.
3. **Fail-Closed Circuit Breaker**:
   - If verification returns `valid: false` or any step errors out, the pipeline aborts immediately.
   - An event `PRIVACY_ABORT` is published to the Agent Controller.
   - The active task is halted, network requests are cancelled, and a prominent user alert is displayed.

### Rationale
Satisfies Principle V: non-negotiable zero-leakage guarantee.

---

## 6. Real-Time Non-Destructive Audit Overlay

### Context
Users must be able to visually see what the extension is protecting in real time without main-thread UI freezing.

### Decision
- **Overlay Container**: Content script injects a single top-level overlay `<div id="__privacy_audit_overlay">` into the document root or open shadow root with `position: fixed; pointer-events: none; z-index: 2147483647`.
- **Bounding Box Markers**: Renders lightweight colored bounding boxes matching the geometry of redacted elements:
  - Red: `<REDACTED_FINANCIAL>`
  - Orange: `<REDACTED_IDENTITY>`
  - Yellow: `<REDACTED_CREDENTIAL>`
  - Blue: `<REDACTED_CONTACT>`
- **Coalesced RAF Updates**: Overlay updates are throttled via `requestAnimationFrame` and batched to ≤1 update per 100ms on high-mutation pages.
- **Budget**: Render pass benchmarks ensure <50ms DOM paint overhead.

### Rationale
Satisfies Principle IX: delivers transparency without degrading browser performance or interfering with user click events.

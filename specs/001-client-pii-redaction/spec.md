# Feature Specification: Client-Side PII Redaction Pipeline

**Feature Branch**: `001-client-pii-redaction`

**Created**: 2026-09-08

**Status**: Draft

**Input**: User description: "Client-side PII Redaction Pipeline: Local DOM & visual privacy filter with regex + lightweight local models, structural tokenization (<REDACTED_*>), and fail-closed verification."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Local Textual PII Detection and Structural Tokenization (Priority: P1)

When a user navigates sensitive web forms or pages containing personal, financial, or authentication data, the browser agent must ensure that all sensitive text values (credit cards, government IDs, email addresses, phone numbers, passwords) are automatically detected and replaced with uniform semantic category tokens prior to any external data serialization. The live webpage remains interactive and visually unaltered for the user.

**Why this priority**: Absolute protection of user confidential data is the foundational privacy directive. Without guaranteed text-level sanitization, the agent cannot safely transmit any structural webpage representation upstream.

**Independent Test**: Can be independently tested by rendering a test document containing synthetic credit card numbers, government IDs, and login credentials, then inspecting the serialized outbound payload to verify all sensitive values are replaced by fixed semantic placeholder tokens while the live document DOM retains its original state.

**Acceptance Scenarios**:

1. **Given** a webpage containing visible financial data (e.g., a 16-digit payment card number), **When** the client agent captures the page state for processing, **Then** the serialized payload replaces the raw card number with `<REDACTED_FINANCIAL>` and preserves the structural element tag and non-sensitive positioning coordinates.
2. **Given** an input field containing a user password or security credential, **When** state serialization occurs, **Then** the credential value is replaced with `<REDACTED_CREDENTIAL>` regardless of field masking type.
3. **Given** a live webpage with active form inputs, **When** textual redaction is performed, **Then** the underlying live document structure and visible input values remain completely intact and functional for the user.

---

### User Story 2 - Fail-Closed Halt and Security Alert (Priority: P1)

If the local privacy verification engine encounters an unrecoverable internal error, cannot confidently classify an ambiguous sensitive entity, or fails to produce a verified redaction manifest, the system immediately aborts the active automation session and notifies the user with a clear explanation before any data is transmitted.

**Why this priority**: A privacy system must fail safe. Transmitting unverified data or allowing silent degradation during an internal fault breaches the project's zero-leakage guarantee.

**Independent Test**: Can be independently tested by injecting simulated processing faults or unparseable corrupted state into the local pipeline and verifying that outbound network serialization is completely blocked, the task session halts, and a prominent user alert is emitted.

**Acceptance Scenarios**:

1. **Given** a local redaction engine processing fault or internal verification timeout, **When** outbound network transmission is requested, **Then** the system blocks transmission completely, halts the task session, and notifies the user of the privacy abort.
2. **Given** an unverified or incomplete redaction manifest, **When** the communication layer attempts serialization, **Then** the transmission pipeline refuses the payload and transitions the agent into a halted safe state.

---

### User Story 3 - Visual Redaction and Contextual Label Masking (Priority: P2)

When pages display graphical personal identifiers (such as user profile photos, face images, or opaque badge canvases) alongside contextual identifying labels (such as "SSN:", "Social Security Number:", or "Cardholder:"), the system applies opaque bounding box masking to the visual elements and scrubs adjacent descriptor labels from the transmitted structural topology.

**Why this priority**: Modern vision-language models can deduce masked or tokenized values if surrounding contextual labels or visual facial landmarks are exposed. Eliminating contextual clues guarantees true zero-knowledge analysis.

**Independent Test**: Can be independently tested on a mock identity verification page containing a user portrait and a labeled identifier input, verifying that the visual identifier is completely obscured by an opaque mask and the adjacent identifying label is stripped from the serialized representation.

**Acceptance Scenarios**:

1. **Given** an opaque canvas or image element containing a detected human face, **When** the page state is processed, **Then** the region is replaced with an impenetrable opaque bounding box in the sanitized visual representation.
2. **Given** a form field preceded or labeled by an explicit sensitive descriptor (e.g., "SSN:"), **When** the structural representation is created, **Then** the descriptor text is scrubbed or replaced with a generalized structural marker to prevent contextual deduction.

---

### User Story 4 - Real-Time Non-Destructive Audit Overlay (Priority: P3)

While the agent operates, the user can visually verify in real time which page elements are being redacted via lightweight, non-destructive visual highlight overlays displayed directly in the browser viewport.

**Why this priority**: Auditability builds user trust and allows immediate visual confirmation that private information is shielded, but it must operate smoothly without slowing down normal browser usage.

**Independent Test**: Can be independently tested by loading a multi-field checkout page, triggering the privacy scan, and measuring the time elapsed until visual indicator overlays appear over redacted fields, ensuring zero distortion of the page layout.

**Acceptance Scenarios**:

1. **Given** a webpage with multiple detected PII fields, **When** redaction mapping finishes, **Then** high-contrast bounding box overlays appear over the detected elements without altering element dimensions or page flow.
2. **Given** an active page interaction, **When** the audit overlay updates, **Then** the update executes within the designated responsiveness budget without noticeable frame dropping or input stutter.

---

### Edge Cases

- What happens when a user enters PII across split input fields (e.g., four 4-digit credit card boxes)? The system must correlate sequential related inputs and redact each constituent field appropriately.
- How does the system handle dynamically injected content or late-loading iframes? The system must require fresh sanitization and validation on every cycle prior to any serialization.
- What happens when text contains lookalike characters or homoglyphs designed to evade detection? The sanitization pipeline must normalize text before classification.
- What happens when non-sensitive numbers resemble financial patterns (e.g., order tracking numbers)? The system must prioritize privacy recall (minimum 95% threshold) over permissive transmission, favoring conservative tokenization when confidence is borderline.
- How does the system handle non-English or international identifier formats (e.g., Aadhaar, PAN, international phone numbers)? The detection models must validate country-specific checksums and formats across supported locales.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST perform all detection, sanitization, and redaction verification locally on the client before permitting outbound transmission.
- **FR-002**: System MUST detect and redact global payment card numbers (15–19 digits conforming to standard format and checksum rules).
- **FR-003**: System MUST detect and redact standard government identifiers including US Social Security Numbers, Indian Permanent Account Numbers (PAN), and Indian Aadhaar numbers.
- **FR-004**: System MUST detect and redact email addresses, telephone numbers, and authentication credentials (passwords, PINs, security tokens).
- **FR-005**: System MUST detect and visually obscure human faces and photographic biometric identifiers in rendered visual elements.
- **FR-006**: System MUST replace detected textual PII in serialized payloads with standardized semantic placeholder tokens (`<REDACTED_FINANCIAL>`, `<REDACTED_IDENTITY>`, `<REDACTED_CONTACT>`, `<REDACTED_CREDENTIAL>`).
- **FR-007**: System MUST use fixed, uniform token strings for each category so that token length does not reveal the character length of the redacted data.
- **FR-008**: System MUST strip or generalize adjacent identifying field labels that could allow automated inference of redacted field contents.
- **FR-009**: System MUST NOT modify the live document DOM or alter user input values during sanitization.
- **FR-010**: System MUST generate a verifiable redaction manifest documenting all identified sensitive elements and their sanitization status for each perception cycle.
- **FR-011**: System MUST halt the active task session and issue an immediate user alert if local detection or verification fails or times out.
- **FR-012**: System MUST render non-destructive real-time visual audit overlays indicating redacted regions within the user viewport.
- **FR-013**: System MUST attach a standardized metadata header to serialized payloads declaring the schema version and active token manifest.
- **FR-014**: System MUST normalize input text and character encodings to resist adversarial evasion patterns prior to evaluation.

### Key Entities

- **Redaction Manifest**: An internal record generated per cycle cataloging detected sensitive items, element references, classification categories, confidence scores, and redaction verification status.
- **Sanitized Payload Envelope**: The outbound data structure containing non-sensitive structural tags, ARIA roles, relative layout coordinates, and semantic placeholder tokens, coupled with a standardized schema header.
- **Semantic Placeholder Token**: A standardized, fixed-length text symbol representing a specific category of redacted personal information without exposing underlying values or lengths.
- **Audit Overlay Marker**: A visual viewport indicator rendered non-destructively over a protected element to communicate active redaction status to the user.
- **Privacy Abort Event**: A high-priority system state triggered upon verification failure that suspends automation and alerts the user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Achieve a minimum of 95% Precision and 95% Recall on standard PII detection benchmark suites across all supported categories.
- **SC-002**: Guarantee 0% plaintext PII and 0% unmasked pixel transmission in all verified outbound network payloads during automated testing.
- **SC-003**: Complete the client-side redaction and verification pipeline within an end-to-end latency budget of under 500ms per perception-action cycle (well within the total 2000ms action cycle budget).
- **SC-004**: Render and update local audit overlay indicators within 50ms of cycle initiation, preserving smooth interactive browser responsiveness.
- **SC-005**: Demonstrate statistical parity in detection False Negative Rates across diverse demographic cohorts (e.g., across Fitzpatrick skin types for visual face detection) with no cohort exceeding a 5% false negative discrepancy from the baseline mean.
- **SC-006**: Successfully halt 100% of simulated fault-injection sessions without leaking unverified data.

## Assumptions

- The browser client environment supports modern background task execution and local computation standards.
- Outbound reasoning services understand and accept standardized structural semantic tokens and metadata headers.
- Non-sensitive structural DOM topology, layout coordinates, and sanitized ARIA attributes provide sufficient context for remote reasoning models to formulate valid interaction plans.
- Users desire visual feedback regarding shielded elements while retaining unhindered interactive control over their browser session.

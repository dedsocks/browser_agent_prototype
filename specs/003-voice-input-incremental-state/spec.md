# Feature Specification: Voice Input Privacy & Incremental State Processing

**Feature Branch**: `003-voice-input-incremental-state`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "Voice input privacy with local speech transcription, zero raw audio transmission, and incremental state region fingerprinting based on Constitution Articles I, XI, and XII."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Local Voice Input with Zero Raw Audio Leakage (Priority: P1)

When a user prefers hands-free control, they click or tap a microphone control in the browser agent extension to speak their task instructions (e.g. "Order a medium pepperoni pizza to my home address"). The speech transcription occurs completely on the local client device. The resulting transcribed text passes through the exact same privacy boundary and PII detection filters as typed text before being used by the agent. Crucially, raw microphone audio bytes or waveform buffers are never serialized or transmitted to any cloud or external network service, and are discarded immediately after transcription.

**Why this priority**: Constitution Article I & XII mandate that voice input is treated as potentially sensitive visual-equivalent user data. Microphone audio must never create a bypass around the privacy boundary.

**Independent Test**: Can be independently tested by triggering speech recognition, inspecting outbound network telemetry, and verifying 0 audio bytes/packets are transmitted while the transcribed text populates the agent's task goal.

**Acceptance Scenarios**:

1. **Given** an enabled microphone and user click on the Voice Input button, **When** the user speaks a task prompt, **Then** speech is converted to text locally on the client without transmitting raw audio to any external service.
2. **Given** a transcribed voice instruction containing personal details (e.g. spoken phone number or email), **When** the instruction is processed, **Then** it is subjected to the same local PII sanitization and verification pipeline as typed text.
3. **Given** completed local speech transcription, **When** the text is committed, **Then** raw audio buffers in memory are immediately cleared and garbage-collected.

---

### User Story 2 - Voice Failure Handling & Text Fallback (Priority: P1)

If local speech-to-text is unavailable, unsupported by the browser engine, permission is denied by the user, or audio input encounters an unexpected error, the system must not silently fall back to cloud transcription. Instead, it immediately disables the voice-input UI button, displays an informative audit notice to the user, and defaults smoothly to standard keyboard text input so the user can continue their task seamlessly.

**Why this priority**: A silent fallback to remote transcription would directly violate the Zero Raw Data Transmission principle. The agent must fail safe and maintain human visibility.

**Independent Test**: Can be independently tested by simulating a microphone permission rejection or speech API fault and verifying that the microphone control is marked disabled, a clear warning banner is shown, and the text input field retains active focus.

**Acceptance Scenarios**:

1. **Given** speech recognition permission is denied or unsupported, **When** the user attempts voice input, **Then** the voice control displays a disabled status, an alert is rendered, and no network requests are dispatched.
2. **Given** a speech recognition failure during transcription, **When** the error occurs, **Then** the system offers immediate fallback to typed input without requiring a restart of the agent session.

---

### User Story 3 - Incremental State Processing via Region Fingerprinting (Priority: P2)

On complex, multi-turn tasks where only small portions of a webpage change between agent actions (e.g. checking a single checkbox, clicking a tab, or typing into one field), the agent computes deterministic region fingerprints (covering DOM subtree topology, computed geometry, and text hashes). If a region's fingerprint matches its prior verified fingerprint, the agent reuses the prior verified redaction result rather than reprocessing the entire document from scratch.

**Why this priority**: Compounding latency across long-horizon multi-step tasks hurts usability (Constitution Article VII & XI). Incremental processing avoids redundant computation while guaranteeing that any mutated region is fully re-evaluated.

**Independent Test**: Can be independently tested by mutating one form element in a 100-element document, capturing state, and verifying that unchanged regions reuse verified cached manifests while the mutated region is re-evaluated.

**Acceptance Scenarios**:

1. **Given** a multi-step task on a web page, **When** the DOM undergoes a partial mutation, **Then** the incremental processor identifies unchanged subtrees via fingerprint comparison and skips re-detection for those subtrees.
2. **Given** any change in text, attributes, or geometry within a region, **When** the fingerprint differs, **Then** the region is re-processed through full detection and verification.
3. **Given** a region whose fingerprint cannot be computed with high confidence, **When** processing occurs, **Then** the system defaults fail-closed to recomputing the region from scratch.

---

### Edge Cases

- What happens if the user speaks while background music or other people are talking?
  Local recognition transcribes the dominant voice stream; any sensitive spoken terms are caught by the downstream text PII filter before agent reasoning.
- What happens if a web page dynamically injects DOM nodes in a previously cached region?
  The region fingerprint incorporates node count and child hashes, so any child injection triggers a fingerprint mismatch and forces re-evaluation.
- What happens if microphone access is revoked mid-task?
  The voice controller handles the permission revocation event cleanly and switches the UI indicator to typed-only mode.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a voice input toggle allowing natural language task instructions to be spoken.
- **FR-002**: System MUST transcribe speech to text entirely on the local client device using Web Speech API or local audio processing.
- **FR-003**: System MUST NEVER transmit raw audio, PCM buffers, or audio waveforms across the network.
- **FR-004**: System MUST immediately discard audio buffers from client memory once transcription finishes.
- **FR-005**: System MUST disable voice input and provide typed text fallback if speech recognition fails or permissions are denied.
- **FR-006**: System MUST route voice-transcribed task instructions through the local privacy and task boundary identically to typed text.
- **FR-007**: System MUST generate deterministic region fingerprints for DOM subtrees based on tag names, attribute hashes, text content, and geometry bounds.
- **FR-008**: System MUST cache verified redaction results by region fingerprint for reuse across consecutive perception cycles within the same session.
- **FR-009**: System MUST invalidate cached region fingerprints and re-execute full detection whenever a region's computed fingerprint differs or cannot be computed.
- **FR-010**: System MUST provide real-time UI indications of voice listening, processing, and disabled fallback states.

### Key Entities

- **VoiceInputSession**: Tracks speech recognition status (`LISTENING`, `PROCESSING`, `SUCCESS`, `UNAVAILABLE`, `ERROR`), transcribed text, and audio disposal state.
- **RegionFingerprint**: A deterministic composite hash representing a DOM subtree's structural tags, text content, attributes, and geometric layout coordinates.
- **IncrementalStateCache**: Ephemeral session cache mapping valid region fingerprints to their verified redaction manifests and detected entities.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Exactly 0 bytes of audio data leave the browser boundary during voice input.
- **SC-002**: Voice transcription initiates locally in <300ms from user speech input.
- **SC-003**: In multi-step tasks with <20% DOM mutation between steps, incremental state processing reduces cycle sanitization latency by at least 40%.
- **SC-004**: Zero false-positive cache reuses: 100% of mutated regions trigger fingerprint invalidation and fresh detection.
- **SC-005**: 100% of speech recognition errors gracefully fall back to text input within 150ms.

## Assumptions

- Modern Chromium and Firefox browsers provide client-side speech synthesis and recognition primitives (e.g. `webkitSpeechRecognition` / `SpeechRecognition`) or local WASM speech processors.
- Speech transcription accuracy is sufficient for user prompts, and the user can edit or inspect the transcribed prompt before autonomous execution proceeds.

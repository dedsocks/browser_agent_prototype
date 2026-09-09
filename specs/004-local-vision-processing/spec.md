# Feature Specification: Local Vision Processing & Shadow DOM Privacy Engine

**Feature Branch**: `004-local-vision-processing`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "Local vision processing and fallback engine with WebGPU, WASM CPU fallback, and Shadow DOM inspection for opaque elements per Constitution Article II, IV, and V."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Shadow DOM Subtree Traversal & Privacy Sanitization (Priority: P1)

Web applications frequently encapsulate sensitive components (such as payment gateways, identity verification widgets, and custom form controls) inside Shadow DOM boundaries. The browser agent traverses and extracts Shadow DOM subtrees entirely on the local client device. All sensitive credentials, payment details, or personal information inside the Shadow DOM are detected, tokenized, and verified under the same zero-leakage rules as standard DOM nodes, while structural ARIA roles and coordinates remain intact for agent reasoning.

**Why this priority**: Components hidden behind Shadow DOM roots cannot be ignored or bypassed. If the agent either transmits them unmasked or ignores them, automation fails or private data leaks.

**Independent Test**: Can be independently tested by rendering a custom web component with attached Shadow DOM containing credit card and credential inputs, running the perception pass, and verifying that the serialized payload contains tokenized placeholders for Shadow DOM nodes while live inputs remain functional.

**Acceptance Scenarios**:

1. **Given** an element containing an attached Shadow DOM root, **When** the page state is captured, **Then** the extractor recursively inspects all shadow nodes and incorporates them into the structural snapshot.
2. **Given** sensitive PII fields inside a Shadow DOM subtree, **When** sanitization runs, **Then** sensitive text is replaced with semantic tokens in the serialized payload.
3. **Given** non-sensitive interactive controls inside a Shadow root, **When** agent actions target them, **Then** target resolution accurately locates the shadow element on the live document.

---

### User Story 2 - Two-Tier Local Vision Processing with WebGPU & WASM Fallback (Priority: P1)

When web pages contain opaque visual content (HTML5 canvas badges, profile photos, or dynamic signature pads), feature detection and visual masking are executed locally. The vision engine attempts hardware-accelerated WebGPU execution first (Tier 1). If WebGPU is unavailable, unsupported by the GPU, or encounters a device loss error, the system automatically degrades to WebAssembly (WASM/CPU) execution (Tier 2). If both local runtimes fail, the agent halts immediately fail-closed without transmitting unverified visual data.

**Why this priority**: Constitution Article II strictly mandates that opaque elements must be processed entirely on the local device with WebGPU first and WASM CPU fallback. Cloud services must never receive raw opaque visuals.

**Independent Test**: Can be independently tested by processing a mock canvas element under simulated WebGPU available, WebGPU unavailable (forcing WASM), and both unavailable (asserting fail-closed session abort).

**Acceptance Scenarios**:

1. **Given** a hardware environment supporting WebGPU, **When** opaque canvas state is processed, **Then** the engine initializes the WebGPU pipeline and produces a verified bounding box map.
2. **Given** an environment without WebGPU support, **When** visual processing occurs, **Then** the engine seamlessly switches to the WebAssembly CPU pipeline without throwing unhandled exceptions or leaking data.
3. **Given** a catastrophic failure on both WebGPU and WASM runtimes, **When** processing fails, **Then** the system immediately halts the task session and alerts the user fail-closed per Constitution Article V.

---

### User Story 3 - Solid Opaque Canvas Obfuscation & Buffer Validation (Priority: P2)

When personal visual identifiers (such as human faces or signatures) are detected on an HTML5 canvas or image element, the system renders solid opaque bounding box masks directly over the sensitive regions. Before any visual state could be serialized, a validation scanner verifies that the pixel data within the protected coordinates has 100% opacity, ensuring zero visual bleed.

**Why this priority**: Modern VLMs can reconstruct identifying characteristics from semi-transparent or blurred visual content. Solid opaque bounding boxes guarantee zero visual data leakage.

**Independent Test**: Can be independently tested by rendering mock sensitive graphics onto a canvas, applying the visual mask, and inspecting raw pixel buffer data to verify 100% alpha and impenetrable masking.

**Acceptance Scenarios**:

1. **Given** a canvas containing detected sensitive visual features, **When** masking is applied, **Then** solid opaque rectangles cover all detected visual regions.
2. **Given** a masked canvas buffer, **When** pre-transmission validation checks the buffer, **Then** pixel sampling verifies solid opacity across the bounding box area before transmission.

---

### Edge Cases

- What happens if a web page nests multiple Shadow DOM roots inside each other?
  The traversal engine recursively drills down through nested shadow roots up to a safe depth (e.g. 10 levels) without infinite loops.
- What happens if WebGPU execution crashes mid-cycle?
  The error handler catches device loss, automatically re-routes the active cycle to the WASM runtime, and logs a performance tier degradation notice to the user audit UI.
- What happens if a canvas is tainted by cross-origin images?
  If canvas pixels cannot be read due to cross-origin taint, the engine treats the entire canvas element fail-closed as protected and applies an opaque mask over the entire bounding box.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST recursively inspect and extract nodes from both open and accessible Shadow DOM roots.
- **FR-002**: System MUST apply PII detection, label stripping, and semantic tokenization to Shadow DOM text and attributes.
- **FR-003**: System MUST execute local vision processing for opaque elements on client hardware without cloud offloading.
- **FR-004**: System MUST attempt WebGPU acceleration as Tier 1 visual execution.
- **FR-005**: System MUST provide automatic fallback to WebAssembly (WASM/CPU) execution as Tier 2 when WebGPU is unavailable.
- **FR-006**: System MUST halt task execution fail-closed if both WebGPU and WASM runtimes fail.
- **FR-007**: System MUST render solid opaque bounding box masks over detected visual PII regions.
- **FR-008**: System MUST validate 100% pixel opacity on masked visual regions before serialization.
- **FR-009**: System MUST support resolving action targets located inside Shadow DOM subtrees.

### Key Entities

- **VisionExecutionTier**: `"TIER_1_WEBGPU"` | `"TIER_2_WASM_CPU"` | `"UNAVAILABLE"`.
- **ShadowDomSnapshotNode**: Extension of `DomSnapshotNode` indicating `isShadowRoot` and `shadowHostId`.
- **VisualRedactionRegion**: Bounding box coordinates, detection confidence, and opacity verification flag for canvas regions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of accessible Shadow DOM subtrees are captured and subjected to privacy filtering.
- **SC-002**: 0 raw, unmasked canvas pixels or unverified visual data leave the browser.
- **SC-003**: WebGPU to WASM CPU fallback completes in <50ms without failing the user task session.
- **SC-004**: Solid opaque masks achieve 100% opacity (alpha 255) across all protected visual regions.

## Assumptions

- Modern Chromium and Firefox browsers provide standard Shadow DOM access and WebAssembly support.
- Where WebGPU is unavailable (e.g. software rendering or headless tests), WASM CPU execution provides complete functional parity.

# System Architecture & Privacy Boundary

This document describes the architectural design, trust boundaries, and execution pipeline of the **Browser Agent Prototype** in accordance with **Constitution v1.5.0**.

---

## 1. High-Level Architecture Diagram

```mermaid
flowchart TB
    subgraph CLIENT["Client Browser Environment (Trusted Privacy Boundary)"]
        subgraph UI["User & Interaction Interface"]
            USER(["User"])
            POPUP["Extension Popup (popup.html)"]
            VAULT["Audit Vault (vault.html)"]
            SPEECH["Local Web Speech API<br/>(webkitSpeechRecognition)"]
            OVERLAY["Non-Destructive Audit Overlay<br/>(DOM Overlay Container)"]
        end

        subgraph CONTENT["Live Tab / Content Script (content.bundle.js)"]
            DOM["Live Webpage DOM"]
            DOM_EXTRACTOR["DOM & Shadow DOM Extractor<br/>(Geometry & Structural Topology)"]
            FACE_SCANNER["Page Face & Image Scanner"]
            ACTION_EXEC["Action Executor<br/>(Click, Type, Scroll, Navigate)"]
        end

        subgraph BACKGROUND["Background Service Worker (background.bundle.js)"]
            CONTROLLER["Agent Controller<br/>(Perception-Reasoning-Action Loop)"]
            ACTION_VALIDATOR["Local Action Validator<br/>(Allowlisting, Secrets & Intervention Guard)"]
            SNAPSHOT_PROC["Snapshot Processor"]
            
            subgraph PRIVACY_PIPELINE["Client-Side Privacy Engine"]
                REGEX_ENGINE["Regex Engine<br/>(Luhn, SSN, PAN, Email, Credential)"]
                TOKENIZER["Structural Semantic Tokenizer<br/>(Schema v1.5.0 Tokens)"]
                VERIFIER["Pre-Transmission Verifier<br/>(Fail-Closed Zero-Leakage Gate)"]
            end
        end

        subgraph OFFSCREEN["Chromium Offscreen Document (offscreen.html)"]
            OFFSCREEN_MGR["Offscreen Manager"]
            VISION_ENGINE["Local Vision Engine<br/>(Google MediaPipe FaceDetector)"]
            TIER1["Tier 1: WebGPU Acceleration"]
            TIER2["Tier 2: WASM CPU Fallback"]
            HEURISTIC["Tier 3: Pixel Heuristic Fallback"]
        end
    end

    subgraph CLOUD["Untrusted External Reasoning Service"]
        PLANNER_SERVER["Cloud Planner Server<br/>(cloud_planner_server.py)"]
        VLM["Thinking Model<br/>(Google Gemini / OpenAI GPT-4o)"]
    end

    %% User Input Flow
    USER -->|"Voice Dictation"| SPEECH
    SPEECH -->|"Local Transcript (Buffers Disposed)"| POPUP
    USER -->|"Text Instruction"| POPUP
    POPUP -->|"START_TASK"| CONTROLLER

    %% Perception Loop
    CONTROLLER -->|"1. Request Snapshot"| DOM_EXTRACTOR
    DOM_EXTRACTOR -->|"Extract Layout & Topology"| DOM
    DOM_EXTRACTOR -->|"DomSnapshot"| SNAPSHOT_PROC

    %% Face & Visual Biometric Flow
    FACE_SCANNER -->|"Query Images & Canvases"| DOM
    FACE_SCANNER -->|"DETECT_PAGE_FACES"| OFFSCREEN_MGR
    OFFSCREEN_MGR --> VISION_ENGINE
    VISION_ENGINE --> TIER1
    TIER1 -.->|"GPU Unsupported"| TIER2
    TIER2 -.->|"WASM Fallback"| HEURISTIC
    VISION_ENGINE -->|"Face Viewport Coordinates"| FACE_SCANNER

    %% Overlay Rendering
    SNAPSHOT_PROC -->|"PII Overlay Markers"| OVERLAY
    FACE_SCANNER -->|"Biometric Markers (#805AD5)"| OVERLAY
    OVERLAY -.->|"Non-Destructive Paint (<50ms)"| DOM

    %% Sanitization & Zero-Leakage Verification
    SNAPSHOT_PROC --> REGEX_ENGINE
    REGEX_ENGINE --> TOKENIZER
    TOKENIZER -->|"Sanitized Payload Envelope"| VERIFIER
    VERIFIER -->|"Log Sanitized Outbound JSON"| VAULT

    %% Cloud Reasoning Flow
    VERIFIER -->|"2. Schema v1.5.0 Payload (Zero Raw Data)"| CONTROLLER
    CONTROLLER -->|"3. POST /v1/plan (Tokens Only)"| PLANNER_SERVER
    PLANNER_SERVER --> VLM
    VLM -->|"Structured Next Action (JSON)"| PLANNER_SERVER
    PLANNER_SERVER -->|"Proposed Action"| CONTROLLER

    %% Action Validation & Execution
    CONTROLLER -->|"4. Validate Proposed Action"| ACTION_VALIDATOR
    ACTION_VALIDATOR -->|"Human Intervention Required<br/>(Password/Credential)"| POPUP
    ACTION_VALIDATOR -->|"5. Dispatched Validated Action"| ACTION_EXEC
    ACTION_EXEC -->|"Synthesize User Events"| DOM
```

---

## 2. Architectural Components

### A. Client-Side Privacy Boundary
1. **Zero Raw Data Transmission (Article I)**: Raw pixel buffers, base64 image streams, and plaintext user secrets never leave the client browser.
2. **Structural Semantic Tokenization (Article III)**: Sensitive text values are replaced with strict semantic placeholder tokens (`<REDACTED_FINANCIAL>`, `<REDACTED_IDENTITY>`, `<REDACTED_CREDENTIAL>`, `<REDACTED_CONTACT>`, `<REDACTED_BIOMETRIC_VISUAL>`).
3. **Pre-Transmission Verifier (Article V)**: Operates fail-closed. If unmasked PII, schema mismatches, or binary image buffers leak into the outbound payload, the network dispatch halts immediately.

### B. Local Vision & Face Redaction (Article II & X)
1. **Isolated Offscreen Context (Article IV)**: Visual neural inference executes in an isolated Chromium Offscreen Document (`offscreen.html`).
2. **Two-Tier Inference with Fallback**:
   - **Tier 1 (Primary)**: Hardware-accelerated WebGPU inference via Google MediaPipe `FaceDetector`.
   - **Tier 2 (Fallback)**: CPU WebAssembly (WASM/XNNPACK) inference.
   - **Tier 3 (Heuristic)**: In-memory pixel heuristic to guarantee zero unmasked faces even in headless or virtual GPU environments.
3. **Audit Overlay (Article IX)**: Detected faces receive non-destructive purple bounding boxes (`#805AD5`) rendered under a strict `<50ms` paint budget.

### C. Voice Input Privacy (Article XII)
- Natural language voice instructions are captured via the browser's native Web Speech API (`webkitSpeechRecognition`).
- Raw audio streams are never recorded or transmitted off-device; audio buffers are disposed immediately upon final transcription.

### D. Perception-Reasoning-Action Loop (Article XIV & XV)
1. **Observe**: DOM topology and layout geometry are non-destructively extracted without mutating the live webpage.
2. **Detect & Sanitize**: Regex pattern matching and local neural models locate PII and faces.
3. **Verify**: Pre-transmission verification validates payload integrity.
4. **Transmit & Reason**: The Cloud Planner Server receives only sanitized Schema v1.5.0 payloads and prompts the thinking model (e.g. Gemini / GPT-4o).
5. **Validate**: The agent validates proposed actions against an allowlist (`click`, `type`, `scroll`, `navigate`) and pauses for human intervention on password/credential fields (Article XIII).
6. **Execute**: Validated actions are safely dispatched to the live DOM with visual feedback.

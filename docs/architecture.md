# System Architecture & Privacy Boundary
Version: 1.5.0

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

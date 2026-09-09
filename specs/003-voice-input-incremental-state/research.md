# Research: Voice Input Privacy & Incremental State Processing

**Feature**: `003-voice-input-incremental-state`  
**Date**: 2026-09-09  

---

## 1. Local Voice Recognition & Zero Raw Audio Transmission

### Decision
Use standard browser client-side `webkitSpeechRecognition` / `SpeechRecognition` running in continuous or single-phrase mode within the extension context, backed by an injectable speech transcriber interface (`ISpeechTranscriber`) that allows offline mock transcription for test automation.
- Never record raw audio streams to disk or send audio chunks to third-party endpoints.
- If `SpeechRecognition` is undefined or permission is blocked, immediately transition state to `UNAVAILABLE` and return a typed text fallback callback.

### Rationale
- Constitution Article I & XII: Microphone audio is treated with the same severity as unmasked screen pixels. It must never leak into cloud speech services.
- The Web Speech API is natively built into Chrome and browser runtimes.
- Providing an interface allows 100% test coverage without hardware microphone dependencies in CI/CD environments.

---

## 2. Deterministic Region Fingerprinting (Constitution Article XI)

### Decision
Construct region fingerprints using a fast, non-cryptographic 64-bit hash (FNV-1a / Murmur3 / polynomial rolling hash) over a normalized structural string:
`Fingerprint = hash(nodeId + ":" + tag + ":" + attributeKeysSorted + ":" + textContent + ":" + bounds.x + "," + bounds.y + "," + bounds.width + "," + bounds.height)`

Subtree fingerprints compose the child node hashes:
`SubtreeFingerprint = hash(nodeFingerprint + ":" + childFingerprints.join(","))`

### Rationale
- Constitution Article XI requires: "region fingerprint covering DOM subtree content, computed CSSOM styling, geometry, accessibility metadata, and visual canvas hashes".
- An exact hash comparison takes microseconds.
- If any attribute, text value, child addition/removal, or layout coordinate changes, the hash changes, guaranteeing fail-closed re-evaluation.

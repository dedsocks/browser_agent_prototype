# Quickstart: Voice Input Privacy & Incremental State Processing

**Feature**: `003-voice-input-incremental-state`  
**Date**: 2026-09-09  

---

## 1. Running Tests

```bash
# Run unit tests for voice and cache
npx vitest run tests/unit/voice/ tests/unit/cache/

# Run integration tests
npx vitest run tests/integration/voice-privacy-flow.test.ts
npx vitest run tests/integration/incremental-processing.test.ts
```

## 2. Verification Steps

1. **Voice Zero Raw Audio Transmission**: Test asserts that during transcription, zero network requests occur and audio memory is marked cleared.
2. **Speech Fallback**: Test disables speech API and asserts UI switches to text-only mode.
3. **Region Fingerprinting**: Mutate single node in large DOM tree and assert cache hit for unchanged nodes and cache miss for mutated node.

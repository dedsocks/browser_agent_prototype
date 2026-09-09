# Data Model: Voice Input Privacy & Incremental State Processing

**Feature**: `003-voice-input-incremental-state`  
**Date**: 2026-09-09  

---

## Type Definitions

### 1. Voice Recognition States

```typescript
export enum VoiceState {
  INACTIVE = "INACTIVE",
  LISTENING = "LISTENING",
  PROCESSING = "PROCESSING",
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
  UNAVAILABLE = "UNAVAILABLE"
}

export interface VoiceSession {
  state: VoiceState;
  transcript: string;
  isFinal: boolean;
  audioBuffersCleared: boolean;
  errorMessage?: string;
}
```

### 2. Region Fingerprinting & State Cache

```typescript
export interface RegionFingerprint {
  nodeId: string;
  fingerprintHash: string;
  subtreeHash: string;
  timestamp: number;
}

export interface CachedRegionRedaction {
  fingerprintHash: string;
  entities: DetectedEntity[];
  sanitizedNode: SanitizedDomNode;
  verifiedAt: number;
}
```

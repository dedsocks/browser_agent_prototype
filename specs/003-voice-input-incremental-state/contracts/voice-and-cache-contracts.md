# Contracts: Voice Input & Incremental State Processing

**Feature**: `003-voice-input-incremental-state`  
**Date**: 2026-09-09  

---

## 1. Voice Recognition Contract

```typescript
export interface ISpeechTranscriber {
  isSupported(): boolean;
  startListening(
    onInterim: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (err: string) => void
  ): Promise<void>;
  stopListening(): void;
  disposeAudioBuffers(): void;
}
```

## 2. Incremental Region Cache Contract

```typescript
export interface IIncrementalStateCache {
  get(fingerprintHash: string): CachedRegionRedaction | undefined;
  set(fingerprintHash: string, result: CachedRegionRedaction): void;
  clear(): void;
  has(fingerprintHash: string): boolean;
  getHitRate(): { hits: number; misses: number; ratio: number };
}
```

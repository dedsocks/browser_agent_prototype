# Data Model: Local Vision Processing & Shadow DOM Privacy Engine

**Feature**: `004-local-vision-processing`  
**Date**: 2026-09-09  

---

## Type Definitions

### 1. Vision Execution Tier

```typescript
export enum VisionTier {
  TIER_1_WEBGPU = "TIER_1_WEBGPU",
  TIER_2_WASM_CPU = "TIER_2_WASM_CPU",
  UNAVAILABLE = "UNAVAILABLE"
}

export interface VisionProcessResult {
  tierUsed: VisionTier;
  success: boolean;
  detectedRegions: SimpleBounds[];
  maskApplied: boolean;
  error?: string;
  durationMs: number;
}
```

### 2. Shadow DOM Metadata

```typescript
export interface ShadowDomNodeInfo {
  isShadowRoot?: boolean;
  shadowHostId?: string;
  shadowMode?: "open" | "closed";
}
```

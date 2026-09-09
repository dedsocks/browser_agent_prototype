# Contracts: Vision & Shadow DOM Engine

**Feature**: `004-local-vision-processing`  
**Date**: 2026-09-09  

---

## 1. Local Vision Engine Interface

```typescript
export interface ILocalVisionEngine {
  getActiveTier(): VisionTier;
  processCanvas(canvas: HTMLCanvasElement): Promise<VisionProcessResult>;
  applyAndValidateMask(ctx: CanvasRenderingContext2D, regions: SimpleBounds[]): boolean;
}
```

## 2. Shadow DOM Traversal Contract

```typescript
export interface IShadowDomExtractor {
  extractSubtree(root: Element | ShadowRoot, hostId?: string): DomSnapshotNode[];
}
```

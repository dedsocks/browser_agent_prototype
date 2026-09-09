import { describe, it, expect } from "vitest";
import { LocalVisionEngine } from "../../src/vision/vision-engine.js";
import { VisionTier } from "../../src/common/types.js";

describe("Opaque Elements Local Vision Fallback Integration (Constitution Article II & V)", () => {
  it("processes canvas under hardware WebGPU tier with zero raw pixel leakage", async () => {
    const engine = new LocalVisionEngine({
      webGpuProvider: {
        isAvailable: () => true,
        detectOpaqueRegions: async () => [{ x: 5, y: 5, width: 30, height: 30 }]
      }
    });

    const result = await engine.processCanvas({ width: 200, height: 150 } as any);
    expect(result.success).toBe(true);
    expect(result.tierUsed).toBe(VisionTier.TIER_1_WEBGPU);
    expect(result.maskApplied).toBe(true);
  });

  it("dynamically falls back to WASM when WebGPU fails mid-operation", async () => {
    let shouldWebGpuCrash = true;

    const crashableWebGpu = {
      isAvailable: () => true,
      detectOpaqueRegions: async () => {
        if (shouldWebGpuCrash) {
          throw new Error("WebGPU Device Lost / Out of Memory");
        }
        return [];
      }
    };

    const wasmFallback = {
      isAvailable: () => true,
      detectOpaqueRegions: async () => [{ x: 12, y: 12, width: 24, height: 24 }]
    };

    const engine = new LocalVisionEngine({
      webGpuProvider: crashableWebGpu,
      wasmProvider: wasmFallback
    });

    // Should catch WebGPU crash, degrade to WASM Tier 2, and succeed
    const result = await engine.processCanvas({ width: 100, height: 100 } as any);
    expect(result.success).toBe(true);
    expect(result.tierUsed).toBe(VisionTier.TIER_2_WASM_CPU);
    expect(result.detectedRegions.length).toBe(1);
  });
});

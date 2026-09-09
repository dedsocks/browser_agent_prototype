import { describe, it, expect } from "vitest";
import { LocalVisionEngine } from "../../../src/vision/vision-engine.js";
import { VisionTier } from "../../../src/common/types.js";

describe("Two-Tier Local Vision Engine (Constitution Article II & V)", () => {
  it("initializes WebGPU Tier 1 when adapter and device are available", async () => {
    const mockWebGpuProvider = {
      isAvailable: () => true,
      detectOpaqueRegions: async () => [{ x: 10, y: 10, width: 50, height: 50 }]
    };

    const engine = new LocalVisionEngine({ webGpuProvider: mockWebGpuProvider });
    expect(engine.getActiveTier()).toBe(VisionTier.TIER_1_WEBGPU);

    const result = await engine.processCanvas({ width: 100, height: 100 } as any);
    expect(result.success).toBe(true);
    expect(result.tierUsed).toBe(VisionTier.TIER_1_WEBGPU);
    expect(result.detectedRegions.length).toBe(1);
  });

  it("degrades gracefully to WebAssembly WASM/CPU Tier 2 when WebGPU is unsupported", async () => {
    const unavailableWebGpu = {
      isAvailable: () => false,
      detectOpaqueRegions: async () => []
    };

    const mockWasmProvider = {
      isAvailable: () => true,
      detectOpaqueRegions: async () => [{ x: 20, y: 20, width: 40, height: 40 }]
    };

    const engine = new LocalVisionEngine({
      webGpuProvider: unavailableWebGpu,
      wasmProvider: mockWasmProvider
    });

    expect(engine.getActiveTier()).toBe(VisionTier.TIER_2_WASM_CPU);

    const result = await engine.processCanvas({ width: 100, height: 100 } as any);
    expect(result.success).toBe(true);
    expect(result.tierUsed).toBe(VisionTier.TIER_2_WASM_CPU);
    expect(result.detectedRegions.length).toBe(1);
  });

  it("halts fail-closed when both WebGPU and WASM runtimes fail (Constitution Article V)", async () => {
    const unavailableWebGpu = {
      isAvailable: () => false,
      detectOpaqueRegions: async () => []
    };
    const unavailableWasm = {
      isAvailable: () => false,
      detectOpaqueRegions: async () => []
    };

    const engine = new LocalVisionEngine({
      webGpuProvider: unavailableWebGpu,
      wasmProvider: unavailableWasm
    });

    expect(engine.getActiveTier()).toBe(VisionTier.UNAVAILABLE);

    const result = await engine.processCanvas({ width: 100, height: 100 } as any);
    expect(result.success).toBe(false);
    expect(result.tierUsed).toBe(VisionTier.UNAVAILABLE);
    expect(result.error).toContain("Fail-Closed");
  });
});

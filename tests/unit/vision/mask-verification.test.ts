import { describe, it, expect } from "vitest";
import { offscreenManager } from "../../../src/background/offscreen-manager.js";
import { SimpleBounds } from "../../../src/common/types.js";

describe("Canvas Opaque Masking & Opacity Verification (Constitution Article II & III)", () => {
  it("renders solid opaque mask over specified canvas bounds and verifies 100% opacity", () => {
    // Mock canvas 2D context
    const pixelData = new Uint8ClampedArray(100 * 100 * 4); // RGBA
    const mockCtx: any = {
      save: () => {},
      restore: () => {},
      fillStyle: "",
      fillRect: (x: number, y: number, w: number, h: number) => {
        // Fill alpha with 255 (solid opaque)
        for (let i = 3; i < pixelData.length; i += 4) {
          pixelData[i] = 255;
        }
      },
      getImageData: (x: number, y: number, w: number, h: number) => {
        return { data: pixelData, width: w, height: h };
      }
    };

    const region: SimpleBounds = { x: 10, y: 10, width: 50, height: 50 };

    offscreenManager.applyOpaqueVisualMask(mockCtx, [region]);
    const isValid = offscreenManager.validateMaskOpacity(mockCtx, region);

    expect(isValid).toBe(true);
  });

  it("detects semi-transparent or unmasked pixels and rejects validation", () => {
    const pixelData = new Uint8ClampedArray(100 * 100 * 4);
    // Leave alpha at 0 or semi-transparent (128)
    for (let i = 3; i < pixelData.length; i += 4) {
      pixelData[i] = 128;
    }

    const mockCtx: any = {
      getImageData: (x: number, y: number, w: number, h: number) => {
        return { data: pixelData, width: w, height: h };
      }
    };

    const region: SimpleBounds = { x: 0, y: 0, width: 20, height: 20 };
    const isValid = offscreenManager.validateMaskOpacity(mockCtx, region);

    expect(isValid).toBe(false);
  });
});

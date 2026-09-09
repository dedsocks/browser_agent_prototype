import { describe, it, expect } from "vitest";
import { IncrementalStateCache } from "../../../src/cache/state-cache.js";
import { CachedRegionRedaction, RedactionCategory, SemanticToken } from "../../../src/common/types.js";

describe("Incremental State Cache", () => {
  const sampleCachedItem: CachedRegionRedaction = {
    fingerprintHash: "fp_abc123",
    entities: [
      {
        id: "e1",
        category: RedactionCategory.CONTACT,
        token: SemanticToken.CONTACT,
        nodeId: "node_email",
        bounds: { x: 10, y: 10, width: 100, height: 20, top: 10, left: 10, bottom: 30, right: 110 },
        associatedLabelNodeIds: [],
        confidence: 0.95,
        verified: true
      }
    ],
    sanitizedNode: {
      node_id: "node_email",
      tag: "input",
      bounds: { x: 10, y: 10, width: 100, height: 20 },
      text: "<REDACTED_CONTACT>"
    },
    verifiedAt: Date.now()
  };

  it("caches and retrieves verified redaction by fingerprint hash", () => {
    const cache = new IncrementalStateCache();

    expect(cache.has("fp_abc123")).toBe(false);
    cache.set("fp_abc123", sampleCachedItem);

    expect(cache.has("fp_abc123")).toBe(true);
    const retrieved = cache.get("fp_abc123");
    expect(retrieved?.entities.length).toBe(1);
    expect(retrieved?.sanitizedNode.text).toBe("<REDACTED_CONTACT>");
  });

  it("accurately tracks hit and miss rates", () => {
    const cache = new IncrementalStateCache();
    cache.set("fp_abc123", sampleCachedItem);

    cache.get("fp_abc123"); // Hit
    cache.get("fp_abc123"); // Hit
    cache.get("fp_nonexistent"); // Miss

    const stats = cache.getHitRate();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.ratio).toBeCloseTo(2 / 3);
  });

  it("clears cache completely on session abort or reset", () => {
    const cache = new IncrementalStateCache();
    cache.set("fp_abc123", sampleCachedItem);

    cache.clear();
    expect(cache.has("fp_abc123")).toBe(false);
    expect(cache.getHitRate().hits).toBe(0);
  });
});

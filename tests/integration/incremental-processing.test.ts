import { describe, it, expect } from "vitest";
import { IncrementalStateCache } from "../../src/cache/state-cache.js";
import { computeNodeFingerprint } from "../../src/cache/region-fingerprint.js";
import { DomSnapshotNode } from "../../src/common/types.js";
import { handleDomSnapshotRequest, setIncrementalCache } from "../../src/background/index.js";

describe("Incremental State Processing Integration (Constitution Article XI)", () => {
  const nodeStatic: DomSnapshotNode = {
    node_id: "static_header",
    tag: "header",
    text: "ACME Corp Flight Center",
    attributes: { class: "nav-header" },
    bounds: { x: 0, y: 0, width: 800, height: 60 },
    children_ids: []
  };

  const nodeCard: DomSnapshotNode = {
    node_id: "cc_input",
    tag: "input",
    value: "4532 1234 5678 9012",
    attributes: { type: "text", name: "card" },
    bounds: { x: 10, y: 80, width: 250, height: 40 },
    children_ids: []
  };

  it("reuses verified redactions for unchanged nodes on subsequent perception cycle", async () => {
    const cache = new IncrementalStateCache();
    setIncrementalCache(cache);

    const snapshot1 = {
      root_node_id: "root",
      nodes: [nodeStatic, nodeCard]
    };

    // Cycle 1: Fresh processing, cache empty
    const res1 = await handleDomSnapshotRequest({
      type: "PROCESS_DOM_SNAPSHOT",
      cycle_id: "c1",
      url: "https://shop.example.com",
      timestamp: Date.now(),
      dom_snapshot: snapshot1
    });

    expect(res1.type).toBe("DOM_SANITIZATION_SUCCESS");
    expect(cache.getHitRate().hits).toBe(0);

    // Cycle 2: Same snapshot - should hit cache
    const res2 = await handleDomSnapshotRequest({
      type: "PROCESS_DOM_SNAPSHOT",
      cycle_id: "c2",
      url: "https://shop.example.com",
      timestamp: Date.now(),
      dom_snapshot: snapshot1
    });

    expect(res2.type).toBe("DOM_SANITIZATION_SUCCESS");
    expect(cache.getHitRate().hits).toBeGreaterThan(0);

    // Cycle 3: Mutated card value - cache miss for mutated node, cache hit for static node
    const mutatedCard: DomSnapshotNode = {
      ...nodeCard,
      value: "4532 9999 8888 7777"
    };
    const snapshot3 = {
      root_node_id: "root",
      nodes: [nodeStatic, mutatedCard]
    };

    const hitsBefore = cache.getHitRate().hits;
    const res3 = await handleDomSnapshotRequest({
      type: "PROCESS_DOM_SNAPSHOT",
      cycle_id: "c3",
      url: "https://shop.example.com",
      timestamp: Date.now(),
      dom_snapshot: snapshot3
    });

    expect(res3.type).toBe("DOM_SANITIZATION_SUCCESS");
    // Static node hits cache, mutated card was re-detected
    expect(cache.getHitRate().hits).toBeGreaterThan(hitsBefore);
  });
});

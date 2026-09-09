import { describe, it, expect } from "vitest";
import { computeNodeFingerprint, computeSubtreeFingerprint } from "../../../src/cache/region-fingerprint.js";
import { DomSnapshotNode } from "../../../src/common/types.js";

describe("Region Fingerprinting (Constitution Article XI)", () => {
  const sampleNode: DomSnapshotNode = {
    node_id: "node_1",
    tag: "div",
    text: "Welcome back",
    attributes: { class: "user-card", "data-user": "123" },
    bounds: { x: 10, y: 20, width: 200, height: 100 },
    children_ids: []
  };

  it("produces deterministic hash for identical node", () => {
    const hash1 = computeNodeFingerprint(sampleNode);
    const hash2 = computeNodeFingerprint({ ...sampleNode });

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{8,16}$/);
  });

  it("detects text changes and alters fingerprint", () => {
    const hashOriginal = computeNodeFingerprint(sampleNode);
    const mutated = { ...sampleNode, text: "Welcome forward" };
    const hashMutated = computeNodeFingerprint(mutated);

    expect(hashOriginal).not.toBe(hashMutated);
  });

  it("detects attribute modifications and alters fingerprint", () => {
    const hashOriginal = computeNodeFingerprint(sampleNode);
    const mutated = { ...sampleNode, attributes: { ...sampleNode.attributes, class: "user-card-active" } };
    const hashMutated = computeNodeFingerprint(mutated);

    expect(hashOriginal).not.toBe(hashMutated);
  });

  it("detects geometric layout movements and alters fingerprint", () => {
    const hashOriginal = computeNodeFingerprint(sampleNode);
    const moved = { ...sampleNode, bounds: { ...sampleNode.bounds, x: 50 } };
    const hashMoved = computeNodeFingerprint(moved);

    expect(hashOriginal).not.toBe(hashMoved);
  });

  it("computes composite subtree fingerprint combining children", () => {
    const parentNode: DomSnapshotNode = {
      node_id: "parent",
      tag: "section",
      attributes: {},
      bounds: { x: 0, y: 0, width: 400, height: 300 },
      children_ids: ["node_1"]
    };

    const parentHash = computeNodeFingerprint(parentNode);
    const childHash = computeNodeFingerprint(sampleNode);

    const subtreeHash1 = computeSubtreeFingerprint(parentHash, [childHash]);
    const subtreeHash2 = computeSubtreeFingerprint(parentHash, [childHash]);
    expect(subtreeHash1).toBe(subtreeHash2);

    // If child changes, subtree hash changes
    const mutatedChildHash = computeNodeFingerprint({ ...sampleNode, text: "Changed" });
    const subtreeHashMutated = computeSubtreeFingerprint(parentHash, [mutatedChildHash]);
    expect(subtreeHash1).not.toBe(subtreeHashMutated);
  });
});
